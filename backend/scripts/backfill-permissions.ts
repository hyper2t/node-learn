/**
 * One-off: grant conversation members row read permission on existing
 * conversations and messages so Appwrite Realtime can deliver hints.
 * Idempotent; safe to re-run.   npm --prefix backend run backfill:permissions
 */
import { Query } from 'node-appwrite';
import { getDatabaseId, getTablesDB } from '../src/db/client';
import { TABLES } from '../src/db/schema';
import type { ConversationRow, MessageRow } from '../src/db/rows';
import { memberReadPermissions } from '../src/services/messaging';

const db = getTablesDB();
const databaseId = getDatabaseId();
let convs = 0, msgs = 0;
let cursor: string | undefined;
for (;;) {
  const q = [Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : [])];
  const page = await db.listRows<ConversationRow>({ databaseId, tableId: TABLES.conversations, queries: q });
  for (const c of page.rows) {
    const perms = memberReadPermissions(c.memberIds);
    await db.updateRow({ databaseId, tableId: TABLES.conversations, rowId: c.$id, permissions: perms });
    convs++;
    let mcursor: string | undefined;
    for (;;) {
      const mq = [Query.equal('conversationId', c.$id), Query.limit(100), ...(mcursor ? [Query.cursorAfter(mcursor)] : [])];
      const mpage = await db.listRows<MessageRow>({ databaseId, tableId: TABLES.messages, queries: mq });
      for (const m of mpage.rows) { await db.updateRow({ databaseId, tableId: TABLES.messages, rowId: m.$id, permissions: perms }); msgs++; }
      if (mpage.rows.length < 100) break;
      mcursor = mpage.rows[mpage.rows.length - 1]!.$id;
    }
  }
  if (page.rows.length < 100) break;
  cursor = page.rows[page.rows.length - 1]!.$id;
}
console.log(`backfilled permissions: conversations=${convs} messages=${msgs}`);
