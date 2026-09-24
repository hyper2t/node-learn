import { useState } from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTeacher } from '@/features/teachers/api';
import { useCreateRequest } from '@/features/requests/api';
import { useAcceptedAnswers } from '@/features/qa/api';
import { MathText, topicLabel } from '@/features/qa/components';
import { useMe, useStudentProfile } from '@/features/identity/api';
import { Screen, Section } from '@/shared/layout/screen';
import { Avatar, Badge, Button, Card, ErrorState, InlineError, Input, Loading, PressableCard, Text } from '@/shared/ui';
import { fmt, t } from '@/shared/i18n';

export default function TeacherDetail() {
  const { userId, goal: goalParam } = useLocalSearchParams<{ userId: string; goal?: string }>();
  const router = useRouter();
  const me = useMe();
  const tq = useTeacher(userId);
  const sp = useStudentProfile(me.data?.availableRoles.includes('student') ?? false);
  const create = useCreateRequest();
  const accepted = useAcceptedAnswers(userId);
  // Arriving from a Q&A answer pre-opens the request form with the question as the goal.
  const [open, setOpen] = useState(!!goalParam);
  const [goal, setGoal] = useState(goalParam ? goalParam.slice(0, 120) : '');
  const [message, setMessage] = useState('');
  const [seeded, setSeeded] = useState(false);
  if (tq.isLoading) return <Loading />;
  if (tq.isError || !tq.data) return <ErrorState error={tq.error} onRetry={() => tq.refetch()} />;
  const tp = tq.data;
  const isSelf = me.data?.userId === tp.userId;
  const canRequest = me.data?.activeRole === 'student' && !isSelf;
  const openForm = () => {
    if (!seeded && sp.data?.goalSummary) { setGoal(sp.data.goalSummary); setSeeded(true); }
    setOpen(true);
  };
  const submit = () => create.mutate({ teacherId: tp.userId, goalTitle: goal.trim(), message: message.trim() }, {
    onSuccess: (r) => router.replace(`/(app)/requests/${r.id}`),
  });
  return (
    <Screen>
      <Stack.Screen options={{ title: tp.displayName }} />
      <View className="gap-3 py-4">
        <View className="flex-row items-center gap-3">
          <Avatar name={tp.displayName} fileId={tp.avatarFileId} size={64} />
          <View className="flex-1">
            <Text variant="h2">{tp.displayName}</Text>
            {tp.handle ? <Text variant="small" tone="secondary">@{tp.handle}</Text> : null}
            <Text variant="body" className="mt-1">{tp.headline}</Text>
          </View>
        </View>
        <View className="flex-row flex-wrap gap-1">
          <Badge label={t('teachers.selfDeclared')} />
          {tp.emailVerified ? <Badge label={t('teachers.verifiedEmail')} tone="success" /> : null}
          <Badge label={tp.acceptingRequests ? t('teachers.accepting') : t('teachers.notAccepting')} tone={tp.acceptingRequests ? 'success' : 'neutral'} />
        </View>
        <Text variant="caption" tone="tertiary">
          {t('teachers.activeRelations', { n: tp.signals.activeRelations })} · {t('teachers.memberSince', { date: fmt.date(tp.signals.memberSince, { year: 'numeric', month: 'short' }) })}
        </Text>
        {tp.subjects.length ? <Section title={t('onboarding.subjects')}><View className="flex-row flex-wrap gap-1">{tp.subjects.map((s) => <Badge key={s} label={s} tone="primary" />)}</View></Section> : null}
        {tp.bio ? <Section title={t('onboarding.bio')}><Text>{tp.bio}</Text></Section> : null}
        {tp.approach ? <Section title={t('teachers.approach')}><Text>{tp.approach}</Text></Section> : null}
        {accepted.data?.length ? (
          <Section title={t('qa.acceptedAnswers')}>
            <View className="gap-2">
              {accepted.data.map((x) => (
                <PressableCard key={x.answerId} className="gap-1" accessibilityRole="link" onPress={() => router.push(`/(app)/qa/${x.questionId}`)}>
                  <Badge label={topicLabel(x.topic)} />
                  <MathText variant="body-strong" numberOfLines={2} text={x.questionTitle} />
                  <Text variant="small" tone="secondary" numberOfLines={3}>{x.excerpt}</Text>
                </PressableCard>
              ))}
            </View>
          </Section>
        ) : null}
        {canRequest && !open ? <Button title={t('teachers.request')} disabled={!tp.acceptingRequests} onPress={openForm} /> : null}
        {open && canRequest ? (
          <Card className="gap-3">
            <Text variant="h3">{t('teachers.requestTitle')}</Text>
            <Input label={t('teachers.goalTitle')} value={goal} onChangeText={setGoal} maxLength={140} />
            <Input label={t('teachers.message')} value={message} onChangeText={setMessage} multiline maxLength={1000} />
            <InlineError error={create.error} />
            <View className="flex-row gap-2">
              <Button variant="secondary" title={t('common.cancel')} onPress={() => setOpen(false)} className="flex-1" />
              <Button title={t('common.send')} loading={create.isPending} disabled={goal.trim().length < 3} onPress={submit} className="flex-1" />
            </View>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}
