import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { pickImage, uploadFile, UploadError } from '@/infrastructure/uploads';
import { qk } from '@/state/query-keys';
import { useRouter } from 'expo-router';
import { useAddRole, useMe, useSetActiveRole, useSignOut } from '@/features/identity/api';
import { Screen, PageHeader, Section } from '@/shared/layout/screen';
import { useUnreadCount } from '@/features/notifications/api';
import { Avatar, Badge, Button, Card, ErrorState, InlineError, Loading, Text } from '@/shared/ui';
import { t } from '@/shared/i18n';
import type { Role } from '@/types/api';

export default function ProfileScreen() {
  const router = useRouter();
  const me = useMe();
  const setActive = useSetActiveRole();
  const addRole = useAddRole();
  const signOut = useSignOut();
  const qc = useQueryClient();
  const notif = useUnreadCount(!!me.data);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const changeAvatar = async () => {
    setAvatarMsg(null);
    const f = await pickImage({ allowsEditing: true, aspect: [1, 1] });
    if (!f) return;
    setAvatarBusy(true);
    try {
      await uploadFile('avatar', f);
      await qc.invalidateQueries({ queryKey: qk.me });
      setAvatarMsg({ tone: 'success', text: t('profile.avatarUpdated') });
    } catch (e) {
      setAvatarMsg({ tone: 'danger', text: e instanceof UploadError ? e.message : t('errors.generic') });
    } finally { setAvatarBusy(false); }
  };
  if (me.isLoading) return <Loading />;
  if (me.isError || !me.data) return <ErrorState error={me.error} onRetry={() => me.refetch()} />;
  const m = me.data;
  const other: Role = m.activeRole === 'student' ? 'teacher' : 'student';
  const hasOther = m.availableRoles.includes(other);
  return (
    <Screen>
      <PageHeader title={t('profile.title')} right={<Button size="sm" variant="secondary" title={t('profile.settings')} onPress={() => router.push('/(app)/settings')} />} />
      <View className="flex-row flex-wrap gap-2 pb-3">
        <Button size="sm" variant="secondary" title={notif.data?.unread ? `${t('notifications.title')} (${notif.data.unread})` : t('notifications.title')} onPress={() => router.push('/(app)/notifications')} />
        <Button size="sm" variant="secondary" title={t('qa.title')} onPress={() => router.push('/(app)/qa')} />
        {m.isAdmin ? <Button size="sm" variant="secondary" title={t('admin.title')} onPress={() => router.push('/(app)/admin/reports')} /> : null}
      </View>
      <Card className="flex-row items-center gap-3">
        <Pressable accessibilityRole="button" accessibilityLabel={t('profile.changeAvatar')} onPress={changeAvatar} disabled={avatarBusy} className={avatarBusy ? 'opacity-50' : undefined}>
          <Avatar name={m.displayName} fileId={m.avatarFileId} size={56} />
        </Pressable>
        <View className="flex-1">
          <Text variant="h3">{m.displayName}</Text>
          {m.handle ? <Text variant="small" tone="secondary">@{m.handle}</Text> : null}
          <View className="mt-1 flex-row gap-1">
            {m.availableRoles.map((r) => <Badge key={r} label={t(`role.${r}`)} tone={r} />)}
            {m.emailVerified ? <Badge label={t('teachers.verifiedEmail')} tone="success" /> : null}
          </View>
          <Button size="sm" variant="ghost" className="mt-1 self-start" title={t('profile.changeAvatar')} loading={avatarBusy} onPress={changeAvatar} />
          {avatarMsg ? <Text variant="caption" tone={avatarMsg.tone}>{avatarMsg.text}</Text> : null}
        </View>
      </Card>
      <Section title={t('role.current')}>
        <Card className="gap-3">
          <Text variant="body-strong">{m.activeRole ? t(`role.${m.activeRole}`) : '—'}</Text>
          <InlineError error={setActive.error ?? addRole.error} />
          {hasOther ? (
            <Button variant="secondary" title={`${t('role.switch')} → ${t(`role.${other}`)}`} loading={setActive.isPending} onPress={() => setActive.mutate(other)} />
          ) : (
            <Button variant="secondary" title={t('role.add', { role: t(`role.${other}`) })} loading={addRole.isPending} onPress={() => addRole.mutate({ role: other, activate: true })} />
          )}
        </Card>
      </Section>
      <Section title={m.activeRole === 'teacher' ? t('onboarding.teacherTitle') : t('onboarding.studentTitle')}>
        <Button variant="secondary" title={t('common.edit')} onPress={() => router.push(m.activeRole === 'teacher' ? '/(app)/settings/teacher-profile' : '/(app)/settings/student-profile')} />
      </Section>
      <Section title={t('contacts.title')}>
        <Button variant="secondary" title={t('contacts.title')} onPress={() => router.push('/(app)/connections')} />
      </Section>
      <View className="py-6">
        <Button variant="ghost" title={t('common.signOut')} loading={signOut.isPending} onPress={() => signOut.mutate()} />
      </View>
    </Screen>
  );
}
