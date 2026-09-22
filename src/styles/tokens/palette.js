/**
 * Design tokens — colours. Single source of truth for Tailwind (via
 * tailwind.config.js → CSS variables + utilities) and for the few runtime
 * places that need a raw colour string (navigation theme, ActivityIndicator).
 *
 * Plain CommonJS so the Tailwind CLI can require() it without a TS step.
 * Quiet, trustworthy, low-stimulation palette: one neutral scale + one
 * restrained accent. Roles differ only by a subtle semantic tint.
 */
const light = {
  // Brand accent
  primary: '#2F6FED',
  primaryPressed: '#255CC7',
  primarySubtle: '#EAF0FD',
  onPrimary: '#FFFFFF',
  // Surfaces
  background: '#F7F8FA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  element: '#F0F1F4',
  selected: '#E2E5EB',
  border: '#E3E6EA',
  borderStrong: '#C9CED6',
  overlay: 'rgba(17,20,24,0.45)',
  skeleton: '#E9ECEF',
  // Text
  foreground: '#111418',
  foregroundSecondary: '#5F6570',
  foregroundTertiary: '#8A9099',
  // Semantic status
  success: '#1E8E3E',
  successSubtle: '#E6F4EA',
  warning: '#9A5B00',
  warningSubtle: '#FFF4E0',
  danger: '#C62828',
  dangerSubtle: '#FDECEA',
  info: '#2F6FED',
  infoSubtle: '#EAF0FD',
  // Role tints (subtle; never two different products)
  student: '#2F6FED',
  teacher: '#0E8A7A',
  focusRing: '#2F6FED',
};

const dark = {
  primary: '#7AA2F7',
  primaryPressed: '#5F8AE0',
  primarySubtle: '#16233D',
  onPrimary: '#0B1220',
  background: '#0F1115',
  surface: '#181B21',
  surfaceElevated: '#1F232B',
  element: '#212225',
  selected: '#2E3135',
  border: '#2A2F38',
  borderStrong: '#3B4250',
  overlay: 'rgba(0,0,0,0.6)',
  skeleton: '#242933',
  foreground: '#F2F4F7',
  foregroundSecondary: '#B0B4BA',
  foregroundTertiary: '#7D848F',
  success: '#4CC26A',
  successSubtle: '#12301B',
  warning: '#F5B342',
  warningSubtle: '#3A2A0C',
  danger: '#F28B82',
  dangerSubtle: '#3B1A18',
  info: '#7AA2F7',
  infoSubtle: '#16233D',
  student: '#7AA2F7',
  teacher: '#4FBFAE',
  focusRing: '#7AA2F7',
};

/** camelCase token → kebab-case Tailwind colour name. */
const tailwindNames = Object.fromEntries(
  Object.keys(light).map((k) => [k, k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)]),
);

module.exports = { light, dark, tailwindNames };
