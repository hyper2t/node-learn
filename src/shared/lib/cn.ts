import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/** Merge Tailwind classes; custom theme keys registered so e.g. text-h1 isn't dropped as a colour. */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['display', 'h1', 'h2', 'h3', 'body', 'body-strong', 'small', 'small-strong', 'caption'] }],
      'border-w': [{ border: ['hairline'] }],
      shadow: [{ shadow: ['card'] }],
      rounded: [{ rounded: ['xs'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
