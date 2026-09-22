import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMe } from '@/features/identity/api';
import { useRelations } from '@/features/learning/api';
import { RelationCard } from '@/features/learning/components';
import { Screen, PageHeader } from '@/shared/layout/screen';
import { Button, Empty, ErrorState, Loading, SegmentedControl } from '@/shared/ui';
import { t } from '@/shared/i18n';
import type { RelationStatus } from '@/types/api';

export default function LearningScreen() {
  const router = useRouter();
  const me = useMe();
  const role = me.data?.activeRole ?? 'student';
  const [status, setStatus] = useState<RelationStatus>('active');
  const q = useRelations(role, status, !!me.data);
  const isTeacher = role === 'teacher';
  return (
    <Screen>
      <PageHeader title={isTeacher ? t('tabs.students') : t('relation.title')}
        right={<Button size="sm" variant="secondary" title={t('requests.title')} onPress={() => router.push('/(app)/requests')} />} />
      <SegmentedControl value={status} onChange={setStatus} options={[
        { value: 'active', label: t('relation.status.active') }, { value: 'paused', label: t('relation.status.paused') }, { value: 'ended', label: t('relation.status.ended') },
      ]} />
      <View className="mt-3 gap-2">
        {q.isLoading ? <Loading /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.data?.items.length ? (
          q.data.items.map((r) => <RelationCard key={r.id} r={r} role={role} />)
        ) : (
          <Empty title={t('common.empty')} action={!isTeacher ? { title: t('home.findTeacher'), onPress: () => router.push('/(app)/teachers') } : undefined} />
        )}
      </View>
    </Screen>
  );
}
