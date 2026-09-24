import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar, Badge, PressableCard, Text } from '@/shared/ui';
import { fmt, t } from '@/shared/i18n';
import type { EvidenceStatus, LearningRelation, LearningRequest, ProofRecord, RelationNextAction, Role } from '@/types/api';

export const evidenceTone = (s: EvidenceStatus) => (s === 'reviewed' ? 'success' : s === 'needs_revision' ? 'danger' : 'warning');
export { daysFromNow, isOverdue, parseDueDate, toDateField } from './dates';

export function nextActionText(next: RelationNextAction, viewerIsTeacher: boolean): { text: string; mine: boolean } | null {
  if (next.kind === 'none') return null;
  const teacherActs = next.kind.startsWith('teacher_');
  const mine = teacherActs === viewerIsTeacher;
  const due = next.dueAt ? t('relation.next.due', { date: fmt.date(next.dueAt) }) : '';
  const text = t(`relation.next.${next.kind}.${mine ? 'you' : 'other'}`, { n: next.count }) + due;
  return { text, mine };
}

export function NextActionLine({ next, viewerIsTeacher }: { next: RelationNextAction; viewerIsTeacher: boolean }) {
  const info = nextActionText(next, viewerIsTeacher);
  if (!info) return null;
  return <Text variant={info.mine ? 'small-strong' : 'small'} tone={info.mine ? 'primary' : 'secondary'} numberOfLines={1}>{info.mine ? '● ' : ''}{info.text}</Text>;
}

export function RelationCard({ r, role }: { r: LearningRelation; role: Role }) {
  const router = useRouter();
  const other = role === 'student' ? r.teacher : r.student;
  return (
    <PressableCard onPress={() => router.push(`/(app)/relations/${r.id}`)} className="flex-row items-center gap-3">
      <Avatar name={other.displayName} fileId={other.avatarFileId} size={44} />
      <View className="flex-1 gap-0.5">
        <Text variant="body-strong" numberOfLines={1}>{other.displayName}</Text>
        <Text variant="small" tone="secondary" numberOfLines={1}>
          {t('relation.openTasks', { n: r.summary.openTasks })} · {t('relation.evidenceCount', { n: r.summary.evidenceCount })}
        </Text>
        <NextActionLine next={r.nextAction} viewerIsTeacher={role === 'teacher'} />
        {r.summary.lastActivityAt ? <Text variant="caption" tone="tertiary">{fmt.relative(r.summary.lastActivityAt)}</Text> : null}
      </View>
      <Badge label={t(`relation.status.${r.status}`)} tone={r.status === 'active' ? 'success' : 'neutral'} />
    </PressableCard>
  );
}

export function RequestCard({ r, onPress }: { r: LearningRequest; onPress?: () => void }) {
  const tone = r.status === 'pending' ? 'warning' : r.status === 'accepted' ? 'success' : 'neutral';
  return (
    <PressableCard onPress={onPress} className="gap-2">
      <View className="flex-row items-center gap-3">
        <Avatar name={r.counterpart.displayName} fileId={r.counterpart.avatarFileId} size={36} />
        <View className="flex-1">
          <Text variant="body-strong" numberOfLines={1}>{r.counterpart.displayName}</Text>
          <Text variant="caption" tone="tertiary">{r.kind === 'learning_request' ? t('requests.fromStudent') : t('requests.fromTeacher')} · {fmt.relative(r.createdAt)}</Text>
        </View>
        <Badge label={t(`requests.${r.status}`)} tone={tone} />
      </View>
      <Text variant="small-strong">{r.goalTitle}</Text>
      {r.message ? <Text variant="small" tone="secondary" numberOfLines={3}>{r.message}</Text> : null}
    </PressableCard>
  );
}

export function ProofSummary({ proof }: { proof: ProofRecord | null }) {
  if (!proof) return <Text variant="small" tone="secondary">{t('relation.noProof')}</Text>;
  const stats: [string, number][] = [
    [t('relation.tasksDone'), proof.counts.tasksDone], [t('relation.submitted'), proof.counts.evidenceSubmitted],
    [t('relation.feedback'), proof.counts.feedbackReceived], [t('relation.revisions'), proof.counts.revisions],
  ];
  return (
    <View className="gap-3">
      {proof.currentFocus ? <Row label={t('home.currentFocus')} value={proof.currentFocus} /> : null}
      {proof.recentChange ? <Row label={t('home.recentChange')} value={proof.recentChange} /> : null}
      {proof.nextStep ? <Row label={t('home.nextStep')} value={proof.nextStep} /> : null}
      <View className="flex-row flex-wrap gap-2">
        {stats.map(([l, v]) => (
          <View key={l} className="min-w-[96px] flex-1 rounded-md bg-element px-3 py-2">
            <Text variant="h2">{v}</Text>
            <Text variant="caption" tone="secondary">{l}</Text>
          </View>
        ))}
      </View>
      {proof.milestones.length ? (
        <View className="gap-1">
          <Text variant="small-strong">{t('relation.milestones')}</Text>
          {proof.milestones.map((m) => <Text key={m.id} variant="small" tone="secondary">• {m.title} — {fmt.date(m.reachedAt)}</Text>)}
        </View>
      ) : null}
      <Text variant="caption" tone="tertiary">{t('relation.source')}</Text>
    </View>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="gap-0.5">
      <Text variant="caption" tone="tertiary">{label}</Text>
      <Text variant="body">{value}</Text>
    </View>
  );
}
