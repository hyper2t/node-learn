import { useState } from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMe } from '@/features/identity/api';
import { useAcceptAnswer, useAnswerQuestion, useClarify, useCloseQuestion, useEditAnswer, useQaQuestion } from '@/features/qa/api';
import { AuthorLine, Markdown, MathText, ReportLink, StatusBadge, topicLabel } from '@/features/qa/components';
import { Screen, Section } from '@/shared/layout/screen';
import { AttachmentBar, AttachmentList, Badge, Button, Card, ErrorState, InlineError, Input, Loading, Text, confirm, doneFileIds, fromAttachments, isUploading, type PendingAttachment } from '@/shared/ui';
import { fmt, t } from '@/shared/i18n';
import { QA_MAX_ATTACHMENTS, type Attachment, type QaAnswer, type QaQuestionDetail } from '@/types/api';

/**
 * Answer / follow-up composer. With `attachments` (answers only) a compact icon bar sits under the
 * text field, above Cancel/Submit, so it stays reachable next to the actions on every width.
 */
function Composer({ label, hint, submitLabel, initial = '', attachments, busy, error, onSubmit, onCancel }: {
  label: string; hint?: string; submitLabel: string; initial?: string; attachments?: Attachment[]; busy: boolean; error: unknown;
  onSubmit: (body: string, attachmentFileIds?: string[]) => void; onCancel?: () => void;
}) {
  const [body, setBody] = useState(initial);
  const [files, setFiles] = useState<PendingAttachment[]>(() => fromAttachments(attachments ?? []));
  const uploading = isUploading(files);
  return (
    <View className="gap-2">
      <Input label={label} hint={hint} value={body} onChangeText={setBody} multiline maxLength={8000} />
      {attachments ? <AttachmentBar purpose="qa" max={QA_MAX_ATTACHMENTS} value={files} onChange={setFiles} compact /> : null}
      <InlineError error={error} />
      <View className="flex-row gap-2">
        {onCancel ? <Button variant="secondary" className="flex-1" title={t('common.cancel')} onPress={onCancel} /> : null}
        <Button className="flex-1" title={submitLabel} disabled={body.trim().length < 2 || uploading} loading={busy}
          onPress={() => onSubmit(body.trim(), attachments ? doneFileIds(files) : undefined)} />
      </View>
    </View>
  );
}

function AnswerCard({ a, detail, isStudentViewer }: { a: QaAnswer; detail: QaQuestionDetail; isStudentViewer: boolean }) {
  const router = useRouter();
  const qid = detail.question.id;
  const accept = useAcceptAnswer(qid);
  const clarify = useClarify(qid);
  const edit = useEditAnswer(qid);
  const [mode, setMode] = useState<'view' | 'edit' | 'clarify'>('view');
  const q = detail.question;
  const canClarifyThis = detail.permissions.canClarify && q.isMine && !a.clarification && q.status !== 'closed';
  const isFormerOrAnon = a.author.userId === 'anonymous' || a.author.displayName === 'Former member';

  return (
    <Card className={a.accepted ? 'gap-3 border border-success' : 'gap-3'}>
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <AuthorLine name={a.author.displayName} avatarFileId={a.author.avatarFileId} when={a.createdAt} badge={t('qa.teacherBadge')} />
        {a.accepted ? <Badge label={t('qa.accepted')} tone="success" /> : null}
      </View>
      {mode === 'edit' ? (
        <Composer label={t('qa.editAnswer')} submitLabel={t('qa.saveAnswer')} initial={a.body} attachments={a.attachments} busy={edit.isPending} error={edit.error}
          onCancel={() => setMode('view')} onSubmit={(body, attachmentFileIds) => edit.mutate({ answerId: a.id, body, attachmentFileIds }, { onSuccess: () => setMode('view') })} />
      ) : (
        <>
          <Markdown source={a.body} />
          <AttachmentList items={a.attachments} showTitle={false} />
        </>
      )}

      {a.clarification ? (
        <View className="gap-1 rounded-md bg-element p-3">
          <Text variant="caption" tone="tertiary">{t('qa.followUpBy')} · {fmt.relative(a.clarification.createdAt)}</Text>
          <Markdown source={a.clarification.body} />
        </View>
      ) : null}

      {mode === 'clarify' ? (
        <Composer label={t('qa.followUp')} hint={t('qa.followUpHint')} submitLabel={t('qa.sendFollowUp')} busy={clarify.isPending} error={clarify.error}
          onCancel={() => setMode('view')} onSubmit={(body) => clarify.mutate({ answerId: a.id, body }, { onSuccess: () => setMode('view') })} />
      ) : null}

      {mode === 'view' ? (
        <View className="flex-row flex-wrap gap-2">
          {detail.permissions.canAccept && !a.accepted ? <Button size="sm" variant="secondary" title={t('qa.accept')} loading={accept.isPending} onPress={() => accept.mutate(a.id)} /> : null}
          {canClarifyThis ? <Button size="sm" variant="secondary" title={t('qa.followUp')} onPress={() => setMode('clarify')} /> : null}
          {a.isMine && q.status !== 'closed' ? <Button size="sm" variant="ghost" title={t('common.edit')} onPress={() => setMode('edit')} /> : null}
          {/* The point of Q&A: turn a helpful answer into a learning relation. */}
          {isStudentViewer && !a.isMine && !isFormerOrAnon ? (
            <Button size="sm" variant="ghost" title={t('qa.workWith')}
              onPress={() => router.push({ pathname: '/(app)/teachers/[userId]', params: { userId: a.author.userId, goal: q.title } })} />
          ) : null}
        </View>
      ) : null}
      <InlineError error={accept.error} />
      {!a.isMine ? <ReportLink target={{ type: 'answer', id: a.id }} /> : null}
    </Card>
  );
}

