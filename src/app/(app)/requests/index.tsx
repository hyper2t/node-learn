import { useState } from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useMe } from '@/features/identity/api';
import { useRequests } from '@/features/requests/api';
import { RequestCard } from '@/features/learning/components';
import { Screen } from '@/shared/layout/screen';
import { Button, Empty, ErrorState, Loading, SegmentedControl } from '@/shared/ui';
import { t } from '@/shared/i18n';
import type { RequestStatus } from '@/types/api';

export default function RequestsScreen() {
  const router = useRouter();
  const me = useMe();
  const role = me.data?.activeRole ?? 'student';
  const [status, setStatus] = useState<RequestStatus | 'all'>('pending');
  const q = useRequests(role, status === 'all' ? undefined : status, !!me.data);
  return (
    <Screen>
      <Stack.Screen options={{ title: t('requests.title'), headerRight: role === 'teacher' ? () => <Button size="sm" variant="ghost" title={t('requests.invite')} onPress={() => router.push('/(app)/requests/invite')} /> : undefined }} />
      <View className="gap-3 py-3">
        <SegmentedControl value={status} onChange={setStatus} options={[
          { value: 'pending', label: t('requests.pending') }, { value: 'accepted', label: t('requests.accepted') }, { value: 'all', label: 'All' },
        ]} />
        {q.isLoading ? <Loading /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.items.length ? <Empty title={t('requests.empty')} /> : (
          q.data.items.map((r) => <RequestCard key={r.id} r={r} onPress={() => router.push(`/(app)/requests/${r.id}`)} />)
        )}
      </View>
    </Screen>
  );
}
