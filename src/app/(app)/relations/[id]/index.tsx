import { useState } from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMe } from '@/features/identity/api';
import { useCreateGoal, useCreateTask, useSetRelationStatus, useUpdateGoal, useUpdateTask, useWorkspace } from '@/features/learning/api';
import { ProofSummary, nextActionText } from '@/features/learning/components';
import { Screen, Section, TwoColumn } from '@/shared/layout/screen';
import { Avatar, Badge, Button, Card, ErrorState, InlineError, Input, Loading, PressableCard, Text, confirm as confirmDialog } from '@/shared/ui';
import { fmt, t } from '@/shared/i18n';
import type { LearningGoal, LearningTask } from '@/types/api';

const confirm = (message: string, onOk: () => void, destructive = true) => { void confirmDialog({ message, destructive }).then((ok) => { if (ok) onOk(); }); };

export default function RelationWorkspace() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const me = useMe();
  const ws = useWorkspace(id);
  const createGoal = useCreateGoal(id);
  const updateGoal = useUpdateGoal(id);
  const createTask = useCreateTask(id);
  const updateTask = useUpdateTask(id);
  const setStatus = useSetRelationStatus(id);
  const [goalForm, setGoalForm] = useState<{ title: string; description: string } | null>(null);
  const [endReason, setEndReason] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState<{ title: string; instructions: string; goalId: string | null } | null>(null);
  if (ws.isLoading) return <Loading />;
  if (ws.isError || !ws.data) return <ErrorState error={ws.error} onRetry={() => ws.refetch()} />;
  const { relation, goals, tasks, recentEvidence, proof } = ws.data;
  const isTeacher = me.data?.userId === relation.teacherId;
  const other = isTeacher ? relation.student : relation.teacher;
  const active = relation.status === 'active';
  const activeGoals = goals.filter((g) => g.status === 'active');
  const openTasks = tasks.filter((tk) => tk.status !== 'done' && tk.status !== 'dropped');

  return (
    <Screen width="wide">
      <Stack.Screen options={{ title: other.displayName, headerRight: () => <Button size="sm" variant="ghost" title={t('messages.title')} onPress={() => router.push(`/(app)/messages/${relation.conversationId}`)} /> }} />
      <View className="gap-1 py-4">
        <View className="flex-row items-center gap-3">
          <Avatar name={other.displayName} fileId={other.avatarFileId} size={48} />
          <View className="flex-1"><Text variant="h2">{other.displayName}</Text><Text variant="caption" tone="tertiary">{isTeacher ? t('role.student') : t('role.teacher')} · {fmt.date(relation.startedAt)}</Text></View>
          <Badge label={t(`relation.status.${relation.status}`)} tone={active ? 'success' : 'neutral'} />
        </View>
        {(() => {
          const info = nextActionText(relation.nextAction, !!isTeacher);
          return info ? (
            <Card className={`mt-3 ${info.mine ? 'border-primary' : ''}`}>
              <Text variant={info.mine ? 'body-strong' : 'body'} tone={info.mine ? 'primary' : 'secondary'}>{info.mine ? t('relation.next.yourTurn') : t('relation.next.waiting')} · {info.text}</Text>
            </Card>
          ) : null;
        })()}
      </View>


      <TwoColumn
        asideFirst
        main={<View>
      <Section title={t('relation.goals')} right={active ? <Button size="sm" variant="ghost" title={t('relation.addGoal')} onPress={() => setGoalForm({ title: '', description: '' })} /> : undefined}>
        {goalForm ? (
          <Card className="gap-2">
            <Input label={t('relation.evidenceTitle')} value={goalForm.title} onChangeText={(v) => setGoalForm({ ...goalForm, title: v })} maxLength={140} />
            <Input label={t('onboarding.bio')} value={goalForm.description} onChangeText={(v) => setGoalForm({ ...goalForm, description: v })} multiline maxLength={1000} />
            <InlineError error={createGoal.error} />
            <View className="flex-row gap-2">
              <Button variant="secondary" className="flex-1" title={t('common.cancel')} onPress={() => setGoalForm(null)} />
              <Button className="flex-1" title={t('common.save')} loading={createGoal.isPending} disabled={goalForm.title.trim().length < 3} onPress={() => createGoal.mutate({ title: goalForm.title.trim(), description: goalForm.description.trim() }, { onSuccess: () => setGoalForm(null) })} />
            </View>
          </Card>
        ) : null}
        {goals.length === 0 && !goalForm ? <Text variant="small" tone="secondary">{t('relation.noGoals')}</Text> : null}
        <View className="gap-2">{goals.map((g) => <GoalRow key={g.id} g={g} current={relation.currentGoalId === g.id} canEdit={active && isTeacher} onAchieve={() => updateGoal.mutate({ goalId: g.id, input: { status: 'achieved' } })} />)}</View>
      </Section>

      <Section title={t('relation.tasks')} right={active && isTeacher ? <Button size="sm" variant="ghost" title={t('relation.addTask')} onPress={() => setTaskForm({ title: '', instructions: '', goalId: activeGoals[0]?.id ?? null })} /> : undefined}>
        {taskForm ? (
          <Card className="gap-2">
            <Input label={t('relation.evidenceTitle')} value={taskForm.title} onChangeText={(v) => setTaskForm({ ...taskForm, title: v })} maxLength={140} />
            <Input label={t('onboarding.approach')} value={taskForm.instructions} onChangeText={(v) => setTaskForm({ ...taskForm, instructions: v })} multiline maxLength={2000} />
            {activeGoals.length ? (
              <View className="flex-row flex-wrap gap-1">
                {activeGoals.map((g) => <Button key={g.id} size="sm" variant={taskForm.goalId === g.id ? 'primary' : 'secondary'} title={g.title} onPress={() => setTaskForm({ ...taskForm, goalId: g.id })} />)}
              </View>
            ) : null}
            <InlineError error={createTask.error} />
            <View className="flex-row gap-2">
              <Button variant="secondary" className="flex-1" title={t('common.cancel')} onPress={() => setTaskForm(null)} />
              <Button className="flex-1" title={t('common.save')} loading={createTask.isPending} disabled={taskForm.title.trim().length < 3} onPress={() => createTask.mutate({ title: taskForm.title.trim(), instructions: taskForm.instructions.trim(), goalId: taskForm.goalId }, { onSuccess: () => setTaskForm(null) })} />
            </View>
          </Card>
        ) : null}
        {tasks.length === 0 && !taskForm ? <Text variant="small" tone="secondary">{t('relation.noTasks')}</Text> : null}
        <View className="gap-2">
          {[...openTasks, ...tasks.filter((tk) => !openTasks.includes(tk))].map((tk) => (
            <TaskRow key={tk.id} task={tk} isTeacher={!!isTeacher} active={active}
              onSubmit={() => router.push({ pathname: '/(app)/relations/[id]/evidence/new', params: { id, taskId: tk.id } })}
              onDone={() => updateTask.mutate({ taskId: tk.id, input: { status: 'done' } })} />
          ))}
        </View>
      </Section>

      <Section title={t('relation.evidence')} right={<View className="flex-row gap-1">
        <Button size="sm" variant="ghost" title="All" onPress={() => router.push(`/(app)/relations/${id}/evidence`)} />
        {active && !isTeacher ? <Button size="sm" variant="ghost" title={t('relation.submitEvidence')} onPress={() => router.push(`/(app)/relations/${id}/evidence/new`)} /> : null}
      </View>}>
        {recentEvidence.length === 0 ? <Text variant="small" tone="secondary">{t('relation.noEvidence')}</Text> : null}
        <View className="gap-2">
          {recentEvidence.map((e) => (
            <PressableCard key={e.id} onPress={() => router.push(`/(app)/relations/${id}/evidence/${e.id}`)} className="gap-1">
              <View className="flex-row items-center justify-between"><Text variant="body-strong" numberOfLines={1} className="flex-1">{e.title}</Text><Badge label={e.status} tone={e.status === 'submitted' ? 'warning' : 'success'} /></View>
              <Text variant="caption" tone="tertiary">{fmt.relative(e.submittedAt)} · {e.feedback.length} {t('relation.feedback').toLowerCase()}</Text>
            </PressableCard>
          ))}
        </View>
      </Section>

      {relation.status === 'ended' ? (
        <Card className="my-4 gap-1">
          <Text variant="body-strong">{t('relation.endedBanner', { name: relation.endedBy === relation.teacherId ? relation.teacher.displayName : relation.student.displayName, date: relation.endedAt ? fmt.date(relation.endedAt) : '' })}</Text>
          {relation.endReason ? <Text variant="small" tone="secondary">{relation.endReason}</Text> : null}
        </Card>
      ) : null}
      {relation.status === 'paused' ? <Text variant="small" tone="secondary" className="mt-4">{t('relation.pausedHint')}</Text> : null}
      {endReason !== null ? (
        <Card className="my-4 gap-2">
          <Input label={t('relation.endReason')} value={endReason} onChangeText={setEndReason} multiline maxLength={500} />
          <InlineError error={setStatus.error} />
          <View className="flex-row gap-2">
            <Button variant="secondary" className="flex-1" title={t('common.cancel')} onPress={() => { setEndReason(null); setStatus.reset(); }} />
            <Button variant="danger" className="flex-1" title={t('relation.end')} loading={setStatus.isPending} disabled={endReason.trim().length < 2}
              onPress={() => confirm(t('relation.endConfirm'), () => setStatus.mutate({ status: 'ended', reason: endReason.trim() }, { onSuccess: () => setEndReason(null) }))} />
          </View>
        </Card>
      ) : relation.status !== 'ended' ? (
        <View className="gap-2 py-6">
          <InlineError error={setStatus.error} />
          <View className="flex-row gap-2">
            {relation.status === 'active' ? <Button variant="secondary" className="flex-1" title={t('relation.pause')} loading={setStatus.isPending} onPress={() => confirm(t('relation.pauseConfirm'), () => setStatus.mutate({ status: 'paused' }), false)} /> : null}
            {relation.status === 'paused' ? <Button variant="secondary" className="flex-1" title={t('relation.resume')} loading={setStatus.isPending} onPress={() => setStatus.mutate({ status: 'active' })} /> : null}
            <Button variant="danger" className="flex-1" title={t('relation.end')} onPress={() => { setStatus.reset(); setEndReason(''); }} />
          </View>
        </View>
      ) : null}
        </View>}
        aside={<View>
      <Section title={t('relation.proof')}><Card><ProofSummary proof={proof} /></Card></Section>
        </View>}
      />
    </Screen>
  );
}

