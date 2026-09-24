import { useState } from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMe } from '@/features/identity/api';
import { useCreateFeedback, useEvidenceItem, useReviseEvidence, useWorkspace } from '@/features/learning/api';
import { evidenceTone } from '@/features/learning/components';
import { Screen, Section } from '@/shared/layout/screen';
import {
  AttachmentList, AttachmentPicker, Badge, Button, Card, Checkbox, ErrorState, InlineError, Input, Loading, SegmentedControl, Text,
  doneFileIds, fromAttachments, isUploading, type PendingAttachment,
} from '@/shared/ui';
import { fmt, t } from '@/shared/i18n';
import type { EvidenceItem, FeedbackOutcome } from '@/types/api';

export default function EvidenceDetail() {
  const { id, evidenceId } = useLocalSearchParams<{ id: string; evidenceId: string }>();
  const me = useMe();
  const ws = useWorkspace(id);
  const q = useEvidenceItem(id, evidenceId);
  const fb = useCreateFeedback(id);
  const [body, setBody] = useState('');
  const [next, setNext] = useState('');
  const [markDone, setMarkDone] = useState(true);
  const [outcome, setOutcome] = useState<FeedbackOutcome>('approved');
  const [showHistory, setShowHistory] = useState(false);
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const e = q.data;
  const isTeacher = ws.data ? ws.data.relation.teacherId === me.data?.userId : false;
  const active = ws.data?.relation.status === 'active';
  const task = ws.data?.tasks.find((tk) => tk.id === e.taskId);
  const awaitingReview = e.status === 'submitted' || e.status === 'revised';
  const canRevise = active && !isTeacher && e.status === 'needs_revision' && e.authorId === me.data?.userId;
  return (
    <Screen>
      <Stack.Screen options={{ title: e.title }} />
      <View className="gap-3 py-4">
        <View className="flex-row items-center gap-2">
          <Badge label={t(`relation.evidenceStatus.${e.status}`)} tone={evidenceTone(e.status)} />
          <Text variant="caption" tone="tertiary">{fmt.date(e.submittedAt, { dateStyle: 'medium', timeStyle: 'short' })} · v{e.version}</Text>
        </View>
        {task ? <Text variant="small" tone="secondary">{t('relation.forTask')}: {task.title}</Text> : null}
        <Card><Text>{e.body}</Text></Card>
        <AttachmentList items={e.attachments} />

        {canRevise ? <ReviseForm relationId={id} evidence={e} /> : null}

        {e.revisions?.length ? (
          <View className="gap-2">
            <Button size="sm" variant="ghost" className="self-start" title={`${t('relation.history')} (${e.revisions.length})`} onPress={() => setShowHistory((v) => !v)} />
            {showHistory ? e.revisions.map((r) => (
              <Card key={r.version} className="gap-1 opacity-80">
                <Text variant="small-strong">{t('relation.versionN', { n: r.version })} · {r.title}</Text>
                <Text variant="small" tone="secondary">{r.body}</Text>
                <Text variant="caption" tone="tertiary">{fmt.date(r.createdAt)}{r.attachmentFileIds.length ? ` · ${t('relation.attachmentsN', { n: r.attachmentFileIds.length })}` : ''}</Text>
              </Card>
            )) : null}
          </View>
        ) : null}

        <Section title={t('relation.feedback')}>
          {e.feedback.length === 0 ? <Text variant="small" tone="secondary">{t('common.empty')}</Text> : null}
          <View className="gap-2">
            {e.feedback.map((f) => (
              <Card key={f.id} className="gap-1 border-l-4 border-l-teacher">
                <Badge label={t(`relation.outcomeTag.${f.outcome}`)} tone={f.outcome === 'approved' ? 'success' : 'warning'} />
                <Text>{f.body}</Text>
                {f.nextStep ? <Text variant="small" tone="secondary">→ {f.nextStep}</Text> : null}
                <Text variant="caption" tone="tertiary">{fmt.relative(f.createdAt)}</Text>
              </Card>
            ))}
          </View>
        </Section>
        {isTeacher && active && awaitingReview ? (
          <Section title={t('relation.giveFeedback')}>
            <Card className="gap-3">
              <SegmentedControl value={outcome} onChange={setOutcome} options={[
                { value: 'approved', label: t('relation.outcome.approved') }, { value: 'needs_revision', label: t('relation.outcome.needs_revision') },
              ]} />
              <Input label={t('relation.feedbackBody')} value={body} onChangeText={setBody} multiline maxLength={3000} />
              <Input label={t('relation.nextStep')} value={next} onChangeText={setNext} multiline maxLength={300} hint={t('common.optional')} />
              {outcome === 'approved' && task && task.status !== 'done' ? <Checkbox checked={markDone} onChange={setMarkDone} label={t('relation.markDone')} /> : null}
              <InlineError error={fb.error} />
              <Button title={t('common.send')} loading={fb.isPending} disabled={body.trim().length < 3}
                onPress={() => fb.mutate({ evidenceId: e.id, input: { body: body.trim(), nextStep: next.trim() || undefined, outcome, markTaskDone: outcome === 'approved' && !!task && markDone } }, { onSuccess: () => { setBody(''); setNext(''); setOutcome('approved'); } })} />
            </Card>
          </Section>
        ) : null}
      </View>
    </Screen>
  );
}

function ReviseForm({ relationId, evidence }: { relationId: string; evidence: EvidenceItem }) {
  const revise = useReviseEvidence(relationId);
  const [title, setTitle] = useState(evidence.title);
  const [body, setBody] = useState(evidence.body);
  const [attachments, setAttachments] = useState<PendingAttachment[]>(() => fromAttachments(evidence.attachments));
  return (
    <Section title={t('relation.revise')}>
      <Card className="gap-3">
        <Text variant="small" tone="secondary">{t('relation.reviseHint')}</Text>
        <Input label={t('relation.evidenceTitle')} value={title} onChangeText={setTitle} maxLength={120} />
        <Input label={t('relation.evidenceBody')} value={body} onChangeText={setBody} multiline maxLength={5000} className="min-h-[160px]" />
        <AttachmentPicker relationId={relationId} value={attachments} onChange={setAttachments} />
        <InlineError error={revise.error} />
        <Button title={t('relation.revise')} loading={revise.isPending} disabled={isUploading(attachments) || title.trim().length < 3 || body.trim().length < 10}
          onPress={() => revise.mutate({ evidenceId: evidence.id, input: { title: title.trim(), body: body.trim(), attachmentFileIds: doneFileIds(attachments) } })} />
      </Card>
    </Section>
  );
}
