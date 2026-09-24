import { useRef, useState } from 'react';
import { View, type NativeSyntheticEvent, type TextInput, type TextInputSelectionChangeEventData } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMe } from '@/features/identity/api';
import { useAskQuestion, useQaQuestion, useUpdateQuestion } from '@/features/qa/api';
import { Markdown, MathText, TopicPicker, topicLabel } from '@/features/qa/components';
import { applySnippet, isStemTopic, type MathSnippet, type Selection } from '@/features/qa/math-snippets';
import { MathToolbar } from '@/features/qa/math-toolbar';
import { useBreakpoint } from '@/shared/hooks/use-breakpoint';
import { cn } from '@/shared/lib/cn';
import { PageHeader, Screen } from '@/shared/layout/screen';
import { AttachmentBar, AttachmentList, Badge, Button, Card, Empty, doneFileIds, fromAttachments, isUploading, type PendingAttachment, InlineError, Input, Loading, Text } from '@/shared/ui';
import { t } from '@/shared/i18n';
import { QA_MAX_ATTACHMENTS, QA_TOPICS, type Attachment, type QaTopicSlug } from '@/types/api';

const isTopic = (v: unknown): v is QaTopicSlug => QA_TOPICS.some((x) => x.slug === v);
const TITLE_MAX = 160;
const BODY_MAX = 8000;
type Draft = { topic: QaTopicSlug | null; title: string; body: string; attachments: Attachment[] };

/** Local picks rendered like published attachments (local URIs, no token). */
const asPreview = (items: PendingAttachment[]): Attachment[] => items
  .filter((a) => a.status === 'done')
  .map((a) => ({ fileId: a.key, fileName: a.file.name, mimeType: a.file.mimeType, sizeBytes: a.file.size, url: a.file.uri, expiresAt: '' }));

type Field = 'title' | 'body';

/** Live preview, laid out like the published question so authors see what teachers will see. */
function PreviewCard({ topic, title, body, files, className }: { topic: QaTopicSlug | null; title: string; body: string; files: Attachment[]; className?: string }) {
  const empty = !title.trim() && !body.trim() && !files.length;
  return (
    <Card className={cn('gap-3', className)}>
      <View className="flex-row items-center justify-between gap-2">
        <Text variant="caption" tone="tertiary" className="uppercase tracking-wide">{t('qa.preview')}</Text>
        {topic ? <Badge label={topicLabel(topic)} /> : null}
      </View>
      {empty ? <Text variant="small" tone="tertiary">{t('qa.previewEmpty')}</Text> : (
        <>
          {title.trim() ? <MathText variant="h2" text={title.trim()} /> : <Text variant="h2" tone="tertiary">{t('qa.questionTitle')}</Text>}
          <View className="border-t border-border" />
          {body.trim() ? <Markdown source={body} /> : <Text variant="small" tone="tertiary">{t('qa.detailsHint')}</Text>}
          <AttachmentList items={files} showTitle={false} />
        </>
      )}
    </Card>
  );
}

