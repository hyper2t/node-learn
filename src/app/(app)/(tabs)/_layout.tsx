import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useMe } from '@/features/identity/api';
import { useConversations } from '@/features/messaging/api';
import { useThemeColors } from '@/shared/hooks/use-theme-colors';
import { t } from '@/shared/i18n';

const GLYPH: Record<string, string> = { index: '⌂', learning: '◎', messages: '✉', profile: '☺' };
function Icon({ name, color }: { name: string; color: string | import('react-native').ColorValue }) {
  return <Text style={{ color: color as string, fontSize: 20, lineHeight: 24 }} accessibilityElementsHidden>{GLYPH[name] ?? '•'}</Text>;
}

export default function TabsLayout() {
  const c = useThemeColors();
  const me = useMe();
  const conv = useConversations(!!me.data);
  const unread = (conv.data?.items ?? []).reduce((n, x) => n + x.unreadCount, 0);
  const teacher = me.data?.activeRole === 'teacher';
  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarActiveTintColor: c.primary, tabBarInactiveTintColor: c.foregroundTertiary,
      tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border }, tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
    }}>
      <Tabs.Screen name="index" options={{ title: teacher ? t('tabs.workbench') : t('tabs.home'), tabBarIcon: ({ color }) => <Icon name="index" color={color} /> }} />
      <Tabs.Screen name="learning" options={{ title: teacher ? t('tabs.students') : t('tabs.learning'), tabBarIcon: ({ color }) => <Icon name="learning" color={color} /> }} />
      <Tabs.Screen name="messages" options={{ title: t('tabs.messages'), tabBarBadge: unread > 0 ? unread : undefined, tabBarIcon: ({ color }) => <Icon name="messages" color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: ({ color }) => <Icon name="profile" color={color} /> }} />
    </Tabs>
  );
}
