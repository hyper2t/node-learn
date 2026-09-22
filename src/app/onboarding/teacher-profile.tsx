import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, PageHeader } from '@/shared/layout/screen';
import { t } from '@/shared/i18n';
import { TeacherProfileForm } from '@/features/identity/profile-forms';

export default function TeacherOnboarding() {
  const router = useRouter();
  return (
    <Screen>
      <View className="mx-auto w-full max-w-[520px] py-6">
        <PageHeader title={t('onboarding.teacherTitle')} body={t('onboarding.teacherBody')} />
        <TeacherProfileForm submitLabel={t('common.continue')} onDone={() => router.replace('/')} />
      </View>
    </Screen>
  );
}
