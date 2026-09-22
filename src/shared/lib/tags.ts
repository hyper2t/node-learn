/** Tag-list helpers shared by TagPicker and its unit tests. Pure: no RN imports. */
export const MAX_TAGS = 10;

export function normalizeTag(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

export function hasTag(list: string[], tag: string): boolean {
  const n = normalizeTag(tag).toLowerCase();
  return list.some((x) => x.toLowerCase() === n);
}

/** Adds one tag (trimmed, de-duplicated case-insensitively, capped at `max`). Same reference when nothing changed. */
export function addTag(list: string[], raw: string, max: number = MAX_TAGS): string[] {
  const tag = normalizeTag(raw);
  if (!tag || list.length >= max || hasTag(list, tag)) return list;
  return [...list, tag];
}

export function removeTag(list: string[], tag: string): string[] {
  return list.filter((x) => x !== tag);
}

/** Folds a pasted comma-separated string into `list`, up to `max`. */
export function addMany(list: string[], raw: string, max: number = MAX_TAGS): string[] {
  let out = list;
  for (const part of raw.split(',')) out = addTag(out, part, max);
  return out;
}
