import { Query, type Models } from 'node-appwrite';
import type { ConnectionRequest, Contact, UserLookup } from '../contracts/api';
import { createRow, findOne, getRow, listRows, updateRow } from '../db/repo';
import { isConflict, pairKey, type ConnectionRequestRow, type ContactRow } from '../db/rows';
import { TABLES } from '../db/schema';
import { conflict, forbidden, notFound } from '../errors';
import type { PersonRef } from '../mappers/profile';
import { emitEvent } from './events';
import { getOrCreateConversation } from './messaging';
import { lookupByHandle, personRefs } from './profiles';
import { assertNotBlocked, isBlockedEitherWay } from './safety';

const toRequest = (r: ConnectionRequestRow, counterpart: PersonRef): ConnectionRequest => ({
  id: r.$id, fromUserId: r.fromUserId, toUserId: r.toUserId, message: r.message ?? '', status: r.status as ConnectionRequest['status'],
  source: r.source as ConnectionRequest['source'], createdAt: r.createdAt, respondedAt: r.respondedAt, counterpart,
});

/** Exact handle only — no enumeration. Blocked users appear as not found. */
export async function lookup(handle: string, viewerId: string): Promise<UserLookup | null> {
  const found = await lookupByHandle(handle);
  if (!found || !found.profile.handle || found.profile.$id === viewerId) return null;
  if (await isBlockedEitherWay(viewerId, found.profile.$id)) return null;
  return { userId: found.profile.$id, displayName: found.profile.displayName, handle: found.profile.handle, avatarFileId: found.profile.avatarFileId, roles: found.memberships.map((m) => m.role as UserLookup['roles'][number]) };
}

export async function areContacts(a: string, b: string): Promise<boolean> {
  return !!(await findOne<ContactRow>(TABLES.contacts, [Query.equal('userId', a), Query.equal('contactUserId', b)]));
}

export async function createRequest(from: Models.User, input: { toUserId: string; message: string }, source: 'handle' | 'invite' | 'relation', requestId?: string): Promise<ConnectionRequest> {
  if (input.toUserId === from.$id) throw conflict('invalid_state', 'You cannot connect with yourself.');
  if (!(await getRow(TABLES.profiles, input.toUserId))) throw notFound('user_not_found', 'This person could not be found.');
  await assertNotBlocked(from.$id, input.toUserId);
  if (await areContacts(from.$id, input.toUserId)) throw conflict('duplicate_request', 'You are already connected.');
  const key = pairKey(from.$id, input.toUserId);
  const open = await findOne<ConnectionRequestRow>(TABLES.connectionRequests, [Query.equal('pairKey', key), Query.equal('status', 'pending')]);
  if (open) {
    // Mutual intent: they already asked us → auto-accept instead of a duplicate.
    if (open.toUserId === from.$id) return accept(open.$id, from, requestId);
    throw conflict('duplicate_request', 'You already sent a request to this person.');
  }
  const row = await createRow<ConnectionRequestRow>(TABLES.connectionRequests, { fromUserId: from.$id, toUserId: input.toUserId, message: input.message, status: 'pending', source, pairKey: key, respondedAt: null });
  await emitEvent({ eventType: 'connection.requested', aggregateType: 'connection_request', aggregateId: row.$id, actorId: from.$id, payload: {}, requestId });
  return toRequest(row, (await personRefs([input.toUserId])).get(input.toUserId)!);
}

export async function listRequests(userId: string, direction: 'incoming' | 'outgoing', limit: number, cursor?: string): Promise<{ items: ConnectionRequest[]; nextCursor: string | null }> {
  const q = [Query.equal(direction === 'incoming' ? 'toUserId' : 'fromUserId', userId), Query.equal('status', 'pending'), Query.orderDesc('createdAt'), Query.limit(limit + 1)];
  if (cursor) q.push(Query.cursorAfter(cursor));
  const rows = await listRows<ConnectionRequestRow>(TABLES.connectionRequests, q);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const refs = await personRefs(page.map((r) => (r.fromUserId === userId ? r.toUserId : r.fromUserId)));
  const last = page[page.length - 1];
  return { items: page.map((r) => toRequest(r, refs.get(r.fromUserId === userId ? r.toUserId : r.fromUserId)!)), nextCursor: hasMore && last ? last.$id : null };
}

