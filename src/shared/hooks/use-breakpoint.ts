import { useWindowDimensions } from 'react-native';
import { Breakpoints } from '@/styles/tokens';

export type Breakpoint = 'phone' | 'tablet' | 'desktop';
export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  if (width >= Breakpoints.desktop) return 'desktop';
  if (width >= Breakpoints.tablet) return 'tablet';
  return 'phone';
}
