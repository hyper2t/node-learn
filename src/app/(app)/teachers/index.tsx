import { useState } from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTeacherSearch } from '@/features/teachers/api';
import { Grid, Screen } from '@/shared/layout/screen';
import { Avatar, Badge, Button, Checkbox, Empty, ErrorState, Input, PressableCard, SegmentedControl, SkeletonList, Text } from '@/shared/ui';
import type { TeacherSort } from '@/types/api';
import { t } from '@/shared/i18n';
import { useDebounced } from '@/shared/hooks/use-debounced';

export default function TeachersScreen() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 300);
  const [subject, setSubject] = useState('');
  const dsubject = useDebounced(subject.trim(), 300);
  const [accepting, setAccepting] = useState(true);
  const [sort, setSort] = useState<TeacherSort>('relevance');
  const [showFilters, setShowFilters] = useState(false);
  const search = useTeacherSearch(dq, { subject: dsubject, accepting, sort });
  const items = search.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <Screen width="wide">
      <Stack.Screen options={{ title: t('teachers.title') }} />
      <View className="gap-3 py-3">
        <View className="flex-row items-center gap-2">
          <View className="flex-1"><Input value={q} onChangeText={setQ} placeholder={t('teachers.search')} autoCapitalize="none" returnKeyType="search" accessibilityLabel={t('teachers.search')} /></View>
          <Button size="sm" variant={showFilters || dsubject || !accepting || sort !== 'relevance' ? 'primary' : 'secondary'} title={t('teachers.filters')} onPress={() => setShowFilters((v) => !v)} />
        </View>
        {showFilters ? (
          <View className="gap-3 rounded-lg border border-border bg-surface p-3">
            <Input value={subject} onChangeText={setSubject} placeholder={t('teachers.subjectPlaceholder')} autoCapitalize="none" accessibilityLabel={t('teachers.subject')} />
            <Checkbox checked={accepting} onChange={setAccepting} label={t('teachers.onlyAccepting')} />
            <Text variant="small-strong" tone="secondary">{t('teachers.sort')}</Text>
            <SegmentedControl value={sort} onChange={setSort} options={[{ value: 'relevance', label: t('teachers.sortRelevance') }, { value: 'newest', label: t('teachers.sortNewest') }, { value: 'most_reviewed', label: t('teachers.sortReviewed') }]} />
          </View>
        ) : null}
        {search.isLoading ? <SkeletonList count={4} /> : search.isError ? <ErrorState error={search.error} onRetry={() => search.refetch()} /> : items.length === 0 ? (
          <Empty title={t('teachers.empty')} />
        ) : (
          <Grid>
          {items.map((tp) => (
          <PressableCard key={tp.userId} onPress={() => router.push(`/(app)/teachers/${tp.userId}`)} className="gap-2">
            <View className="flex-row items-center gap-3">
              <Avatar name={tp.displayName} fileId={tp.avatarFileId} size={44} />
              <View className="flex-1">
                <Text variant="body-strong" numberOfLines={1}>{tp.displayName}</Text>
                <Text variant="small" tone="secondary" numberOfLines={1}>{tp.headline}</Text>
              </View>
              <Badge label={tp.acceptingRequests ? t('teachers.accepting') : t('teachers.notAccepting')} tone={tp.acceptingRequests ? 'success' : 'neutral'} />
            </View>
            <View className="flex-row flex-wrap gap-1">{tp.subjects.slice(0, 5).map((s) => <Badge key={s} label={s} />)}</View>
            <Text variant="caption" tone="tertiary">{t('teachers.selfDeclared')} · {t('teachers.reviewed', { n: tp.signals.evidenceReviewed })}</Text>
          </PressableCard>
          ))}
          </Grid>
        )}
        {search.hasNextPage ? <Button variant="secondary" title={t('common.continue')} loading={search.isFetchingNextPage} onPress={() => search.fetchNextPage()} /> : null}
      </View>
    </Screen>
  );
}
