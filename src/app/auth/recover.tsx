import { useState } from 'react';
import { View } from 'react-native';
import { Link } from 'expo-router';
import { requestPasswordRecovery } from '@/infrastructure/appwrite';
import { env } from '@/infrastructure/config/env';
import { Screen } from '@/shared/layout/screen';
import { Button, Input, Text } from '@/shared/ui';
import { t } from '@/shared/i18n';
import { authErrorMessage } from '@/features/identity/auth-form';

export default function RecoverScreen() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const submit = async () => {
    setBusy(true); setError(null);
    try { await requestPasswordRecovery({ email: email.trim(), url: `${env.webUrl}/auth/reset` }); setSent(true); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <Screen>
      <View className="mx-auto w-full max-w-[420px] gap-4 py-16">
        <Text variant="h1">{t('auth.recoverTitle')}</Text>
        <Text tone="secondary">{t('auth.recoverBody')}</Text>
        <Input label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        {sent ? <Text tone="success">{t('auth.sent')}</Text> : null}
        {error ? <Text tone="danger">{authErrorMessage(error)}</Text> : null}
        <Button title={t('common.send')} loading={busy} disabled={!/.+@.+\..+/.test(email)} onPress={submit} />
        <Link href="/auth" className="self-center"><Text variant="small" tone="primary">{t('auth.backToSignIn')}</Text></Link>
      </View>
    </Screen>
  );
}
