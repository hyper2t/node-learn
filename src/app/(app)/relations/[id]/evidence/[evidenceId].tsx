import { useState } from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMe } from '@/features/identity/api';
import { useCreateFeedback, useEvidenceItem, useWorkspace } from '@/features/learning/api';
import { Screen, Section } from '@/shared/layout/screen';
import { Badge, Button, Card, Checkbox, ErrorState, InlineError, Input, Loading, Text } from '@/shared/ui';
import { fmt, t } from '@/shared/i18n';

export default function EvidenceDetail() {
  const { id, evidenceId } = useLocalSearchParams<{ id: string; evidenceId: string }>();
  const me = useMe();
  const ws = useWorkspace(id);
  const q = useEvidenceItem(id, evidenceId);
  const fb = useCreateFeedback(id);
  const [body, setBody] = useState('');
  const [next, setNext] = useState('');
  const [markDone, setMarkDone] = useState(true);
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const e = q.data;
  const isTeacher = ws.data ? ws.data.relation.teacherId === me.data?.userId : false;
  const task = ws.data?.tasks.find((tk) => tk.id === e.taskId);
  return (
    <Screen>
      <Stack.Screen options={{ title: e.title }} />
      <View className="gap-3 py-4">
        <View className="flex-row items-center gap-2">
          <Badge label={e.status} tone={e.status === 'submitted' ? 'warning' : 'success'} />
          <Text variant="caption" tone="tertiary">{fmt.date(e.submittedAt, { dateStyle: 'medium', timeStyle: 'short' })} · v{e.version}</Text>
        </View>
        {task ? <Text variant="small" tone="secondary">{t('relation.forTask')}: {task.title}</Text> : null}
        <Card><Text>{e.body}</Text></Card>
        <Section title={t('relation.feedback')}>
          {e.feedback.length === 0 ? <Text variant="small" tone="secondary">{t('common.empty')}</Text> : null}
          <View className="gap-2">
            {e.feedback.map((f) => (
              <Card key={f.id} className="gap-1 border-l-4 border-l-teacher">
                <Text>{f.body}</Text>
                {f.nextStep ? <Text variant="small" tone="secondary">→ {f.nextStep}</Text> : null}
                <Text variant="caption" tone="tertiary">{fmt.relative(f.createdAt)}</Text>
              </Card>
            ))}
          </View>
        </Section>
        {isTeacher && ws.data?.relation.status === 'active' ? (
          <Section title={t('relation.giveFeedback')}>
            <Card className="gap-3">
              <Input label={t('relation.feedbackBody')} value={body} onChangeText={setBody} multiline maxLength={3000} />
              <Input label={t('relation.nextStep')} value={next} onChangeText={setNext} multiline maxLength={1000} hint={t('common.optional')} />
              {task && task.status !== 'done' ? <Checkbox checked={markDone} onChange={setMarkDone} label={t('relation.markDone')} /> : null}
              <InlineError error={fb.error} />
              <Button title={t('common.send')} loading={fb.isPending} disabled={body.trim().length < 3}
                onPress={() => fb.mutate({ evidenceId: e.id, input: { body: body.trim(), nextStep: next.trim() || undefined, markTaskDone: !!task && markDone } }, { onSuccess: () => { setBody(''); setNext(''); } })} />
            </Card>
          </Section>
        ) : null}
      </View>
    </Screen>
  );
}
