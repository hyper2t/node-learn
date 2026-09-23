import Svg, { Circle, Path } from 'react-native-svg';
import { useThemeColors } from '@/shared/hooks/use-theme-colors';

/**
 * Node Learn mark: three connected nodes - the "nodes before courses" idea,
 * drawn as a relation rather than a hierarchy. Mirrors the portal site mark
 * (site/src/components/Logo.astro); keep the two geometries in sync.
 */
export function Logo({ size = 28 }: { size?: number }) {
  const c = useThemeColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M9 10.5 L23 8 M9 10.5 L17 23 M23 8 L17 23"
        stroke={c.borderStrong}
        strokeWidth={1.6}
        strokeLinecap="round"
        opacity={0.55}
      />
      <Circle cx={9} cy={10.5} r={4} fill={c.primary} />
      <Circle cx={23} cy={8} r={2.75} fill={c.teacher} />
      <Circle cx={17} cy={23} r={2.75} fill={c.primary} opacity={0.5} />
    </Svg>
  );
}
