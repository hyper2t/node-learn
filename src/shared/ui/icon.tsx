import { Platform } from 'react-native';
import Svg, { Path, type SvgProps } from 'react-native-svg';

/** Minimal line-icon set (24px grid, 1.75 stroke) so we don't ship a font. */
const PATHS = {
  home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-5a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0-3a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9a7 7 0 0 1 14 0',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm9 3l-4.3-4.3',
  inbox: 'M4 4h16v16H4zM4 14h4l2 3h4l2-3h4',
  users: 'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-6 9a6 6 0 0 1 12 0M16 4a4 4 0 0 1 0 8m5 9a6 6 0 0 0-4-5.7',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7.5 7.5 0 0 0-1.7-1L14.8 3H9.2l-.4 2.5a7.5 7.5 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.4 7.4 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.5 7.5 0 0 0 1.7 1l.4 2.5h5.6l.4-2.5a7.5 7.5 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1z',
  chevronLeft: 'M15 5l-7 7 7 7',
  chevronRight: 'M9 5l7 7-7 7',
  logout: 'M10 4H5v16h5M14 8l4 4-4 4M8 12h10',
  menu: 'M4 6h16M4 12h16M4 18h16',
  plus: 'M12 5v14M5 12h14',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  filter: 'M4 5h16l-6 8v5l-4 2v-7z',
  close: 'M6 6l12 12M18 6L6 18',
} as const;
export type IconName = keyof typeof PATHS;

/**
 * Icons are decorative by default; the surrounding Pressable/Text carries the label.
 * react-native-svg's web renderer forwards unknown props straight to the DOM <svg>, so the
 * React Native accessibility props must not reach it (React DOM warns "does not recognize the
 * `accessibilityElementsHidden` prop"). Use ARIA on web, RN props on native.
 */
const DECORATIVE: Partial<SvgProps> = Platform.OS === 'web'
  ? { 'aria-hidden': true, focusable: false }
  : { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' };

export function Icon({ name, size = 20, color = 'currentColor', ...rest }: SvgProps & { name: IconName; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...DECORATIVE} {...rest}>
      <Path d={PATHS[name]} />
    </Svg>
  );
}
