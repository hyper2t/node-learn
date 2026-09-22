import { useState } from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCreateEvidence, useWorkspace } from '@/features/learning/api';
import { Screen } from '@/shared/layout/screen';
import { Button, InlineError, Input, Text } from '@/shared/ui';
import { t } from '@/shared/i18n';

export default function NewEvidence() {
  const { id, taskId: initialTask } = useLocalSearchParams<{ id: string; taskId?: string }>();
  const router = useRouter();
  const ws = useWorkspace(id);
  const create = useCreateEvidence(id);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [taskId, setTaskId] = useState<string | null>(initialTask ?? null);
  const openTasks = (ws.data?.tasks ?? []).filter((tk) => tk.status === 'open' || tk.status === 'reviewed');
  const task = openTasks.find((tk) => tk.id === taskId);
  return (
    <Screen>
      <Stack.Screen options={{ title: t('relation.submitEvidence') }} />
      <View className="gap-4 py-4">
        {openTasks.length ? (
          <View className="gap-1">
            <Text variant="small-strong">{t('relation.forTask')}</Text>
            <View className="flex-row flex-wrap gap-1">
              <Button size="sm" variant={!taskId ? 'primary' : 'secondary'} title="—" onPress={() => setTaskId(null)} />
              {openTasks.map((tk) => <Button key={tk.id} size="sm" variant={taskId === tk.id ? 'primary' : 'secondary'} title={tk.title} onPress={() => setTaskId(tk.id)} />)}
            </View>
          </View>
        ) : null}
        <Input label={t('relation.evidenceTitle')} value={title} onChangeText={setTitle} maxLength={140} placeholder={task?.title} />
        <Input label={t('relation.evidenceBody')} value={body} onChangeText={setBody} multiline maxLength={5000} className="min-h-[160px]" />
        <InlineError error={create.error} />
        <Button title={t('common.send')} loading={create.isPending} disabled={title.trim().length < 3 || body.trim().length < 10}
          onPress={() => create.mutate({ title: title.trim(), body: body.trim(), taskId, goalId: task?.goalId ?? ws.data?.relation.currentGoalId ?? null }, { onSuccess: (e) => router.replace(`/(app)/relations/${id}/evidence/${e.id}`) })} />
      </View>
    </Screen>
  );
}
