import { Query } from 'node-appwrite';
import type { Conversation, LearningMessage, MessagePayload, MessageType } from '../contracts/api';
import { Permission, Role } from 'node-appwrite';
import { createRow, findOne, getRow, incrementColumn, listRows, updateRow } from '../db/repo';
import { isConflict, pairKey, type ConversationMemberRow, type ConversationRow, type MessageRow } from '../db/rows';
import { TABLES } from '../db/schema';
import { conflict, forbidden, notFound } from '../errors';
import { toConversation, toMessage } from '../mappers/messaging';
import { emitEvent } from './events';
import { personRefs } from './profiles';
import { assertNotBlocked } from './safety';

export async function getOrCreateConversation(a: string, b: string, relationId: string | null): Promise<ConversationRow> {
  const key = pairKey(a, b);
  const existing = await findOne<ConversationRow>(TABLES.conversations, [Query.equal('pairKey', key)]);
  if (existing) {
    if (relationId && existing.relationId !== relationId) return updateRow<ConversationRow>(TABLES.conversations, existing.$id, { relationId });
    return existing;
  }
  let conv: ConversationRow;
  try {
    conv = await createRow<ConversationRow>(TABLES.conversations, { relationId, memberIds: [a, b], pairKey: key, lastSequence: 0, lastMessageAt: null }, undefined, memberReadPermissions([a, b]));
  } catch (err) {
    if (!isConflict(err)) throw err;
    return (await findOne<ConversationRow>(TABLES.conversations, [Query.equal('pairKey', key)]))!;
  }
  for (const userId of [a, b]) {
    try {
      await createRow<ConversationMemberRow>(TABLES.conversationMembers, { conversationId: conv.$id, userId, lastReadSequence: 0 }, `${conv.$id}_${userId}`.slice(0, 36));
    } catch (err) {
      if (!isConflict(err)) throw err;
    }
  }
  return conv;
}

export async function requireMember(conversationId: string, userId: string): Promise<{ conv: ConversationRow; member: ConversationMemberRow }> {
  const conv = await getRow<ConversationRow>(TABLES.conversations, conversationId);
  if (!conv) throw notFound('not_found', 'This conversation could not be found.');
  if (!conv.memberIds.includes(userId)) throw forbidden();
  const member = await findOne<ConversationMemberRow>(TABLES.conversationMembers, [Query.equal('conversationId', conversationId), Query.equal('userId', userId)]);
  if (!member) throw conflict('not_member', 'You are not part of this conversation.');
  return { conv, member };
}

export async function listConversations(userId: string, limit: number, cursor?: string): Promise<{ items: Conversation[]; nextCursor: string | null }> {
  const q = [Query.equal('userId', userId), Query.orderDesc('updatedAt'), Query.limit(limit + 1)];
  if (cursor) q.push(Query.cursorAfter(cursor));
  const members = await listRows<ConversationMemberRow>(TABLES.conversationMembers, q);
  const hasMore = members.length > limit;
  const page = hasMore ? members.slice(0, limit) : members;
  if (!page.length) return { items: [], nextCursor: null };
  const convs = await listRows<ConversationRow>(TABLES.conversations, [Query.equal('$id', page.map((m) => m.conversationId)), Query.limit(page.length)]);
  const convById = new Map(convs.map((c) => [c.$id, c]));
  const others = convs.flatMap((c) => c.memberIds.filter((id) => id !== userId));
  const refs = await personRefs(others);
  const items: Conversation[] = [];
  for (const m of page) {
    const c = convById.get(m.conversationId);
    if (!c) continue;
    const last = c.lastSequence > 0 ? await findOne<MessageRow>(TABLES.messages, [Query.equal('conversationId', c.$id), Query.equal('sequence', c.lastSequence)]) : null;
    const other = c.memberIds.find((id) => id !== userId);
    items.push(toConversation(c, m, last, other ? refs.get(other) ?? null : null));
  }
  items.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
  const lastPage = page[page.length - 1];
  return { items, nextCursor: hasMore && lastPage ? lastPage.$id : null };
}

export async function getConversation(conversationId: string, userId: string): Promise<Conversation> {
  const { conv, member } = await requireMember(conversationId, userId);
  const last = conv.lastSequence > 0 ? await findOne<MessageRow>(TABLES.messages, [Query.equal('conversationId', conv.$id), Query.equal('sequence', conv.lastSequence)]) : null;
  const other = conv.memberIds.find((id) => id !== userId);
  const refs = other ? await personRefs([other]) : new Map();
  return toConversation(conv, member, last, other ? refs.get(other) ?? null : null);
}

