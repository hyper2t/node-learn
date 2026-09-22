import { Platform } from 'react-native';
import { useBreakpoint } from './use-breakpoint';

/**
 * Which navigation shell to render. Web at tablet width and above gets a
 * persistent sidebar; phones (and native) keep the bottom tab bar.
 */
export function useShell(): 'sidebar' | 'tabs' {
  const bp = useBreakpoint();
  return Platform.OS === 'web' && bp !== 'phone' ? 'sidebar' : 'tabs';
}
