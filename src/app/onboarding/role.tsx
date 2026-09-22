import { useState } from 'react';
import { View } from 'react-native';
import { useAddRole } from '@/features/identity/api';
import { Screen, PageHeader } from '@/shared/layout/screen';
import { Button, ChoiceCard, InlineError } from '@/shared/ui';
import { t } from '@/shared/i18n';
import type { Role } from '@/types/api';

export default function RoleScreen() {
  const [role, setRole] = useState<Role | null>(null);
  const add = useAddRole();
  return (
    <Screen>
      <View className="mx-auto w-full max-w-[520px] gap-4 py-6">
        <PageHeader title={t('role.chooseTitle')} body={t('role.chooseBody')} />
        <View className="gap-3" accessibilityRole="radiogroup">
          <ChoiceCard title={t('role.student')} body={t('role.studentBody')} selected={role === 'student'} onPress={() => setRole('student')} tone="student" />
          <ChoiceCard title={t('role.teacher')} body={t('role.teacherBody')} selected={role === 'teacher'} onPress={() => setRole('teacher')} tone="teacher" />
        </View>
        <InlineError error={add.error} />
        <Button title={t('common.continue')} disabled={!role} loading={add.isPending} onPress={() => role && add.mutate({ role, activate: true })} />
      </View>
    </Screen>
  );
}
