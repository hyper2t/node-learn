import { View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEvidenceList } from '@/features/learning/api';
import { evidenceTone } from '@/features/learning/components';
import { Screen } from '@/shared/layout/screen';
import { Badge, Empty, ErrorState, Loading, PressableCard, Text } from '@/shared/ui';
import { fmt, t } from '@/shared/i18n';

export default function EvidenceList() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const q = useEvidenceList(id);
  return (
    <Screen>
      <Stack.Screen options={{ title: t('relation.evidence') }} />
      <View className="gap-2 py-3">
        {q.isLoading ? <Loading /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.items.length ? <Empty title={t('relation.noEvidence')} /> : q.data.items.map((e) => (
          <PressableCard key={e.id} onPress={() => router.push(`/(app)/relations/${id}/evidence/${e.id}`)} className="gap-1">
            <View className="flex-row items-center justify-between"><Text variant="body-strong" className="flex-1" numberOfLines={1}>{e.title}</Text><Badge label={t(`relation.evidenceStatus.${e.status}`)} tone={evidenceTone(e.status)} /></View>
            <Text variant="small" tone="secondary" numberOfLines={2}>{e.body}</Text>
            <Text variant="caption" tone="tertiary">{fmt.relative(e.submittedAt)} · v{e.version}</Text>
          </PressableCard>
        ))}
      </View>
    </Screen>
  );
}
