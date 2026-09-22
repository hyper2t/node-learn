import { useState } from 'react';
import { Switch, View } from 'react-native';
import { useMe, useSaveStudentProfile, useSaveTeacherProfile, useStudentProfile, useTeacherProfile, useUpdateMe } from '@/features/identity/api';
import { Button, ErrorState, Input, InlineError, Loading, Text } from '@/shared/ui';
import { t } from '@/shared/i18n';
import { useThemeColors } from '@/shared/hooks/use-theme-colors';
import type { Me, StudentProfile, TeacherProfile } from '@/types/api';

const splitList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 10);
const HANDLE_RE = /^[a-z0-9_]{3,24}$/;

function HandleField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const bad = value.length > 0 && !HANDLE_RE.test(value);
  return <Input label={t('onboarding.handle')} value={value} onChangeText={(v) => onChange(v.toLowerCase())} autoCapitalize="none" hint={t('onboarding.handleHint')} error={bad ? 'a–z, 0–9, _ (3–24)' : undefined} />;
}

type FormProps = { onDone: () => void; submitLabel: string };

/** Loads current data first so the inner form can seed state from props (no setState-in-effect). */
export function StudentProfileForm(props: FormProps) {
  const me = useMe();
  const profile = useStudentProfile();
  if (me.isLoading || profile.isLoading) return <Loading />;
  if (!me.data) return <ErrorState error={me.error} onRetry={() => me.refetch()} />;
  // Profile may legitimately not exist yet (404) on first onboarding.
  return <StudentForm {...props} me={me.data} initial={profile.data ?? null} />;
}

function StudentForm({ onDone, submitLabel, me, initial }: FormProps & { me: Me; initial: StudentProfile | null }) {
  const save = useSaveStudentProfile();
  const updateMe = useUpdateMe();
  const [handle, setHandle] = useState(me.handle ?? '');
  const [goal, setGoal] = useState(initial?.goalSummary ?? '');
  const [headline, setHeadline] = useState(initial?.headline ?? '');
  const [interests, setInterests] = useState(initial?.interests.join(', ') ?? '');
  const handleValid = handle === '' || HANDLE_RE.test(handle);
  const submit = async () => {
    try {
      if (handle && handle !== me.handle) await updateMe.mutateAsync({ handle });
      await save.mutateAsync({ goalSummary: goal.trim(), headline: headline.trim(), interests: splitList(interests) });
      onDone();
    } catch { /* surfaced via mutation.error */ }
  };
  return (
    <View className="gap-4">
      <Input label={t('onboarding.goalLabel')} value={goal} onChangeText={setGoal} placeholder={t('onboarding.goalPlaceholder')} multiline maxLength={280} />
      <Input label={t('onboarding.headline')} value={headline} onChangeText={setHeadline} maxLength={120} hint={t('common.optional')} />
      <Input label={t('onboarding.interests')} value={interests} onChangeText={setInterests} hint={t('onboarding.interestsHint')} />
      <HandleField value={handle} onChange={setHandle} />
      <InlineError error={save.error ?? updateMe.error} />
      <Button title={submitLabel} disabled={goal.trim().length < 3 || !handleValid} loading={save.isPending || updateMe.isPending} onPress={submit} />
    </View>
  );
}

export function TeacherProfileForm(props: FormProps) {
  const me = useMe();
  const profile = useTeacherProfile();
  if (me.isLoading || profile.isLoading) return <Loading />;
  if (!me.data) return <ErrorState error={me.error} onRetry={() => me.refetch()} />;
  return <TeacherForm {...props} me={me.data} initial={profile.data ?? null} />;
}

function TeacherForm({ onDone, submitLabel, me, initial }: FormProps & { me: Me; initial: TeacherProfile | null }) {
  const save = useSaveTeacherProfile();
  const updateMe = useUpdateMe();
  const colors = useThemeColors();
  const [handle, setHandle] = useState(me.handle ?? '');
  const [headline, setHeadline] = useState(initial?.headline ?? '');
  const [bio, setBio] = useState(initial?.bio ?? '');
  const [subjects, setSubjects] = useState(initial?.subjects.join(', ') ?? '');
  const [approach, setApproach] = useState(initial?.approach ?? '');
  const [accepting, setAccepting] = useState(initial?.acceptingRequests ?? true);
  const handleValid = handle === '' || HANDLE_RE.test(handle);
  const submit = async () => {
    try {
      if (handle && handle !== me.handle) await updateMe.mutateAsync({ handle });
      await save.mutateAsync({ headline: headline.trim(), bio: bio.trim(), subjects: splitList(subjects), approach: approach.trim(), acceptingRequests: accepting });
      onDone();
    } catch { /* surfaced via mutation.error */ }
  };
  return (
    <View className="gap-4">
      <Input label={t('onboarding.headline')} value={headline} onChangeText={setHeadline} placeholder={t('onboarding.headlinePlaceholder')} maxLength={120} />
      <Input label={t('onboarding.subjects')} value={subjects} onChangeText={setSubjects} hint={t('onboarding.interestsHint')} />
      <Input label={t('onboarding.bio')} value={bio} onChangeText={setBio} multiline maxLength={1000} />
      <Input label={t('onboarding.approach')} value={approach} onChangeText={setApproach} multiline maxLength={1000} />
      <View className="min-h-[44px] flex-row items-center justify-between">
        <Text variant="small-strong">{t('onboarding.accepting')}</Text>
        <Switch value={accepting} onValueChange={setAccepting} trackColor={{ true: colors.primary }} accessibilityLabel={t('onboarding.accepting')} />
      </View>
      <HandleField value={handle} onChange={setHandle} />
      <InlineError error={save.error ?? updateMe.error} />
      <Button title={submitLabel} disabled={headline.trim().length < 3 || splitList(subjects).length === 0 || !handleValid} loading={save.isPending || updateMe.isPending} onPress={submit} />
    </View>
  );
}
