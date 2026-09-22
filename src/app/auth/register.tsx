import { View } from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '@/shared/layout/screen';
import { Text } from '@/shared/ui';
import { t } from '@/shared/i18n';
import { EmailPasswordForm } from '@/features/identity/auth-form';

export default function RegisterScreen() {
  return (
    <Screen>
      <View className="mx-auto w-full max-w-[420px] gap-6 py-10">
        <View className="gap-2">
          <Text variant="h1">{t('auth.signUp')}</Text>
          <Text variant="body" tone="secondary">{t('app.tagline')}</Text>
        </View>
        <EmailPasswordForm mode="signup" />
        <View className="flex-row justify-center gap-1">
          <Text variant="small" tone="secondary">{t('auth.haveAccount')}</Text>
          <Link href="/auth"><Text variant="small-strong" tone="primary">{t('auth.signIn')}</Text></Link>
        </View>
      </View>
    </Screen>
  );
}
