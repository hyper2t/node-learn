import { useState } from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMe } from '@/features/identity/api';
import { useQaQuestions } from '@/features/qa/api';
import { QuestionCard, topicLabel } from '@/features/qa/components';
import { PageHeader, Screen } from '@/shared/layout/screen';
import { Button, Empty, ErrorState, SegmentedControl, SkeletonList } from '@/shared/ui';
import { t } from '@/shared/i18n';
import { QA_TOPICS, type QaQuestionStatus, type QaTopicSlug } from '@/types/api';

type Filter = 'all' | QaQuestionStatus;

export default function QaTopicScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const me = useMe();
  const topic = QA_TOPICS.find((x) => x.slug === slug)?.slug as QaTopicSlug | undefined;
  const [filter, setFilter] = useState<Filter>('open');
  const list = useQaQuestions({ topic, status: filter === 'all' ? undefined : filter });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const isStudent = me.data?.availableRoles.includes('student') ?? false;
  const ask = () => router.push({ pathname: '/(app)/qa/ask', params: { topic } });

  if (!topic) return <Screen><Empty title={t('qa.empty')} /></Screen>;
  return (
    <Screen>
      <Stack.Screen options={{ title: topicLabel(topic) }} />
      <PageHeader title={topicLabel(topic)} right={isStudent ? <Button size="sm" title={t('qa.ask')} onPress={ask} /> : undefined} />
      <SegmentedControl<Filter> value={filter} onChange={setFilter} options={[
        { value: 'open', label: t('qa.status.open') }, { value: 'answered', label: t('qa.status.answered') },
        { value: 'closed', label: t('qa.status.closed') }, { value: 'all', label: t('qa.all') },
      ]} />
      <View className="gap-2 py-3">
        {list.isLoading ? <SkeletonList /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : items.length === 0 ? (
          <Empty title={t('qa.empty')} body={isStudent ? t('qa.emptyBody') : undefined} action={isStudent ? { title: t('qa.ask'), onPress: ask } : undefined} />
        ) : items.map((q) => <QuestionCard key={q.id} q={q} showTopic={false} />)}
        {list.hasNextPage ? <Button variant="secondary" title={t('qa.more')} loading={list.isFetchingNextPage} onPress={() => list.fetchNextPage()} /> : null}
      </View>
    </Screen>
  );
}
