import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Stack, useRouter, type Href } from 'expo-router';
import { useMarkRead, useNotifications } from '@/features/notifications/api';
import { Screen } from '@/shared/layout/screen';
import { Avatar, Button, Empty, ErrorState, SegmentedControl, SkeletonList, Text } from '@/shared/ui';
import { fmt, t } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import type { Notification } from '@/types/api';

export default function NotificationsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const list = useNotifications(filter === 'unread');
  const mark = useMarkRead();
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  const open = (n: Notification) => {
    if (!n.readAt) mark.mutate({ ids: [n.id] });
    if (n.href) router.push(n.href as Href);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('notifications.title') }} />
      <View className="gap-3 py-3">
        <View className="flex-row items-center gap-2">
          <View className="flex-1"><SegmentedControl value={filter} onChange={setFilter} options={[{ value: 'all', label: t('notifications.all') }, { value: 'unread', label: t('notifications.unread') }]} /></View>
          <Button size="sm" variant="ghost" title={t('notifications.markAllRead')} loading={mark.isPending} onPress={() => mark.mutate({ all: true })} />
        </View>
        {list.isLoading ? <SkeletonList count={5} lines={1} /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : items.length === 0 ? (
          <Empty title={t('notifications.empty')} body={t('notifications.emptyBody')} />
        ) : (
          <View className="rounded-lg border border-border bg-surface">
            {items.map((n, i) => (
              <Pressable
                key={n.id}
                accessibilityRole="button"
                accessibilityLabel={n.title}
                onPress={() => open(n)}
                className={cn('flex-row items-start gap-3 px-4 py-3 hover:bg-element active:bg-selected', i > 0 && 'border-t border-border', !n.readAt && 'bg-primary-subtle/40')}
              >
                <Avatar name={n.actor?.displayName ?? 'K'} fileId={n.actor?.avatarFileId ?? null} size={36} />
                <View className="flex-1 gap-0.5">
                  <View className="flex-row items-center gap-2">
                    {!n.readAt ? <View className="h-2 w-2 rounded-full bg-primary" /> : null}
                    <Text variant={n.readAt ? 'body' : 'body-strong'} className="flex-1" numberOfLines={2}>{n.title}</Text>
                  </View>
                  {n.body ? <Text variant="small" tone="secondary" numberOfLines={2}>{n.body}</Text> : null}
                  <Text variant="caption" tone="tertiary">{n.actor ? `${n.actor.displayName} · ` : ''}{fmt.relative(n.createdAt)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
        {list.hasNextPage ? <Button variant="secondary" title={t('common.continue')} loading={list.isFetchingNextPage} onPress={() => list.fetchNextPage()} /> : null}
      </View>
    </Screen>
  );
}
