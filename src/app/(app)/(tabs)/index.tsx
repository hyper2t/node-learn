import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMe } from '@/features/identity/api';
import { useRelations, useWorkspace } from '@/features/learning/api';
import { useRequests } from '@/features/requests/api';
import { ProofSummary, RelationCard, RequestCard } from '@/features/learning/components';
import { Screen, PageHeader, Section } from '@/shared/layout/screen';
import { Button, Card, Empty, ErrorState, Loading, Text } from '@/shared/ui';
import { t } from '@/shared/i18n';

function CurrentRelationProof({ relationId }: { relationId: string }) {
  const ws = useWorkspace(relationId);
  if (!ws.data) return null;
  return <Card><ProofSummary proof={ws.data.proof} /></Card>;
}

export default function HomeScreen() {
  const router = useRouter();
  const me = useMe();
  const role = me.data?.activeRole ?? 'student';
  const relations = useRelations(role, 'active', !!me.data);
  const requests = useRequests(role, 'pending', !!me.data);
  if (me.isLoading) return <Loading />;
  if (me.isError) return <ErrorState error={me.error} onRetry={() => me.refetch()} />;

  const active = relations.data?.items ?? [];
  const pending = requests.data?.items ?? [];
  const isTeacher = role === 'teacher';
  return (
    <Screen>
      <PageHeader title={isTeacher ? t('home.teacherTitle') : t('home.studentTitle')} body={me.data ? me.data.displayName : undefined}
        right={!isTeacher ? <Button size="sm" variant="secondary" title={t('home.findTeacher')} onPress={() => router.push('/(app)/teachers')} /> : undefined} />
      {!me.data?.emailVerified ? (
        <Card className="mb-3 bg-warning-subtle">
          <Text variant="small">{t('auth.verifyBody', { email: me.data?.email ?? '' })}</Text>
          <Button size="sm" variant="ghost" className="self-start" title={t('auth.resend')} onPress={() => router.push('/auth/verify')} />
        </Card>
      ) : null}
      {relations.isError ? <ErrorState error={relations.error} onRetry={() => relations.refetch()} /> : null}
      {active.length === 0 && !relations.isLoading ? (
        <Empty title={isTeacher ? t('home.noStudents') : t('home.noRelation')} body={isTeacher ? t('home.noStudentsBody') : t('home.noRelationBody')}
          action={!isTeacher ? { title: t('home.findTeacher'), onPress: () => router.push('/(app)/teachers') } : undefined} />
      ) : null}
      {!isTeacher && active[0] ? <Section title={t('home.currentFocus')}><CurrentRelationProof relationId={active[0].id} /></Section> : null}
      {active.length ? (
        <Section title={isTeacher ? t('home.activeStudents') : t('relation.title')}>
          <View className="gap-2">{active.map((r) => <RelationCard key={r.id} r={r} role={role} />)}</View>
        </Section>
      ) : null}
      {pending.length ? (
        <Section title={isTeacher ? t('home.needsAttention') : t('home.pending')} right={<Button size="sm" variant="ghost" title={t('requests.title')} onPress={() => router.push('/(app)/requests')} />}>
          <View className="gap-2">{pending.slice(0, 5).map((r) => <RequestCard key={r.id} r={r} onPress={() => router.push(`/(app)/requests/${r.id}`)} />)}</View>
        </Section>
      ) : null}
    </Screen>
  );
}
