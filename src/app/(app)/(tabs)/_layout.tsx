import { Tabs } from 'expo-router';
import { useShell } from '@/shared/hooks/use-shell';
import { Icon } from '@/shared/ui/icon';
import { useMe } from '@/features/identity/api';
import { useConversations } from '@/features/messaging/api';
import { useThemeColors } from '@/shared/hooks/use-theme-colors';
import { t } from '@/shared/i18n';

export default function TabsLayout() {
  const c = useThemeColors();
  const shell = useShell();
  const me = useMe();
  const conv = useConversations(!!me.data);
  const unread = (conv.data?.items ?? []).reduce((n, x) => n + x.unreadCount, 0);
  const teacher = me.data?.activeRole === 'teacher';
  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarActiveTintColor: c.primary, tabBarInactiveTintColor: c.foregroundTertiary,
      tabBarStyle: shell === 'sidebar' ? { display: 'none' } : { backgroundColor: c.surface, borderTopColor: c.border }, tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
    }}>
      <Tabs.Screen name="index" options={{ title: teacher ? t('tabs.workbench') : t('tabs.home'), tabBarIcon: ({ color }) => <Icon name="home" color={String(color)} size={22} /> }} />
      <Tabs.Screen name="learning" options={{ title: teacher ? t('tabs.students') : t('tabs.learning'), tabBarIcon: ({ color }) => <Icon name="target" color={String(color)} size={22} /> }} />
      <Tabs.Screen name="messages" options={{ title: t('tabs.messages'), tabBarBadge: unread > 0 ? unread : undefined, tabBarIcon: ({ color }) => <Icon name="mail" color={String(color)} size={22} /> }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: ({ color }) => <Icon name="user" color={String(color)} size={22} /> }} />
    </Tabs>
  );
}