export async function listMessages(conversationId: string, userId: string, p: { afterSequence?: number; beforeSequence?: number; limit: number }): Promise<{ items: LearningMessage[]; nextCursor: string | null }> {
  await requireMember(conversationId, userId);
  const q = [Query.equal('conversationId', conversationId), Query.limit(p.limit + 1)];
  if (p.afterSequence !== undefined) q.push(Query.greaterThan('sequence', p.afterSequence), Query.orderAsc('sequence'));
  else {
    if (p.beforeSequence !== undefined) q.push(Query.lessThan('sequence', p.beforeSequence));
    q.push(Query.orderDesc('sequence'));
  }
  const rows = await listRows<MessageRow>(TABLES.messages, q);
  const hasMore = rows.length > p.limit;
  const page = hasMore ? rows.slice(0, p.limit) : rows;
  const items = page.map(toMessage);
  if (p.afterSequence === undefined) items.reverse();
  const edge = p.afterSequence !== undefined ? items[items.length - 1] : items[0];
  return { items, nextCursor: hasMore && edge ? String(edge.sequence) : null };
}

/**
 * Append a message with a monotonically increasing per-conversation sequence.
 * Sequence comes from an atomic increment on the conversation row; the unique
 * (conversationId, sequence) index guards against duplicates. Dedupe by
 * (conversationId, senderId, clientMessageId).
 */
/**
 * Row-level read permissions for conversation members. Business tables are
 * otherwise closed to clients; this is the minimal grant that lets the app
 * subscribe to Appwrite Realtime for low-latency hints. Correctness still
 * comes from the /messages?afterSequence incremental API.
 */
export const memberReadPermissions = (memberIds: string[]): string[] => memberIds.map((id) => Permission.read(Role.user(id)));

export async function appendMessage(input: {
  conversationId: string; senderId: string; type: MessageType; payload: MessagePayload; clientMessageId?: string | null; requestId?: string;
}): Promise<LearningMessage> {
  const dedupeKey = input.clientMessageId ? `${input.conversationId}:${input.senderId}:${input.clientMessageId}`.slice(0, 120) : null;
  if (dedupeKey) {
    const dup = await findOne<MessageRow>(TABLES.messages, [Query.equal('dedupeKey', dedupeKey)]);
    if (dup) return toMessage(dup);
  }
  const conv = await incrementColumn<ConversationRow>(TABLES.conversations, input.conversationId, 'lastSequence', 1);
  const sequence = conv.lastSequence;
  let row: MessageRow;
  try {
    row = await createRow<MessageRow>(TABLES.messages, {
      conversationId: input.conversationId, sequence, senderId: input.senderId, type: input.type, payloadVersion: 1,
      payloadJson: JSON.stringify(input.payload), clientMessageId: input.clientMessageId ?? null, dedupeKey, removedAt: null,
    }, undefined, memberReadPermissions(conv.memberIds));
  } catch (err) {
    if (isConflict(err) && dedupeKey) {
      const dup = await findOne<MessageRow>(TABLES.messages, [Query.equal('dedupeKey', dedupeKey)]);
      if (dup) return toMessage(dup);
    }
    throw err;
  }
  const now = row.createdAt;
  await updateRow(TABLES.conversations, input.conversationId, { lastMessageAt: now });
  // Bump member rows so conversation lists sort by activity; sender's read pointer moves forward.
  const members = await listRows<ConversationMemberRow>(TABLES.conversationMembers, [Query.equal('conversationId', input.conversationId), Query.limit(10)]);
  await Promise.all(members.map((m) => updateRow(TABLES.conversationMembers, m.$id, m.userId === input.senderId ? { lastReadSequence: Math.max(m.lastReadSequence, sequence) } : {})));
  await emitEvent({ eventType: 'message.sent', aggregateType: 'conversation', aggregateId: input.conversationId, actorId: input.senderId, payload: { sequence, type: input.type }, requestId: input.requestId });
  return toMessage(row);
}

export async function sendText(conversationId: string, senderId: string, text: string, clientMessageId: string, requestId?: string): Promise<LearningMessage> {
  const { conv } = await requireMember(conversationId, senderId);
  const other = conv.memberIds.find((id) => id !== senderId);
  if (other) await assertNotBlocked(senderId, other);
  return appendMessage({ conversationId, senderId, type: 'text', payload: { type: 'text', text }, clientMessageId, requestId });
}

/** Read position only moves forward. */
export async function markRead(conversationId: string, userId: string, sequence: number): Promise<Conversation> {
  const { conv, member } = await requireMember(conversationId, userId);
  const next = Math.min(Math.max(member.lastReadSequence, sequence), conv.lastSequence);
  if (next !== member.lastReadSequence) await updateRow(TABLES.conversationMembers, member.$id, { lastReadSequence: next });
  return getConversation(conversationId, userId);
}
