import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { completeOAuthSession } from '@/infrastructure/appwrite';
import { Screen } from '@/shared/layout/screen';
import { SplashTransition } from '@/shared/layout/splash-transition';
import { Button, Text } from '@/shared/ui';
import { t } from '@/shared/i18n';
import { authErrorMessage } from '@/features/identity/auth-form';

export default function OAuthReturnScreen() {
  const params = useLocalSearchParams<{ userId?: string; secret?: string; error?: string }>();
  const router = useRouter();
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (params.error) throw new Error(params.error);
        await completeOAuthSession({ userId: params.userId, secret: params.secret });
        if (!cancelled) router.replace('/');
      } catch (e) {
        if (!cancelled) setError(e);
      }
    })();
    return () => { cancelled = true; };
  }, [params.userId, params.secret, params.error, router]);

  if (!error) return <SplashTransition label={t('auth.finishing')} />;
  return (
    <Screen>
      <View className="mx-auto w-full max-w-[420px] gap-4 py-16">
        <Text variant="h2">{t('auth.oauthFailed')}</Text>
        <Text variant="small" tone="secondary">{authErrorMessage(error)}</Text>
        <Button title={t('auth.backToSignIn')} onPress={() => router.replace('/auth')} />
      </View>
    </Screen>
  );
}
