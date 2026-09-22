import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { completePasswordRecovery } from '@/infrastructure/appwrite';
import { Screen } from '@/shared/layout/screen';
import { Button, Input, Text } from '@/shared/ui';
import { t } from '@/shared/i18n';
import { authErrorMessage } from '@/features/identity/auth-form';

export default function ResetScreen() {
  const params = useLocalSearchParams<{ userId?: string; secret?: string }>();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const submit = async () => {
    setBusy(true); setError(null);
    try { await completePasswordRecovery({ userId: params.userId ?? '', secret: params.secret ?? '', password }); setDone(true); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <Screen>
      <View className="mx-auto w-full max-w-[420px] gap-4 py-16">
        <Text variant="h1">{t('auth.recoverTitle')}</Text>
        {done ? (
          <>
            <Text tone="success">{t('auth.resetDone')}</Text>
            <Button title={t('auth.signIn')} onPress={() => router.replace('/auth')} />
          </>
        ) : (
          <>
            <Input label={t('auth.newPassword')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" hint={t('auth.errors.weak_password')} />
            {error ? <Text tone="danger">{authErrorMessage(error)}</Text> : null}
            <Button title={t('common.save')} loading={busy} disabled={password.length < 8 || !params.userId || !params.secret} onPress={submit} />
          </>
        )}
      </View>
    </Screen>
  );
}
