import { en } from './en';

type PathsOf<T, P extends string = ''> = T extends string
  ? P
  : { [K in keyof T & string]: PathsOf<T[K], P extends '' ? K : `${P}.${K}`> }[keyof T & string];
export type I18nKey = PathsOf<typeof en>;

const locales = { en } as const;
let active: keyof typeof locales = 'en';
export function setLocale(l: keyof typeof locales): void {
  active = l;
}

function lookup(key: string): string {
  const parts = key.split('.');
  let cur: unknown = locales[active];
  for (const p of parts) cur = cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[p] : undefined;
  return typeof cur === 'string' ? cur : key;
}

/** t('auth.continueWith', { provider: 'Google' }) */
export function t(key: I18nKey, vars?: Record<string, string | number>): string {
  const s = lookup(key);
  return vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : s;
}

/** Formatting through Intl; store UTC, render local. */
export const fmt = {
  date: (iso: string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) => new Intl.DateTimeFormat(undefined, opts).format(new Date(iso)),
  time: (iso: string) => new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(iso)),
  relative(iso: string): string {
    const diff = (new Date(iso).getTime() - Date.now()) / 1000;
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    const abs = Math.abs(diff);
    if (abs < 60) return rtf.format(Math.round(diff), 'second');
    if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
    if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
    return fmt.date(iso);
  },
};
