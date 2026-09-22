import { View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMe } from '@/features/identity/api';
import { useRequest, useRespondRequest } from '@/features/requests/api';
import { RequestCard } from '@/features/learning/components';
import { Screen } from '@/shared/layout/screen';
import { Button, ErrorState, InlineError, Loading, Text } from '@/shared/ui';
import { t } from '@/shared/i18n';

export default function RequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const me = useMe();
  const q = useRequest(id);
  const respond = useRespondRequest();
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const r = q.data;
  const mine = r.initiatorId === me.data?.userId;
  const pending = r.status === 'pending';
  const act = (action: 'accept' | 'decline' | 'cancel') => respond.mutate({ id: r.id, action }, {
    onSuccess: (res) => { if (action === 'accept' && res.relationId) router.replace(`/(app)/relations/${res.relationId}`); },
  });
  return (
    <Screen>
      <Stack.Screen options={{ title: r.goalTitle }} />
      <View className="gap-3 py-4">
        <RequestCard r={r} />
        {r.message ? <Text>{r.message}</Text> : null}
        <InlineError error={respond.error} />
        {pending && !mine ? (
          <View className="flex-row gap-2">
            <Button variant="secondary" className="flex-1" title={t('common.decline')} loading={respond.isPending} onPress={() => act('decline')} />
            <Button className="flex-1" title={t('common.accept')} loading={respond.isPending} onPress={() => act('accept')} />
          </View>
        ) : null}
        {pending && mine ? <Button variant="secondary" title={t('common.withdraw')} loading={respond.isPending} onPress={() => act('cancel')} /> : null}
        {r.status === 'accepted' && r.relationId ? <Button title={t('relation.workspace')} onPress={() => router.push(`/(app)/relations/${r.relationId}`)} /> : null}
      </View>
    </Screen>
  );
}
