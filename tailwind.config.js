// Tailwind CSS v3 + NativeWind v4. Theme is driven by src/styles/tokens.
const { hairlineWidth, platformSelect } = require('nativewind/theme');
const { light, dark, tailwindNames } = require('./src/styles/tokens/palette');

const isNative = Boolean(process.env.NATIVEWIND_OS) && process.env.NATIVEWIND_OS !== 'web';

function toCssVars(palette) {
  return Object.fromEntries(Object.entries(palette).map(([k, v]) => [`--color-${tailwindNames[k]}`, v]));
}
const colorNames = Object.values(tailwindNames);
const colors = Object.fromEntries(colorNames.map((n) => [n, `var(--color-${n})`]));

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  safelist: colorNames.flatMap((n) => [`text-${n}`, `bg-${n}`, `border-${n}`]),
  darkMode: 'media',
  theme: {
    borderRadius: { none: '0px', xs: '4px', sm: '6px', DEFAULT: '10px', md: '10px', lg: '14px', xl: '20px', full: '9999px' },
    extend: {
      colors,
      fontFamily: {
        sans: isNative ? platformSelect({ ios: 'system-ui', android: 'normal' }) : 'var(--font-display)',
        mono: isNative ? platformSelect({ ios: 'ui-monospace', android: 'monospace' }) : 'var(--font-mono)',
      },
      fontSize: {
        display: ['32px', { lineHeight: '40px', fontWeight: '700' }],
        h1: ['24px', { lineHeight: '32px', fontWeight: '700' }],
        h2: ['20px', { lineHeight: '28px', fontWeight: '600' }],
        h3: ['17px', { lineHeight: '24px', fontWeight: '600' }],
        body: ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-strong': ['16px', { lineHeight: '24px', fontWeight: '600' }],
        small: ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'small-strong': ['14px', { lineHeight: '20px', fontWeight: '600' }],
        caption: ['12px', { lineHeight: '16px', fontWeight: '500' }],
      },
      borderWidth: { hairline: hairlineWidth() },
      boxShadow: { card: '0 1px 2px rgba(11,18,32,0.06), 0 2px 8px rgba(11,18,32,0.04)' },
      transitionDuration: { fast: '150ms', base: '200ms', slow: '250ms' },
      maxWidth: { tablet: '960px', desktop: '1200px', form: '440px' },
      spacing: { touch: '44px', header: '56px', sidebar: '240px' },
      zIndex: { header: '100', toast: '1000' },
    },
  },
  plugins: [
    ({ addBase }) =>
      addBase({
        ':root': toCssVars(light),
        '@media (prefers-color-scheme: dark)': { ':root': toCssVars(dark) },
      }),
  ],
};
