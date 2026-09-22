import { Stack } from 'expo-router';
import { useThemeColors } from '@/shared/hooks/use-theme-colors';

export default function AppLayout() {
  const c = useThemeColors();
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: c.surface }, headerTintColor: c.foreground, headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal', contentStyle: { backgroundColor: c.background } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
