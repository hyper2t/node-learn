import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { completeEmailVerification, getCurrentUser, sendEmailVerification } from '@/infrastructure/appwrite';
import { env } from '@/infrastructure/config/env';
import { useAuth } from '@/state/auth';
import { Screen } from '@/shared/layout/screen';
import { Button, Text } from '@/shared/ui';
import { t } from '@/shared/i18n';
import { authErrorMessage } from '@/features/identity/auth-form';
import { useQueryClient } from '@tanstack/react-query';
import { qk } from '@/state/query-keys';

export default function VerifyScreen() {
  const params = useLocalSearchParams<{ userId?: string; secret?: string }>();
  const router = useRouter();
  const auth = useAuth();
  const qc = useQueryClient();
  const [state, setState] = useState<'idle' | 'verifying' | 'verified' | 'sent' | 'error'>(() => (params.userId && params.secret ? 'verifying' : 'idle'));
  const [error, setError] = useState<unknown>(null);
  const hasToken = !!params.userId && !!params.secret;

  useEffect(() => {
    if (!hasToken) return;
    completeEmailVerification({ userId: params.userId!, secret: params.secret! })
      .then(async () => { await getCurrentUser().catch(() => null); await qc.invalidateQueries({ queryKey: qk.me }); setState('verified'); })
      .catch((e) => { setError(e); setState('error'); });
  }, [hasToken, params.userId, params.secret, qc]);

  const resend = async () => {
    try {
      await sendEmailVerification(`${env.webUrl}/auth/verify`);
      setState('sent');
    } catch (e) { setError(e); setState('error'); }
  };

  return (
    <Screen>
      <View className="mx-auto w-full max-w-[420px] gap-4 py-16">
        <Text variant="h1">{t('auth.verifyTitle')}</Text>
        {state === 'verifying' ? <Text tone="secondary">{t('auth.verifying')}</Text> : null}
        {state === 'verified' ? <Text tone="success">{t('auth.verified')}</Text> : null}
        {state === 'sent' ? <Text tone="success">{t('auth.sent')}</Text> : null}
        {state === 'error' ? <Text tone="danger">{authErrorMessage(error)}</Text> : null}
        {!hasToken && auth.user ? <Text tone="secondary">{t('auth.verifyBody', { email: auth.user.email })}</Text> : null}
        {auth.status === 'authenticated' && state !== 'verified' ? <Button variant="secondary" title={t('auth.resend')} onPress={resend} /> : null}
        <Button title={t('common.continue')} onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}
