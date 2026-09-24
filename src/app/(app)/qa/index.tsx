import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useMe } from '@/features/identity/api';
import { useMyQaQuestions, useQaInbox, useQaTopics } from '@/features/qa/api';
import { QuestionCard } from '@/features/qa/components';
import { Grid, PageHeader, Screen, Section } from '@/shared/layout/screen';
import { Button, ErrorState, PressableCard, SkeletonList, Text } from '@/shared/ui';
import { t } from '@/shared/i18n';
import { QA_AUTO_CLOSE_DAYS } from '@/types/api';

export default function QaHome() {
  const router = useRouter();
  const me = useMe();
  const roles = me.data?.availableRoles ?? [];
  const isStudent = roles.includes('student');
  const isTeacher = roles.includes('teacher');
  const topics = useQaTopics();
  const mine = useMyQaQuestions(isStudent);
  const inbox = useQaInbox(isTeacher);
  const myItems = mine.data?.pages.flatMap((p) => p.items) ?? [];
  const inboxItems = inbox.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Screen width="wide">
      <Stack.Screen options={{ title: t('qa.title') }} />
      <PageHeader title={t('qa.hub')} body={t('qa.body', { days: QA_AUTO_CLOSE_DAYS })}
        right={isStudent ? <Button size="sm" title={t('qa.ask')} onPress={() => router.push('/(app)/qa/ask')} /> : undefined} />

      {isTeacher && inboxItems.length ? (
        <Section title={t('qa.inbox')} right={<Button size="sm" variant="ghost" title={t('qa.more')} onPress={() => router.push('/(app)/qa/inbox')} />}>
          <View className="gap-2">{inboxItems.slice(0, 3).map((q) => <QuestionCard key={q.id} q={q} />)}</View>
        </Section>
      ) : null}

      <Section title={t('qa.topics')}>
        {topics.isLoading ? <SkeletonList /> : topics.isError ? <ErrorState error={topics.error} onRetry={() => topics.refetch()} /> : (
          <Grid>
            {(topics.data ?? []).map((tp) => (
              <PressableCard key={tp.slug} className="gap-1" accessibilityRole="link" onPress={() => router.push(`/(app)/qa/topic/${tp.slug}`)}>
                <Text variant="body-strong">{tp.label}</Text>
                <Text variant="caption" tone="tertiary">{t('qa.openCount', { n: tp.openCount })}</Text>
              </PressableCard>
            ))}
          </Grid>
        )}
      </Section>

      {isStudent && myItems.length ? (
        <Section title={t('qa.mine')}>
          <View className="gap-2">{myItems.map((q) => <QuestionCard key={q.id} q={q} />)}</View>
          {mine.hasNextPage ? <Button variant="secondary" className="mt-2" title={t('qa.more')} loading={mine.isFetchingNextPage} onPress={() => mine.fetchNextPage()} /> : null}
        </Section>
      ) : null}
    </Screen>
  );
}
