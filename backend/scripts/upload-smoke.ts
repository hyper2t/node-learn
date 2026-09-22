/**
 * End-to-end upload check against the running local API + real Appwrite:
 * intent → direct Storage upload (as the user, via a JWT-less admin put with the
 * minted id) → complete → verify permissions. Requires API_DEV_BYPASS_USER_ID.
 */
import { Storage } from 'node-appwrite';
import { getConfig } from '../src/config';
import { getAdminClient } from '../src/db/client';

const cfg = getConfig();
const base = process.env.SMOKE_BASE_URL ?? `http://localhost:${cfg.port}`;
const uid = cfg.devBypassUserId;
if (!uid) { console.log('API_DEV_BYPASS_USER_ID not set: skipped'); process.exit(0); }
const H = { 'X-Dev-User-Id': uid, 'Content-Type': 'application/json' };
const call = async <T>(path: string, init: RequestInit) => {
  const res = await fetch(`${base}${path}`, { ...init, headers: { ...H, ...(init.headers as Record<string, string> | undefined) } });
  const body = (await res.json()) as { data: T; error: { code: string; message: string } | null };
  console.log(res.status, init.method ?? 'GET', path, body.error ? body.error.code : 'ok');
  return { status: res.status, body };
};

const bytes = Buffer.from('89504e470d0a1a0a', 'hex'); // PNG magic only; fine for the metadata check
const intent = await call<{ bucketId: string; fileId: string }>('/v1/uploads/intents', { method: 'POST', body: JSON.stringify({ purpose: 'avatar', fileName: 'a.png', mimeType: 'image/png', sizeBytes: bytes.length }) });
if (intent.status !== 201) throw new Error('intent failed');
const { bucketId, fileId } = intent.body.data;
// Reject: complete before upload
const early = await call('/v1/uploads/complete', { method: 'POST', body: JSON.stringify({ fileId }) });
if (early.status !== 409) throw new Error('expected 409 before upload');
await new Storage(getAdminClient()).createFile({ bucketId, fileId, file: new File([bytes], 'a.png', { type: 'image/png' }) });
const done = await call<{ fileId: string }>('/v1/uploads/complete', { method: 'POST', body: JSON.stringify({ fileId }) });
if (done.status !== 200) throw new Error('complete failed');
const me = await call<{ avatarFileId: string | null }>('/v1/me', { method: 'GET' });
if (me.body.data.avatarFileId !== fileId) throw new Error('avatar not bound');
// Reject: oversize + bad mime
const big = await call('/v1/uploads/intents', { method: 'POST', body: JSON.stringify({ purpose: 'avatar', fileName: 'x.png', mimeType: 'image/png', sizeBytes: 3 * 1024 * 1024 }) });
const mime = await call('/v1/uploads/intents', { method: 'POST', body: JSON.stringify({ purpose: 'avatar', fileName: 'x.exe', mimeType: 'application/x-msdownload', sizeBytes: 10 }) });
if (big.status !== 422 || mime.status !== 422) throw new Error('expected validation errors');
console.log('upload smoke ok');
