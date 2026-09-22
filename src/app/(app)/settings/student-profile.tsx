import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Screen } from '@/shared/layout/screen';
import { t } from '@/shared/i18n';
import { StudentProfileForm } from '@/features/identity/profile-forms';

export default function EditStudentProfile() {
  const router = useRouter();
  return (
    <Screen>
      <Stack.Screen options={{ title: t('onboarding.studentTitle') }} />
      <View className="py-4"><StudentProfileForm submitLabel={t('common.save')} onDone={() => router.back()} /></View>
    </Screen>
  );
}
