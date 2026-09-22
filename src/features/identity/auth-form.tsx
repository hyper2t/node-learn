import { useState } from 'react';
import { View } from 'react-native';
import { Link } from 'expo-router';
import { AuthError, signIn, signInWithOAuth, signUp, type OAuthProviderName } from '@/infrastructure/appwrite';
import { Button, Input, InlineError, Text } from '@/shared/ui';
import { t } from '@/shared/i18n';

export function authErrorMessage(err: unknown): string {
  if (err instanceof AuthError) {
    const k = `auth.errors.${err.code}` as const;
    const s = t(k as never);
    return s === k ? t('auth.errors.unknown') : s;
  }
  return t('auth.errors.unknown');
}

export function OAuthButtons({ onError }: { onError: (e: unknown) => void }) {
  const [busy, setBusy] = useState<OAuthProviderName | null>(null);
  const start = async (p: OAuthProviderName) => {
    setBusy(p);
    try {
      await signInWithOAuth(p);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(null);
    }
  };
  return (
    <View className="gap-2">
      <Button variant="secondary" title={t('auth.continueWith', { provider: t('auth.google') })} loading={busy === 'google'} disabled={!!busy} onPress={() => start('google')} />
      <Button variant="secondary" title={t('auth.continueWith', { provider: t('auth.notion') })} loading={busy === 'notion'} disabled={!!busy} onPress={() => start('notion')} />
      <Text variant="caption" tone="tertiary">{t('auth.notionNote')}</Text>
    </View>
  );
}

export function EmailPasswordForm({ mode }: { mode: 'signin' | 'signup' }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const valid = /.+@.+\..+/.test(email) && password.length >= 8 && (mode === 'signin' || name.trim().length >= 1);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signin') await signIn({ email: email.trim(), password });
      else await signUp({ email: email.trim(), password, name: name.trim() });
      // Gate in root layout routes onwards.
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="gap-4">
      {mode === 'signup' ? <Input label={t('auth.name')} value={name} onChangeText={setName} autoComplete="name" textContentType="name" /> : null}
      <Input label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
      <Input
        label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
        textContentType={mode === 'signin' ? 'password' : 'newPassword'} hint={mode === 'signup' ? t('auth.errors.weak_password') : undefined} onSubmitEditing={valid ? submit : undefined}
      />
      {error ? <View><Text variant="small" tone="danger" accessibilityLiveRegion="polite">{authErrorMessage(error)}</Text></View> : null}
      <Button title={mode === 'signin' ? t('auth.signIn') : t('auth.signUp')} loading={busy} disabled={!valid} onPress={submit} />
      {mode === 'signin' ? <Link href="/auth/recover" className="self-center"><Text variant="small" tone="primary">{t('auth.forgot')}</Text></Link> : null}
      <View className="flex-row items-center gap-3 py-1"><View className="h-hairline flex-1 bg-border" /><Text variant="caption" tone="tertiary">{t('common.or')}</Text><View className="h-hairline flex-1 bg-border" /></View>
      <OAuthButtons onError={setError} />
      <InlineErrorIfOAuth error={error} />
    </View>
  );
}

function InlineErrorIfOAuth({ error }: { error: unknown }) {
  if (!(error instanceof AuthError) || !error.code.startsWith('oauth')) return null;
  return <InlineError error={new Error(authErrorMessage(error))} />;
}
