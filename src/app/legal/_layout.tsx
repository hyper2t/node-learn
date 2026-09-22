import { Stack } from 'expo-router';
import { useThemeColors } from '@/shared/hooks/use-theme-colors';

/** Public routes: reachable signed-out (age gate, auth screens) and signed-in. */
export default function LegalLayout() {
  const c = useThemeColors();
  return <Stack screenOptions={{ headerStyle: { backgroundColor: c.surface }, headerTintColor: c.foreground, headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal', contentStyle: { backgroundColor: c.background } }} />;
}
