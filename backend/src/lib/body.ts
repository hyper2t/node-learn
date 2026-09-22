import type { Context } from 'hono';
import type { ZodTypeAny, z } from 'zod';
import { validation } from '../errors';

export async function readJsonBody<S extends ZodTypeAny>(c: Context, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw validation('The request body is not valid JSON.');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw validation(
      'Some fields are not valid.',
      parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return parsed.data;
}

export function readQuery<S extends ZodTypeAny>(c: Context, schema: S): z.infer<S> {
  const parsed = schema.safeParse(c.req.query());
  if (!parsed.success) {
    throw validation(
      'Some query parameters are not valid.',
      parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return parsed.data;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

/** `limit + 1` fetch → { items, nextCursor } without a count query. */
export function slicePage<T extends { $id: string }>(rows: T[], limit: number): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return { items, nextCursor: hasMore && last ? last.$id : null };
}

export function idempotencyKeyOf(c: Context): string | null {
  const key = c.req.header('idempotency-key')?.trim();
  return key && key.length <= 128 ? key : null;
}
