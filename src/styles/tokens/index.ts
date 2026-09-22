/**
 * Typed view of the design tokens for the few places that need raw values
 * (navigation theme, ActivityIndicator, icon tint). Components should use
 * NativeWind classes (bg-surface, text-foreground-secondary, …) instead.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const palette = require('./palette') as { light: Record<string, string>; dark: Record<string, string> };

export type ColorToken = keyof typeof palette.light;
export const Colors = { light: palette.light, dark: palette.dark } as const;

export const Breakpoints = { tablet: 768, desktop: 1024 } as const;
export const TouchTarget = 44;
