import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useConversations, useInboxRealtime } from '@/features/messaging/api';
import { Screen, PageHeader } from '@/shared/layout/screen';
import { Avatar, Badge, Button, Empty, ErrorState, ListRow, Separator, SkeletonList } from '@/shared/ui';
import { fmt, t } from '@/shared/i18n';
import { messagePreview } from '@/features/messaging/preview';

export default function MessagesScreen() {
  const router = useRouter();
  const q = useConversations();
  useInboxRealtime(true);
  return (
    <Screen padded={false}>
      <View className="px-4"><PageHeader title={t('messages.title')} right={<Button size="sm" variant="secondary" title={t('contacts.title')} onPress={() => router.push('/(app)/connections')} />} /></View>
      {q.isLoading ? <SkeletonList count={4} lines={1} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.items.length ? (
        <Empty title={t('messages.empty')} body={t('messages.emptyBody')} />
      ) : (
        <View className="overflow-hidden bg-surface web:mx-6 web:rounded-lg web:border web:border-border">
          {q.data.items.map((c, i) => (
            <View key={c.id}>
              {i > 0 ? <Separator /> : null}
              <ListRow
                title={c.counterpart?.displayName ?? t('messages.system')}
                subtitle={messagePreview(c.lastMessage) || undefined}
                left={<Avatar name={c.counterpart?.displayName ?? '?'} fileId={c.counterpart?.avatarFileId} />}
                right={<View className="items-end gap-1">{c.lastMessage ? <Badge label={fmt.relative(c.lastMessage.createdAt)} /> : null}{c.unreadCount ? <Badge tone="primary" label={String(c.unreadCount)} /> : null}</View>}
                onPress={() => router.push(`/(app)/messages/${c.id}`)}
              />
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
