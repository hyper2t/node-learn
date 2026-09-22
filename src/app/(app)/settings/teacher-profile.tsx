import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Screen } from '@/shared/layout/screen';
import { t } from '@/shared/i18n';
import { TeacherProfileForm } from '@/features/identity/profile-forms';

export default function EditTeacherProfile() {
  const router = useRouter();
  return (
    <Screen>
      <Stack.Screen options={{ title: t('onboarding.teacherTitle') }} />
      <View className="py-4"><TeacherProfileForm submitLabel={t('common.save')} onDone={() => router.back()} /></View>
    </Screen>
  );
}
