import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MarkdownView, parseMarkdown } from '@/shared/markdown';
import { Avatar, Badge, Button, Card, InlineError, Input, PressableCard, SegmentedControl, Text } from '@/shared/ui';
import { fmt, t } from '@/shared/i18n';
import { QA_TOPICS, type QaQuestion, type QaQuestionStatus, type QaTopicSlug, type ReportInput } from '@/types/api';
import { cn } from '@/shared/lib/cn';
import { useReportQa } from './api';

export const topicLabel = (slug: QaTopicSlug | string) => QA_TOPICS.find((x) => x.slug === slug)?.label ?? slug;

const statusTone: Record<QaQuestionStatus, 'primary' | 'success' | 'neutral'> = { open: 'primary', answered: 'success', closed: 'neutral' };

export function StatusBadge({ status }: { status: QaQuestionStatus }) {
  return <Badge label={t(`qa.status.${status}`)} tone={statusTone[status]} />;
}

export function Markdown({ source }: { source: string }) {
  const blocks = useMemo(() => parseMarkdown(source).blocks, [source]);
  return <MarkdownView blocks={blocks} />;
}

export function QuestionCard({ q, showTopic = true }: { q: QaQuestion; showTopic?: boolean }) {
  const router = useRouter();
  return (
    <PressableCard className="gap-2" accessibilityRole="link" onPress={() => router.push(`/(app)/qa/${q.id}`)}>
      <View className="flex-row flex-wrap items-center gap-1">
        <StatusBadge status={q.status} />
        {showTopic ? <Badge label={topicLabel(q.topic)} /> : null}
        {q.acceptedAnswerId ? <Badge label={t('qa.accepted')} tone="success" /> : null}
      </View>
      <Text variant="body-strong" numberOfLines={2}>{q.title}</Text>
      <Text variant="caption" tone="tertiary">
        {t('qa.answers', { n: q.answerCount })} · {t('qa.ago', { when: fmt.relative(q.createdAt) })} · {t('qa.by', { name: q.author.displayName })}
      </Text>
    </PressableCard>
  );
}

export function AuthorLine({ name, avatarFileId, when, badge }: { name: string; avatarFileId: string | null; when: string; badge?: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Avatar name={name} fileId={avatarFileId} size={28} />
      <Text variant="small-strong">{name}</Text>
      {badge ? <Badge label={badge} tone="teacher" /> : null}
      <Text variant="caption" tone="tertiary">· {fmt.relative(when)}</Text>
    </View>
  );
}

const REASONS: ReportInput['reason'][] = ['spam', 'harassment', 'inappropriate', 'other'];

/** Collapsed "Report" link that expands into a small reason form. */
export function ReportLink({ target }: { target: { type: 'question' | 'answer'; id: string } }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportInput['reason']>('spam');
  const [details, setDetails] = useState('');
  const report = useReportQa();
  if (report.isSuccess) return <Text variant="caption" tone="secondary">{t('qa.reported')}</Text>;
  if (!open) return <Button size="sm" variant="ghost" className="self-start" title={t('qa.reportPost')} onPress={() => setOpen(true)} />;
  return (
    <Card className="gap-2">
      <SegmentedControl value={reason} onChange={setReason} options={REASONS.map((r) => ({ value: r, label: t(`contacts.reasons.${r}`) }))} />
      <Input value={details} onChangeText={setDetails} placeholder={t('common.optional')} maxLength={2000} multiline />
      <InlineError error={report.error} />
      <View className="flex-row gap-2">
        <Button size="sm" variant="secondary" className="flex-1" title={t('common.cancel')} onPress={() => setOpen(false)} />
        <Button size="sm" variant="danger" className="flex-1" title={t('common.report')} loading={report.isPending}
          onPress={() => report.mutate({ target, reason, details: details.trim() || undefined })} />
      </View>
    </Card>
  );
}

/** Single-select chips over the fixed topic catalogue. */
export function TopicPicker({ value, onChange }: { value: QaTopicSlug | null; onChange: (v: QaTopicSlug) => void }) {
  return (
    <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
      {QA_TOPICS.map((tp) => {
        const selected = tp.slug === value;
        return (
          <Pressable key={tp.slug} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => onChange(tp.slug)}
            className={cn('min-h-[36px] justify-center rounded-full border px-3', selected ? 'border-primary bg-primary-subtle' : 'border-border bg-element active:bg-selected')}>
            <Text variant="small-strong" tone={selected ? 'primary' : 'secondary'}>{tp.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
