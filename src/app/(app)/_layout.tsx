import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useThemeColors } from '@/shared/hooks/use-theme-colors';
import { useShell } from '@/shared/hooks/use-shell';
import { Sidebar } from '@/shared/layout/sidebar';

/**
 * App shell. On wide web viewports a persistent, collapsible sidebar sits
 * beside the stack; on phones/native the stack fills the screen and the
 * (tabs) group renders the bottom tab bar.
 */
export default function AppLayout() {
  const c = useThemeColors();
  const shell = useShell();
  const stack = (
    <Stack screenOptions={{ headerStyle: { backgroundColor: c.surface }, headerTintColor: c.foreground, headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal', contentStyle: { backgroundColor: c.background } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
  if (shell === 'tabs') return stack;
  return (
    <View className="h-full flex-1 flex-row bg-background">
      <Sidebar />
      <View className="min-w-0 flex-1">{stack}</View>
    </View>
  );
}
