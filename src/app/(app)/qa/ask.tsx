import { useState } from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMe } from '@/features/identity/api';
import { useAskQuestion, useQaQuestion, useUpdateQuestion } from '@/features/qa/api';
import { Markdown, MathText, TopicPicker } from '@/features/qa/components';
import { PageHeader, Screen } from '@/shared/layout/screen';
import { Button, Card, Empty, InlineError, Input, Loading, Text } from '@/shared/ui';
import { t } from '@/shared/i18n';
import { QA_TOPICS, type QaTopicSlug } from '@/types/api';

const isTopic = (v: unknown): v is QaTopicSlug => QA_TOPICS.some((x) => x.slug === v);
type Draft = { topic: QaTopicSlug | null; title: string; body: string };

function QuestionForm({ editId, initial }: { editId: string; initial: Draft }) {
  const router = useRouter();
  const ask = useAskQuestion();
  const update = useUpdateQuestion(editId);
  const [topic, setTopic] = useState(initial.topic);
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [preview, setPreview] = useState(false);
  const valid = !!topic && title.trim().length >= 8 && body.trim().length >= 20;
  const mutation = editId ? update : ask;
  const submit = () => {
    if (!topic) return;
    const input = { topic, title: title.trim(), body: body.trim() };
    if (editId) update.mutate(input, { onSuccess: () => router.back() });
    else ask.mutate(input, { onSuccess: (q) => router.replace(`/(app)/qa/${q.id}`) });
  };
  return (
    <View className="gap-4 py-2">
      <View className="gap-2">
        <Text variant="small-strong">{t('qa.topic')}</Text>
        <TopicPicker value={topic} onChange={setTopic} />
      </View>
      <Input label={t('qa.questionTitle')} hint={t('qa.questionTitleHint')} value={title} onChangeText={setTitle} maxLength={160} />
      <Input label={t('qa.details')} hint={t('qa.detailsHint')} value={body} onChangeText={setBody} multiline maxLength={8000} />
      <Text variant="caption" tone="tertiary">{t('qa.mathHint')}</Text>
      {title.trim() || body.trim() ? <Button size="sm" variant="ghost" className="self-start" title={preview ? t('qa.hidePreview') : t('qa.preview')} onPress={() => setPreview((v) => !v)} /> : null}
      {preview && (title.trim() || body.trim()) ? (
        <Card className="gap-3">
          {title.trim() ? <MathText variant="h3" text={title.trim()} /> : null}
          {body.trim() ? <Markdown source={body} /> : null}
        </Card>
      ) : null}
      <InlineError error={mutation.error} />
      <Button title={editId ? t('qa.saveQuestion') : t('qa.post')} disabled={!valid} loading={mutation.isPending} onPress={submit} />
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
  const initial: Draft = q ? { topic: q.topic, title: q.title, body: q.body } : { topic: isTopic(params.topic) ? params.topic : null, title: '', body: '' };

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <PageHeader title={title} />
      <QuestionForm key={q?.id ?? 'new'} editId={editId} initial={initial} />
    </Screen>
  );
}