function GoalRow({ g, current, canEdit, onAchieve }: { g: LearningGoal; current: boolean; canEdit: boolean; onAchieve: () => void }) {
  return (
    <Card className="gap-1">
      <View className="flex-row items-center gap-2">
        <Text variant="body-strong" className="flex-1">{g.title}</Text>
        {current ? <Badge label={t('home.currentFocus')} tone="primary" /> : null}
        <Badge label={t(`relation.goalStatus.${g.status}`)} tone={g.status === 'achieved' ? 'success' : 'neutral'} />
      </View>
      {g.description ? <Text variant="small" tone="secondary">{g.description}</Text> : null}
      {canEdit && g.status === 'active' ? <Button size="sm" variant="ghost" className="self-start" title={t('relation.markAchieved')} onPress={onAchieve} /> : null}
    </Card>
  );
}

function TaskRow({ task, isTeacher, active, onSubmit, onDone }: { task: LearningTask; isTeacher: boolean; active: boolean; onSubmit: () => void; onDone: () => void }) {
  const tone = task.status === 'done' ? 'success' : task.status === 'submitted' ? 'warning' : 'neutral';
  return (
    <Card className="gap-1">
      <View className="flex-row items-center gap-2">
        <Text variant="body-strong" className="flex-1">{task.title}</Text>
        <Badge label={t(`relation.taskStatus.${task.status}`)} tone={tone} />
      </View>
      {task.instructions ? <Text variant="small" tone="secondary">{task.instructions}</Text> : null}
      {task.dueAt ? <Text variant="caption" tone="tertiary">{t('relation.due', { date: fmt.date(task.dueAt) })}</Text> : null}
      {active && !isTeacher && (task.status === 'open' || task.status === 'reviewed') ? <Button size="sm" variant="ghost" className="self-start" title={t('relation.submitEvidence')} onPress={onSubmit} /> : null}
      {active && isTeacher && task.status !== 'done' && task.status !== 'dropped' ? <Button size="sm" variant="ghost" className="self-start" title={t('relation.markDone')} onPress={onDone} /> : null}
    </Card>
  );
}
