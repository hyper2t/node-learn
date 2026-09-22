import { Pressable, View } from 'react-native';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useMe, useSignOut } from '@/features/identity/api';
import { useConversations } from '@/features/messaging/api';
import { useUnreadCount } from '@/features/notifications/api';
import { useUiStore } from '@/state/ui';
import { useThemeColors } from '@/shared/hooks/use-theme-colors';
import { cn } from '@/shared/lib/cn';
import { t } from '@/shared/i18n';
import { Avatar, Badge, Text } from '@/shared/ui';
import { Icon, type IconName } from '@/shared/ui/icon';

type Item = { href: Href; icon: IconName; label: string; match: (p: string) => boolean; badge?: number };

export const SIDEBAR_WIDTH = { expanded: 248, collapsed: 72 } as const;

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const c = useThemeColors();
  const me = useMe();
  const conv = useConversations(!!me.data);
  const notif = useUnreadCount(!!me.data);
  const signOut = useSignOut();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const teacher = me.data?.activeRole === 'teacher';
  const unread = (conv.data?.items ?? []).reduce((n, x) => n + x.unreadCount, 0);

  const primary: Item[] = [
    { href: '/(app)/(tabs)', icon: 'home', label: teacher ? t('tabs.workbench') : t('tabs.home'), match: (p) => p === '/' },
    { href: '/(app)/(tabs)/learning', icon: 'target', label: teacher ? t('tabs.students') : t('tabs.learning'), match: (p) => p === '/learning' || p.startsWith('/relations') },
    { href: '/(app)/(tabs)/messages', icon: 'mail', label: t('tabs.messages'), match: (p) => p.startsWith('/messages'), badge: unread },
    { href: '/(app)/(tabs)/profile', icon: 'user', label: t('tabs.profile'), match: (p) => p === '/profile' },
  ];
  const secondary: Item[] = [
    ...(!teacher ? [{ href: '/(app)/teachers' as Href, icon: 'search' as IconName, label: t('teachers.title'), match: (p: string) => p.startsWith('/teachers') }] : []),
    { href: '/(app)/requests', icon: 'inbox', label: t('requests.title'), match: (p) => p.startsWith('/requests') },
    { href: '/(app)/connections', icon: 'users', label: t('contacts.title'), match: (p) => p.startsWith('/connections') },
    { href: '/(app)/notifications', icon: 'bell', label: t('notifications.title'), match: (p) => p.startsWith('/notifications'), badge: notif.data?.unread ?? 0 },
    ...(me.data?.isAdmin ? [{ href: '/(app)/admin/reports' as Href, icon: 'shield' as IconName, label: t('admin.title'), match: (p: string) => p.startsWith('/admin') }] : []),
    { href: '/(app)/settings', icon: 'settings', label: t('profile.settings'), match: (p) => p.startsWith('/settings') },
  ];

  const renderItem = (it: Item) => {
    const active = it.match(pathname);
    return (
      <Pressable
        key={it.label}
        accessibilityRole="link"
        accessibilityState={{ selected: active }}
        accessibilityLabel={it.label}
        onPress={() => router.push(it.href)}
        className={cn('h-11 flex-row items-center rounded-md', collapsed ? 'justify-center px-0' : 'gap-3 px-3', active ? 'bg-primary-subtle' : 'hover:bg-element active:bg-selected')}
      >
        <View>
          <Icon name={it.icon} color={active ? c.primary : c.foregroundSecondary} />
          {collapsed && it.badge ? <View className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full bg-primary" /> : null}
        </View>
        {!collapsed ? <Text variant="small-strong" tone={active ? 'primary' : 'secondary'} className="flex-1" numberOfLines={1}>{it.label}</Text> : null}
        {!collapsed && it.badge ? <Badge tone="primary" label={String(it.badge)} /> : null}
      </Pressable>
    );
  };

  return (
    <View
      accessibilityRole="menu"
      style={{ width: collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded }}
      className="h-full border-r border-border bg-surface px-3 py-4 transition-all duration-base"
    >
      <View className={cn('mb-6 flex-row items-center', collapsed ? 'justify-center' : 'justify-between px-1')}>
        {!collapsed ? <Text variant="h3" tone="primary">{t('app.name')}</Text> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onPress={toggle}
          className="h-9 w-9 items-center justify-center rounded-md hover:bg-element active:bg-selected"
        >
          <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} color={c.foregroundSecondary} size={18} />
        </Pressable>
      </View>

      <View className="gap-1">{primary.map(renderItem)}</View>
      <View className="my-4 h-hairline bg-border" />
      <View className="gap-1">{secondary.map(renderItem)}</View>

      <View className="flex-1" />

      {me.data ? (
        <View className={cn('flex-row items-center rounded-md py-2', collapsed ? 'justify-center' : 'gap-3 px-2')}>
          <Avatar name={me.data.displayName} fileId={me.data.avatarFileId} size={32} />
          {!collapsed ? (
            <View className="flex-1">
              <Text variant="small-strong" numberOfLines={1}>{me.data.displayName}</Text>
              <Text variant="caption" tone="tertiary" numberOfLines={1}>{me.data.activeRole ? t(`role.${me.data.activeRole}`) : ''}</Text>
            </View>
          ) : null}
          {!collapsed ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.signOut')} onPress={() => signOut.mutate()} className="h-9 w-9 items-center justify-center rounded-md hover:bg-element">
              <Icon name="logout" color={c.foregroundTertiary} size={18} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
