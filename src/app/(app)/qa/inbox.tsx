import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useMe } from '@/features/identity/api';
import { useQaInbox } from '@/features/qa/api';
import { QuestionCard } from '@/features/qa/components';
import { PageHeader, Screen } from '@/shared/layout/screen';
import { Button, Empty, ErrorState, SkeletonList } from '@/shared/ui';
import { t } from '@/shared/i18n';

export default function QaInboxScreen() {
  const router = useRouter();
  const me = useMe();
  const isTeacher = me.data?.availableRoles.includes('teacher') ?? false;
  const inbox = useQaInbox(isTeacher);
  const pages = inbox.data?.pages ?? [];
  const items = pages.flatMap((p) => p.items);
  const noTopics = pages.length > 0 && pages[0]!.topics.length === 0;

  return (
    <Screen>
      <Stack.Screen options={{ title: t('qa.inbox') }} />
      <PageHeader title={t('qa.inbox')} body={t('qa.inboxBody')} />
      <View className="gap-2 py-3">
        {!isTeacher ? <Empty title={t('qa.teacherOnly')} /> : inbox.isLoading ? <SkeletonList /> : inbox.isError ? <ErrorState error={inbox.error} onRetry={() => inbox.refetch()} /> : noTopics ? (
          <Empty title={t('qa.inboxEmpty')} body={t('qa.inboxNoTopics')} action={{ title: t('common.edit'), onPress: () => router.push('/(app)/settings/teacher-profile') }} />
        ) : items.length === 0 ? <Empty title={t('qa.inboxEmpty')} /> : items.map((q) => <QuestionCard key={q.id} q={q} />)}
        {inbox.hasNextPage ? <Button variant="secondary" title={t('qa.more')} loading={inbox.isFetchingNextPage} onPress={() => inbox.fetchNextPage()} /> : null}
      </View>
    </Screen>
  );
}