async function addContactPair(a: string, b: string, conversationId: string): Promise<void> {
  for (const [u, c] of [[a, b], [b, a]] as const) {
    try {
      await createRow<ContactRow>(TABLES.contacts, { userId: u, contactUserId: c, conversationId, connectedAt: new Date().toISOString() });
    } catch (err) {
      if (!isConflict(err)) throw err;
    }
  }
}

export async function accept(id: string, actor: Models.User, requestId?: string): Promise<ConnectionRequest> {
  const row = await getRow<ConnectionRequestRow>(TABLES.connectionRequests, id);
  if (!row) throw notFound('not_found', 'This request could not be found.');
  if (row.toUserId !== actor.$id) throw forbidden();
  if (row.status === 'accepted') return toRequest(row, (await personRefs([row.fromUserId])).get(row.fromUserId)!);
  if (row.status !== 'pending') throw conflict('invalid_state', 'This request is no longer open.');
  await assertNotBlocked(row.fromUserId, row.toUserId);
  const conv = await getOrCreateConversation(row.fromUserId, row.toUserId, null);
  await addContactPair(row.fromUserId, row.toUserId, conv.$id);
  const updated = await updateRow<ConnectionRequestRow>(TABLES.connectionRequests, id, { status: 'accepted', respondedAt: new Date().toISOString() });
  await emitEvent({ eventType: 'connection.accepted', aggregateType: 'connection_request', aggregateId: id, actorId: actor.$id, payload: {}, requestId });
  return toRequest(updated, (await personRefs([row.fromUserId])).get(row.fromUserId)!);
}

export async function respond(id: string, actor: Models.User, action: 'decline' | 'cancel'): Promise<ConnectionRequest> {
  const row = await getRow<ConnectionRequestRow>(TABLES.connectionRequests, id);
  if (!row) throw notFound('not_found', 'This request could not be found.');
  if (action === 'decline' && row.toUserId !== actor.$id) throw forbidden();
  if (action === 'cancel' && row.fromUserId !== actor.$id) throw forbidden();
  if (row.status !== 'pending') throw conflict('invalid_state', 'This request is no longer open.');
  const updated = await updateRow<ConnectionRequestRow>(TABLES.connectionRequests, id, { status: action === 'decline' ? 'declined' : 'cancelled', respondedAt: new Date().toISOString() });
  const other = row.fromUserId === actor.$id ? row.toUserId : row.fromUserId;
  return toRequest(updated, (await personRefs([other])).get(other)!);
}

export async function cancelPendingBetween(a: string, b: string): Promise<void> {
  const rows = await listRows<ConnectionRequestRow>(TABLES.connectionRequests, [Query.equal('pairKey', pairKey(a, b)), Query.equal('status', 'pending'), Query.limit(5)]);
  await Promise.all(rows.map((r) => updateRow(TABLES.connectionRequests, r.$id, { status: 'cancelled', respondedAt: new Date().toISOString() })));
}

export async function listContacts(userId: string, limit: number, cursor?: string): Promise<{ items: Contact[]; nextCursor: string | null }> {
  const q = [Query.equal('userId', userId), Query.orderDesc('connectedAt'), Query.limit(limit + 1)];
  if (cursor) q.push(Query.cursorAfter(cursor));
  const rows = await listRows<ContactRow>(TABLES.contacts, q);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const refs = await personRefs(page.map((r) => r.contactUserId));
  const last = page[page.length - 1];
  return {
    items: page.map((r) => ({ ...refs.get(r.contactUserId)!, connectedAt: r.connectedAt, conversationId: r.conversationId })),
    nextCursor: hasMore && last ? last.$id : null,
  };
}
