import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMe } from '@/features/identity/api';
import { useConversation, useMessages, type LocalMessage } from '@/features/messaging/api';
import { messagePreview } from '@/features/messaging/preview';
import { Button, ErrorState, Input, Loading, Text } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { fmt, t } from '@/shared/i18n';

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const me = useMe();
  const conv = useConversation(id);
  const msgs = useMessages(id);
  const [text, setText] = useState('');
  const list = useRef<FlatList<LocalMessage>>(null);
  const data = useMemo(() => (msgs.data ?? []).slice().reverse(), [msgs.data]);
  const myId = me.data?.userId;
  const send = () => {
    const v = text.trim();
    if (!v) return;
    msgs.sendText(v);
    setText('');
  };
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen options={{
        title: conv.data?.counterpart?.displayName ?? t('messages.title'),
        headerRight: conv.data?.relationId ? () => <Button size="sm" variant="ghost" title={t('relation.workspace')} onPress={() => router.push(`/(app)/relations/${conv.data!.relationId}`)} /> : undefined,
      }} />
      {msgs.isLoading ? <Loading /> : msgs.isError && !msgs.data ? <ErrorState error={msgs.error} onRetry={() => msgs.refetch()} /> : (
        <FlatList
          ref={list}
          inverted
          data={data}
          keyExtractor={(m) => m.id}
          contentContainerClassName="px-4 py-3 gap-1"
          renderItem={({ item }) => <Bubble m={item} mine={item.senderId === myId || item.senderId === 'me'} onRetry={() => msgs.retry(item)} onOpen={(relId) => router.push(`/(app)/relations/${relId}`)} relationId={conv.data?.relationId ?? null} />}
        />
      )}
      <View className="flex-row items-end gap-2 border-t border-border bg-surface px-3 py-2">
        <Input containerClassName="flex-1" value={text} onChangeText={setText} placeholder={t('messages.placeholder')} multiline maxLength={4000} className="max-h-[120px] min-h-[44px] py-2" onSubmitEditing={send} blurOnSubmit={false} />
        <Button title={t('common.send')} onPress={send} disabled={!text.trim()} />
      </View>
    </SafeAreaView>
  );
}

function Bubble({ m, mine, onRetry, onOpen, relationId }: { m: LocalMessage; mine: boolean; onRetry: () => void; onOpen: (relationId: string) => void; relationId: string | null }) {
  if (m.type !== 'text') {
    return (
      <Pressable disabled={!relationId} onPress={() => relationId && onOpen(relationId)} className="my-1 items-center">
        <View className="max-w-[85%] rounded-full bg-element px-3 py-1"><Text variant="caption" tone="secondary" className="text-center">{messagePreview(m)}</Text></View>
      </Pressable>
    );
  }
  const failed = m.localStatus === 'failed';
  return (
    <Pressable disabled={!failed} onPress={onRetry} className={cn('my-0.5 max-w-[80%]', mine ? 'self-end' : 'self-start')}>
      <View className={cn('rounded-lg px-3 py-2', mine ? 'bg-primary' : 'bg-surface border border-border', m.localStatus === 'sending' && 'opacity-60', failed && 'bg-danger-subtle')}>
        <Text tone={mine && !failed ? 'onPrimary' : 'default'}>{m.payload.type === 'text' ? m.payload.text : ''}</Text>
      </View>
      <Text variant="caption" tone={failed ? 'danger' : 'tertiary'} className={cn('mt-0.5', mine ? 'text-right' : '')}>
        {failed ? t('messages.failed') : m.localStatus === 'sending' ? t('messages.sending') : fmt.time(m.createdAt)}
      </Text>
    </Pressable>
  );
}
