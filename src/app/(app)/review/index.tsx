import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useMe } from '@/features/identity/api';
import { useReviewQueue } from '@/features/learning/api';
import { isStale } from '@/features/learning/dates';
import { Screen } from '@/shared/layout/screen';
import { Avatar, Badge, Empty, ErrorState, Loading, PressableCard, Text } from '@/shared/ui';
import { fmt, t } from '@/shared/i18n';
import type { ReviewQueueItem } from '@/types/api';

export default function ReviewQueueScreen() {
  const router = useRouter();
  const me = useMe();
  const isTeacher = me.data?.activeRole === 'teacher';
  const q = useReviewQueue(isTeacher);
  const open = (i: ReviewQueueItem) => router.push(i.kind === 'evidence' ? `/(app)/relations/${i.relationId}/evidence/${i.id}` : `/(app)/relations/${i.relationId}`);
  return (
    <Screen>
      <Stack.Screen options={{ title: t('review.title') }} />
      <View className="gap-2 py-3">
        {me.isLoading || q.isLoading ? <Loading /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !isTeacher || !q.data?.items.length ? (
          <Empty title={t('review.empty')} body={t('review.emptyBody')} />
        ) : (
          <>
            <Text variant="small" tone="secondary">{t('review.summary', { e: q.data.counts.evidence, g: q.data.counts.goals })}</Text>
            {q.data.items.map((i) => {
              const stale = isStale(i.since);
              return (
                <PressableCard key={`${i.kind}:${i.id}`} onPress={() => open(i)} className="flex-row items-center gap-3">
                  <Avatar name={i.student.displayName} fileId={i.student.avatarFileId} size={40} />
                  <View className="flex-1 gap-0.5">
                    <View className="flex-row flex-wrap items-center gap-1">
                      <Badge label={i.kind === 'evidence' ? t('review.evidence') : t('review.goal')} tone={i.kind === 'evidence' ? 'warning' : 'primary'} />
                      {i.version && i.version > 1 ? <Badge label={t('review.resubmitted', { n: i.version })} /> : null}
                      {stale ? <Badge label={t('review.stale')} tone="warning" /> : null}
                    </View>
                    <Text variant="body-strong" numberOfLines={1}>{i.title}</Text>
                    <Text variant="caption" tone={stale ? 'danger' : 'tertiary'}>{i.student.displayName} · {t('review.waiting', { time: fmt.relative(i.since) })}</Text>
                  </View>
                </PressableCard>
              );
            })}
          </>
        )}
      </View>
    </Screen>
  );
}
