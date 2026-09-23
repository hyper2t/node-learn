import { ID, Permission, Query, Role, type Models } from 'node-appwrite';
// InputFile ships from a separate subpath export in node-appwrite v29.
import { InputFile } from 'node-appwrite/file';
import { getConfig } from '../config';
import { getRow, updateRow } from '../db/repo';
import { getStorage, getUsers } from '../db/client';
import type { ProfileRow } from '../db/rows';
import { TABLES } from '../db/schema';

/**
 * Adopt the Google / Notion profile picture as the account avatar.
 *
 * Appwrite does not expose the provider's picture on the user object, so we
 * read it from the OAuth identity's provider access token, fetch the image
 * once, and store it in the existing `avatars` bucket. Everything downstream
 * (Me.avatarFileId, PersonRef, the Avatar component) keeps working unchanged.
 *
 * Runs best-effort: any failure leaves the profile untouched and the UI falls
 * back to initials. Never throws into the request path.
 */

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = /^image\/(jpeg|png|webp|gif)$/;
const FETCH_TIMEOUT_MS = 5_000;

type Identity = Models.Identity;

/** Google: userinfo carries `picture`. Notion: /v1/users/me carries avatar_url. */
async function pictureUrlFor(identity: Identity): Promise<string | null> {
  const token = identity.providerAccessToken;
  if (!token) return null;
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);

  if (identity.provider === 'google') {
    const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { picture?: string };
    return body.picture ?? null;
  }

  if (identity.provider === 'notion') {
    const res = await fetch('https://api.notion.com/v1/users/me', {
      headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28' },
      signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { avatar_url?: string; bot?: { owner?: { user?: { avatar_url?: string } } } };
    return body.avatar_url ?? body.bot?.owner?.user?.avatar_url ?? null;
  }

  return null;
}

async function download(url: string): Promise<{ bytes: Buffer; mime: string } | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) return null;
  const mime = (res.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? '';
  if (!ALLOWED.test(mime)) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length || buf.length > MAX_BYTES) return null;
  return { bytes: buf, mime };
}

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/**
 * Called after sign-in when the profile has no avatar yet. Existing avatars are
 * never overwritten: a picture the member uploaded themselves wins.
 */
export async function syncOAuthAvatar(user: Models.User, profile: ProfileRow): Promise<string | null> {
  if (profile.avatarFileId) return profile.avatarFileId;

  try {
    const res = await getUsers().listIdentities({ queries: [Query.equal('userId', user.$id)] });
    const identity = res.identities.find((i) => i.provider === 'google' || i.provider === 'notion');
    if (!identity) return null;

    const url = await pictureUrlFor(identity);
    if (!url) return null;

    const image = await download(url);
    if (!image) return null;

    const bucketId = getConfig().appwrite.avatarBucketId;
    const fileId = ID.unique();
    await getStorage().createFile({
      bucketId,
      fileId,
      file: InputFile.fromBuffer(image.bytes, `avatar-${user.$id}.${EXT[image.mime] ?? 'jpg'}`),
      permissions: [Permission.read(Role.any()), Permission.delete(Role.user(user.$id))],
    });

    // Re-read: another request may have set an avatar while we were fetching.
    const fresh = await getRow<ProfileRow>(TABLES.profiles, user.$id);
    if (fresh?.avatarFileId) {
      await getStorage().deleteFile({ bucketId, fileId }).catch(() => undefined);
      return fresh.avatarFileId;
    }

    await updateRow(TABLES.profiles, user.$id, { avatarFileId: fileId });
    return fileId;
  } catch {
    return null;
  }
}
