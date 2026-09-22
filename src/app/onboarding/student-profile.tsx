import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, PageHeader } from '@/shared/layout/screen';
import { t } from '@/shared/i18n';
import { StudentProfileForm } from '@/features/identity/profile-forms';

export default function StudentOnboarding() {
  const router = useRouter();
  return (
    <Screen>
      <View className="mx-auto w-full max-w-[520px] py-6">
        <PageHeader title={t('onboarding.studentTitle')} body={t('onboarding.studentBody')} />
        <StudentProfileForm submitLabel={t('common.continue')} onDone={() => router.replace('/')} />
      </View>
    </Screen>
  );
}
