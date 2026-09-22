import { useState } from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useLookup } from '@/features/connections/api';
import { useCreateInvitation } from '@/features/requests/api';
import { Screen } from '@/shared/layout/screen';
import { Avatar, Button, Card, InlineError, Input, Text } from '@/shared/ui';
import { t } from '@/shared/i18n';
import { useDebounced } from '@/shared/hooks/use-debounced';

export default function InviteScreen() {
  const router = useRouter();
  const [handle, setHandle] = useState('');
  const dh = useDebounced(handle.trim().replace(/^@/, '').toLowerCase(), 400);
  const lookup = useLookup(dh);
  const [goal, setGoal] = useState('');
  const [message, setMessage] = useState('');
  const invite = useCreateInvitation();
  const u = lookup.data;
  return (
    <Screen>
      <Stack.Screen options={{ title: t('requests.invite') }} />
      <View className="gap-3 py-4">
        <Input label={t('contacts.handle')} value={handle} onChangeText={setHandle} autoCapitalize="none" placeholder="@handle" />
        {lookup.isError ? <Text variant="small" tone="secondary">{t('contacts.notFound')}</Text> : null}
        {u ? (
          <Card className="gap-3">
            <View className="flex-row items-center gap-3"><Avatar name={u.displayName} /><View><Text variant="body-strong">{u.displayName}</Text><Text variant="small" tone="secondary">@{u.handle}</Text></View></View>
            <Input label={t('teachers.goalTitle')} value={goal} onChangeText={setGoal} maxLength={140} />
            <Input label={t('teachers.message')} value={message} onChangeText={setMessage} multiline maxLength={1000} />
            <InlineError error={invite.error} />
            <Button title={t('common.send')} loading={invite.isPending} disabled={goal.trim().length < 3} onPress={() => invite.mutate({ studentId: u.userId, goalTitle: goal.trim(), message: message.trim() }, { onSuccess: (r) => router.replace(`/(app)/requests/${r.id}`) })} />
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}