export default function QaQuestionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const me = useMe();
  const detail = useQaQuestion(id);
  const answer = useAnswerQuestion(id);
  const close = useCloseQuestion(id);

  if (detail.isLoading) return <Loading />;
  if (detail.isError || !detail.data) return <ErrorState error={detail.error} onRetry={() => detail.refetch()} />;
  const d = detail.data;
  const q = d.question;
  const isStudentViewer = me.data?.activeRole === 'student';
  const closeQ = () => {
    void confirm({ title: t('qa.closeQuestion'), message: t('qa.closeConfirm'), confirmLabel: t('qa.closeQuestion'), destructive: true })
      .then((ok) => { if (ok) close.mutate(); });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: topicLabel(q.topic) }} />
      <View className="gap-3 py-4">
        <View className="flex-row flex-wrap items-center gap-1">
          <StatusBadge status={q.status} />
          <Badge label={topicLabel(q.topic)} />
          {q.closesAt ? <Text variant="caption" tone="tertiary">{t('qa.closesOn', { date: fmt.date(q.closesAt) })}</Text> : null}
        </View>
        <MathText variant="h2" text={q.title} />
        <AuthorLine name={q.author.displayName} avatarFileId={q.author.avatarFileId} when={q.createdAt} />
        <Markdown source={q.body} />
        <AttachmentList items={d.attachments} title={t('attachments.title')} />
        <View className="flex-row flex-wrap gap-2">
          {d.permissions.canEdit ? <Button size="sm" variant="secondary" title={t('qa.editQuestion')} onPress={() => router.push({ pathname: '/(app)/qa/ask', params: { edit: q.id } })} /> : null}
          {d.permissions.canClose ? <Button size="sm" variant="ghost" title={t('qa.closeQuestion')} loading={close.isPending} onPress={closeQ} /> : null}
        </View>
        <InlineError error={close.error} />
        {d.permissions.canReport ? <ReportLink target={{ type: 'question', id: q.id }} /> : null}
      </View>

      <Section title={t('qa.answers', { n: d.answers.length })}>
        <View className="gap-3">
          {d.answers.length === 0 ? <Text variant="small" tone="secondary">{t('qa.noAnswers')}</Text> : null}
          {d.answers.map((a) => <AnswerCard key={a.id} a={a} detail={d} isStudentViewer={isStudentViewer} />)}
        </View>
      </Section>

      {q.status === 'closed' ? <Text variant="small" tone="secondary" className="py-3">{t('qa.closedNote')}</Text> : null}
      {d.permissions.canAnswer ? (
        <Card className="my-3">
          <Composer label={t('qa.yourAnswer')} hint={t('qa.answerHint')} submitLabel={t('qa.postAnswer')} attachments={[]} busy={answer.isPending} error={answer.error}
            onSubmit={(body, attachmentFileIds) => answer.mutate({ body, attachmentFileIds })} />
        </Card>
      ) : null}
    </Screen>
  );
}
