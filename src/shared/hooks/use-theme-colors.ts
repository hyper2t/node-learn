import { useColorScheme } from 'react-native';
import { Colors } from '@/styles/tokens';

/** Raw token values for the rare places className can't reach (nav theme, spinners). */
export function useThemeColors() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? Colors.dark : Colors.light;
}