function QuestionForm({ editId, initial }: { editId: string; initial: Draft }) {
  const router = useRouter();
  const ask = useAskQuestion();
  const update = useUpdateQuestion(editId);
  const desktop = useBreakpoint() === 'desktop';
  const [topic, setTopic] = useState(initial.topic);
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [preview, setPreview] = useState(true);
  const [files, setFiles] = useState<PendingAttachment[]>(() => fromAttachments(initial.attachments));
  const uploading = isUploading(files);
  const previewFiles = asPreview(files);
  const stem = isStemTopic(topic);

  // Toolbar target: the field focused last, and each field's caret (kept across blur).
  const [target, setTarget] = useState<Field>('body');
  const sel = useRef<Record<Field, Selection>>({ title: { start: initial.title.length, end: initial.title.length }, body: { start: initial.body.length, end: initial.body.length } });
  const [forced, setForced] = useState<{ field: Field; selection: Selection } | null>(null);
  const titleRef = useRef<TextInput>(null);
  const bodyRef = useRef<TextInput>(null);
  const onSel = (field: Field, e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    sel.current[field] = e.nativeEvent.selection;
    if (forced?.field === field) setForced(null);
  };
  const onTitleSel = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => onSel('title', e);
  const onBodySel = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => onSel('body', e);
  const insert = (snippet: MathSnippet) => {
    const field = target;
    const value = field === 'title' ? title : body;
    const r = applySnippet(value, sel.current[field], snippet, { singleLine: field === 'title' });
    const max = field === 'title' ? TITLE_MAX : BODY_MAX;
    if (r.value.length > max) return;
    (field === 'title' ? setTitle : setBody)(r.value);
    sel.current[field] = r.selection;
    setForced({ field, selection: r.selection });
    (field === 'title' ? titleRef : bodyRef).current?.focus();
  };
  const selectionProp = (field: Field) => (forced?.field === field ? forced.selection : undefined);

  const valid = !!topic && title.trim().length >= 8 && body.trim().length >= 20 && !uploading;
  const mutation = editId ? update : ask;
  const submit = () => {
    if (!topic) return;
    const input = { topic, title: title.trim(), body: body.trim(), attachmentFileIds: doneFileIds(files) };
    if (editId) update.mutate(input, { onSuccess: () => router.back() });
    else ask.mutate(input, { onSuccess: (q) => router.replace(`/(app)/qa/${q.id}`) });
  };

  const form = (
    <View className="gap-4">
      <View className="gap-2">
        <Text variant="small-strong">{t('qa.topic')}</Text>
        <TopicPicker value={topic} onChange={setTopic} />
      </View>
      <Input
        ref={titleRef} label={t('qa.questionTitle')} hint={t('qa.questionTitleHint')} value={title} onChangeText={setTitle} maxLength={TITLE_MAX}
        onFocus={() => setTarget('title')} onSelectionChange={onTitleSel} selection={selectionProp('title')}
      />
      {stem ? <MathToolbar target={target} onInsert={insert} /> : null}
      <Input
        ref={bodyRef} label={t('qa.details')} hint={t('qa.detailsHint')} value={body} onChangeText={setBody} multiline maxLength={BODY_MAX}
        onFocus={() => setTarget('body')} onSelectionChange={onBodySel} selection={selectionProp('body')}
        className={stem ? 'min-h-[180px] font-mono text-small' : 'min-h-[140px]'}
      />
      {/* Attachments sit directly under Details (the LaTeX toolbar is above it), so the two never share a row. */}
      <AttachmentBar purpose="qa" max={QA_MAX_ATTACHMENTS} value={files} onChange={setFiles} />
      <Text variant="caption" tone="tertiary">{t(stem ? 'qa.math.hint' : 'qa.mathHint')}</Text>
      {!desktop ? (
        <View className="gap-2">
          <Button size="sm" variant="ghost" className="self-start" title={preview ? t('qa.hidePreview') : t('qa.preview')} onPress={() => setPreview((v) => !v)} />
          {preview ? <PreviewCard topic={topic} title={title} body={body} files={previewFiles} /> : null}
        </View>
      ) : null}
      {uploading ? <Text variant="caption" tone="tertiary">{t('attachments.waitForUploads')}</Text> : null}
      <InlineError error={mutation.error} />
      <Button title={editId ? t('qa.saveQuestion') : t('qa.post')} disabled={!valid} loading={mutation.isPending} onPress={submit} />
    </View>
  );

  if (!desktop) return <View className="py-2">{form}</View>;
  // Desktop: editor and live preview side by side.
  return (
    <View className="flex-row items-start gap-6 py-2">
      <View className="min-w-0 flex-1">{form}</View>
      <View className="min-w-0 flex-1"><PreviewCard topic={topic} title={title} body={body} files={previewFiles} /></View>
    </View>
  );
}

/** Ask a new question, or edit one (`?edit=<id>`) while it has no answers. */
export default function AskScreen() {
  const params = useLocalSearchParams<{ topic?: string; edit?: string }>();
  const editId = params.edit ?? '';
  const router = useRouter();
  const me = useMe();
  const existing = useQaQuestion(editId);
  const title = editId ? t('qa.editQuestion') : t('qa.askTitle');

  if (me.isLoading || (editId && existing.isLoading)) return <Loading />;
  if (!me.data?.availableRoles.includes('student')) {
    return <Screen><Empty title={t('qa.studentsOnly')} action={{ title: t('profile.settings'), onPress: () => router.push('/(app)/settings') }} /></Screen>;
  }
  if (editId && existing.data && !existing.data.permissions.canEdit) return <Screen><Empty title={t('qa.editLocked')} /></Screen>;
  const q = existing.data?.question;
  const initial: Draft = q
    ? { topic: q.topic, title: q.title, body: q.body, attachments: existing.data?.attachments ?? [] }
    : { topic: isTopic(params.topic) ? params.topic : null, title: '', body: '', attachments: [] };

  return (
    <Screen width="wide">
      <Stack.Screen options={{ title }} />
      <PageHeader title={title} />
      <QuestionForm key={q?.id ?? 'new'} editId={editId} initial={initial} />
    </Screen>
  );
}
