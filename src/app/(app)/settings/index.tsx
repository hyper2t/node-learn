import { useState } from 'react';
import { Platform, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { meApi, useDeleteAccount, useIdentities, useMe, useUnlinkIdentity } from '@/features/identity/api';
import { Screen, Section } from '@/shared/layout/screen';
import { Badge, Button, Card, InlineError, ListRow, Separator, Text, confirm } from '@/shared/ui';
import { t } from '@/shared/i18n';

export default function SettingsScreen() {
  const router = useRouter();
  const me = useMe();
  const ids = useIdentities();
  const unlink = useUnlinkIdentity();
  const del = useDeleteAccount();
  const [exported, setExported] = useState<string | null>(null);
  const [exportErr, setExportErr] = useState<unknown>(null);

  const doExport = async () => {
    try {
      const data = await meApi.exportData();
      const json = JSON.stringify(data, null, 2);
      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'node-learn-export.json'; a.click(); URL.revokeObjectURL(url);
        setExported('node-learn-export.json');
      } else setExported(json.slice(0, 4000));
    } catch (e) { setExportErr(e); }
  };
  const askDelete = () => {
    const go = () => del.mutate(undefined, { onSettled: () => router.replace('/auth') });
    void confirm({ title: t('profile.delete'), message: t('profile.deleteConfirm'), confirmLabel: t('profile.delete'), destructive: true }).then((ok) => { if (ok) go(); });
  };
  const canUnlink = (ids.data?.length ?? 0) > 1;

  return (
    <Screen>
      <Stack.Screen options={{ title: t('profile.settings') }} />
      <Section title={t('profile.title')}>
        <Card className="gap-1">
          <Text variant="small" tone="secondary">{t('profile.email')}</Text>
          <View className="flex-row items-center gap-2"><Text>{me.data?.email}</Text>{me.data?.emailVerified ? <Badge label={t('teachers.verifiedEmail')} tone="success" /> : <Button size="sm" variant="ghost" title={t('auth.resend')} onPress={() => router.push('/auth/verify')} />}</View>
        </Card>
        <Button variant="secondary" title={`${t('common.edit')} · ${t('role.student')}`} onPress={() => router.push('/(app)/settings/student-profile')} />
        <Button variant="secondary" title={`${t('common.edit')} · ${t('role.teacher')}`} onPress={() => router.push('/(app)/settings/teacher-profile')} />
      </Section>
      <Section title={t('auth.linked')}>
        <View className="rounded-lg border border-border bg-surface">
          {(ids.data ?? []).map((i, n) => (
            <View key={i.id}>{n > 0 ? <Separator /> : null}
              <ListRow title={i.provider} subtitle={i.providerEmail ?? undefined} right={canUnlink && i.provider !== 'email' ? <Button size="sm" variant="ghost" title={t('auth.unlink')} loading={unlink.isPending} onPress={() => unlink.mutate(i.id)} /> : undefined} />
            </View>
          ))}
        </View>
        <Text variant="caption" tone="tertiary">{t('auth.keepOne')}</Text>
        <InlineError error={unlink.error} />
      </Section>
      <Section title={t('profile.privacy')}>
        <Button variant="secondary" title={t('profile.export')} onPress={doExport} />
        {exported ? <Text variant="caption" tone="secondary" numberOfLines={12}>{exported}</Text> : null}
        <InlineError error={exportErr} />
        <Button variant="danger" title={t('profile.delete')} loading={del.isPending} onPress={askDelete} />
        <InlineError error={del.error} />
      </Section>
      <Section title={t('profile.legal')}>
        <View className="rounded-lg border border-border bg-surface">
          <ListRow title={t('profile.privacyNotice')} onPress={() => router.push('/legal/privacy')} />
          <Separator />
          <ListRow title={t('profile.terms')} onPress={() => router.push('/legal/terms')} />
        </View>
      </Section>
    </Screen>
  );
}
