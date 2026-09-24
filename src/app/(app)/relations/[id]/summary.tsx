import { useState } from 'react';
import { Platform, Share, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMe } from '@/features/identity/api';
import { useRelationSummary, useSetClosingNote } from '@/features/learning/api';
import { summaryToMarkdown } from '@/features/learning/summary-text';
import { Screen, Section } from '@/shared/layout/screen';
import { Avatar, Badge, Button, Card, ErrorState, InlineError, Input, Loading, PressableCard, Text } from '@/shared/ui';
import { fmt, t } from '@/shared/i18n';
import type { RelationSummary } from '@/types/api';

const labels = {
  title: t('summary.title'), period: (from: string, to: string, weeks: number) => t('summary.period', { from, to, weeks }),
  achieved: t('summary.achieved'), dropped: t('summary.dropped'), open: t('summary.open'), numbers: t('summary.numbers'),
  tasksDone: t('summary.tasksDone'), evidence: t('summary.evidence'), feedback: t('summary.feedback'), revisions: t('summary.revisions'),
  closingNote: t('summary.closingNote'), endReason: t('summary.endReason'), none: t('summary.none'),
};

export default function RelationSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const me = useMe();
  const q = useRelationSummary(id);
  const [copied, setCopied] = useState(false);
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const s = q.data;
  const isTeacher = me.data?.userId === s.teacher.userId;
  const text = () => summaryToMarkdown(s, labels, (iso) => fmt.date(iso));
  const copy = async () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      await Share.share({ message: text() });
    }
  };
  return (
    <Screen>
      <Stack.Screen options={{ title: t('summary.title') }} />
      <View className="gap-4 py-4">
        <View className="flex-row items-center gap-3">
          <Avatar name={s.student.displayName} fileId={s.student.avatarFileId} size={44} />
          <View className="flex-1">
            <Text variant="h2">{s.student.displayName}</Text>
            <Text variant="small" tone="secondary">{s.teacher.displayName} · {t('summary.period', { from: fmt.date(s.startedAt), to: fmt.date(s.endedAt), weeks: s.weeks })}</Text>
          </View>
        </View>

        <View className="flex-row flex-wrap gap-2">
          <Button size="sm" variant="secondary" title={Platform.OS === 'web' ? (copied ? t('summary.copied') : t('summary.copy')) : t('summary.share')} onPress={() => { void copy(); }} />
          {Platform.OS === 'web' ? <Button size="sm" variant="secondary" title={t('summary.print')} onPress={() => { if (typeof window !== 'undefined') window.print(); }} /> : null}
        </View>

        <Card className="flex-row flex-wrap justify-between gap-3">
          {([['tasksDone', s.counts.tasksDone], ['evidence', s.counts.evidenceSubmitted], ['feedback', s.counts.feedbackReceived], ['revisions', s.counts.revisions]] as const).map(([k, n]) => (
            <View key={k} className="min-w-[70px] items-center"><Text variant="h2">{n}</Text><Text variant="caption" tone="tertiary">{t(`summary.${k}`)}</Text></View>
          ))}
        </Card>

        <Section title={t('summary.achieved')}>
          {s.goals.achieved.length ? s.goals.achieved.map((g) => {
            const m = s.milestones.find((x) => x.id === g.id);
            return (
              <PressableCard key={g.id} disabled={!m?.evidenceId} onPress={() => m?.evidenceId && router.push(`/(app)/relations/${id}/evidence/${m.evidenceId}`)} className="mb-2 flex-row items-center gap-2">
                <Badge label="✓" tone="success" />
                <Text variant="body-strong" className="flex-1">{g.title}</Text>
                <Text variant="caption" tone="tertiary">{fmt.date(g.achievedAt)}</Text>
              </PressableCard>
            );
          }) : <Text variant="small" tone="secondary">{t('summary.none')}</Text>}
        </Section>
        {s.goals.open.length ? <Section title={t('summary.open')}>{s.goals.open.map((g) => <Text key={g.id} variant="small" tone="secondary">• {g.title}</Text>)}</Section> : null}
        {s.goals.dropped.length ? <Section title={t('summary.dropped')}>{s.goals.dropped.map((g) => <Text key={g.id} variant="small" tone="tertiary">• {g.title}</Text>)}</Section> : null}

        <ClosingNote relationId={id} summary={s} isTeacher={isTeacher} />

        {s.endReason ? <Section title={t('summary.endReason')}><Text variant="small" tone="secondary">{s.endReason}</Text></Section> : null}
      </View>
    </Screen>
  );
}

function ClosingNote({ relationId, summary, isTeacher }: { relationId: string; summary: RelationSummary; isTeacher: boolean }) {
  const save = useSetClosingNote(relationId);
  const [draft, setDraft] = useState(summary.closingNote ?? '');
  const [openedAt] = useState(() => Date.now());
  const editable = isTeacher && openedAt <= Date.parse(summary.closingNoteEditableUntil);
  if (editable) {
    return (
      <Section title={t('summary.closingNoteTeacher')}>
        <Card className="gap-2">
          <Text variant="small" tone="secondary">{t('summary.closingNoteHint', { date: fmt.date(summary.closingNoteEditableUntil) })}</Text>
          <Input value={draft} onChangeText={setDraft} multiline maxLength={1000} className="min-h-[120px]" />
          <InlineError error={save.error} />
          <Button className="self-start" title={t('common.save')} loading={save.isPending} disabled={draft.trim() === (summary.closingNote ?? '')} onPress={() => save.mutate(draft.trim())} />
        </Card>
      </Section>
    );
  }
  return (
    <Section title={t('summary.closingNote')}>
      {summary.closingNote ? <Card className="border-l-4 border-l-teacher"><Text>{summary.closingNote}</Text></Card> : <Text variant="small" tone="secondary">{t('summary.noClosingNote')}</Text>}
    </Section>
  );
}
