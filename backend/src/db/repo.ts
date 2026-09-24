import { ID, Query, type Models } from 'node-appwrite';
import { getDatabaseId, getTablesDB } from './client';
import { isRowNotFound, nowIso } from './rows';
import type { TableId } from './schema';

/** Thin generic TablesDB helpers; domain repos compose these. */
export async function getRow<T extends Models.Row>(tableId: TableId, rowId: string): Promise<T | null> {
  try {
    return await getTablesDB().getRow<T>({ databaseId: getDatabaseId(), tableId, rowId });
  } catch (err) {
    if (isRowNotFound(err)) return null;
    throw err;
  }
}

export async function createRow<T extends Models.Row>(tableId: TableId, data: Record<string, unknown>, rowId = ID.unique(), permissions?: string[]): Promise<T> {
  const ts = nowIso();
  const payload = { createdAt: ts, updatedAt: ts, ...data } as never;
  return getTablesDB().createRow<T>({ databaseId: getDatabaseId(), tableId, rowId, data: payload, permissions });
}

export async function updateRow<T extends Models.Row>(tableId: TableId, rowId: string, data: Record<string, unknown>): Promise<T> {
  const payload = { ...data, updatedAt: nowIso() } as never;
  return getTablesDB().updateRow<T>({ databaseId: getDatabaseId(), tableId, rowId, data: payload });
}

export async function deleteRow(tableId: TableId, rowId: string): Promise<void> {
  try {
    await getTablesDB().deleteRow({ databaseId: getDatabaseId(), tableId, rowId });
  } catch (err) {
    if (!isRowNotFound(err)) throw err;
  }
}

export async function listRows<T extends Models.Row>(tableId: TableId, queries: string[]): Promise<T[]> {
  const res = await getTablesDB().listRows<T>({ databaseId: getDatabaseId(), tableId, queries });
  return res.rows;
}

export async function findOne<T extends Models.Row>(tableId: TableId, queries: string[]): Promise<T | null> {
  const rows = await listRows<T>(tableId, [...queries, Query.limit(1)]);
  return rows[0] ?? null;
}

export async function incrementColumn<T extends Models.Row>(tableId: TableId, rowId: string, column: string, value = 1): Promise<T> {
  return getTablesDB().incrementRowColumn<T>({ databaseId: getDatabaseId(), tableId, rowId, column, value });
}

/** Atomic decrement that never goes below `min` (default 0). */
export async function decrementColumn<T extends Models.Row>(tableId: TableId, rowId: string, column: string, value = 1, min = 0): Promise<T> {
  return getTablesDB().decrementRowColumn<T>({ databaseId: getDatabaseId(), tableId, rowId, column, value, min });
}

export { ID, Query };
