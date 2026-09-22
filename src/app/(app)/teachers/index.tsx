import { useState } from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTeacherSearch } from '@/features/teachers/api';
import { Screen } from '@/shared/layout/screen';
import { Avatar, Badge, Button, Empty, ErrorState, Input, Loading, PressableCard, Text } from '@/shared/ui';
import { t } from '@/shared/i18n';
import { useDebounced } from '@/shared/hooks/use-debounced';

export default function TeachersScreen() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 300);
  const search = useTeacherSearch(dq);
  const items = search.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <Screen>
      <Stack.Screen options={{ title: t('teachers.title') }} />
      <View className="gap-3 py-3">
        <Input value={q} onChangeText={setQ} placeholder={t('teachers.search')} autoCapitalize="none" returnKeyType="search" accessibilityLabel={t('teachers.search')} />
        {search.isLoading ? <Loading /> : search.isError ? <ErrorState error={search.error} onRetry={() => search.refetch()} /> : items.length === 0 ? (
          <Empty title={t('teachers.empty')} />
        ) : items.map((tp) => (
          <PressableCard key={tp.userId} onPress={() => router.push(`/(app)/teachers/${tp.userId}`)} className="gap-2">
            <View className="flex-row items-center gap-3">
              <Avatar name={tp.displayName} size={44} />
              <View className="flex-1">
                <Text variant="body-strong" numberOfLines={1}>{tp.displayName}</Text>
                <Text variant="small" tone="secondary" numberOfLines={1}>{tp.headline}</Text>
              </View>
              <Badge label={tp.acceptingRequests ? t('teachers.accepting') : t('teachers.notAccepting')} tone={tp.acceptingRequests ? 'success' : 'neutral'} />
            </View>
            <View className="flex-row flex-wrap gap-1">{tp.subjects.slice(0, 5).map((s) => <Badge key={s} label={s} />)}</View>
            <Text variant="caption" tone="tertiary">{t('teachers.selfDeclared')} · {t('teachers.activeRelations', { n: tp.signals.activeRelations })}</Text>
          </PressableCard>
        ))}
        {search.hasNextPage ? <Button variant="secondary" title={t('common.continue')} loading={search.isFetchingNextPage} onPress={() => search.fetchNextPage()} /> : null}
      </View>
    </Screen>
  );
}
