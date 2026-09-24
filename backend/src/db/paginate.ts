import type { Models } from 'node-appwrite';
import { Query } from 'node-appwrite';
import { listRows } from './repo';
import type { TableId } from './schema';

const PAGE = 500;

/** Walks every row matching `queries` by $id cursor (no silent truncation). Hard cap guards runaway loops. */
export async function listAllRows<T extends Models.Row>(tableId: TableId, queries: string[], cap = 20_000): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | null = null;
  for (;;) {
    const page: T[] = await listRows<T>(tableId, [...queries, Query.orderAsc('$id'), Query.limit(PAGE), ...(cursor ? [Query.cursorAfter(cursor)] : [])]);
    out.push(...page);
    if (page.length < PAGE || out.length >= cap) return out;
    cursor = page[page.length - 1]!.$id;
  }
}
