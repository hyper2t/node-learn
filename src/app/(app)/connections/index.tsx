import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useBlockUser, useConnectionRequests, useContacts, useCreateConnection, useLookup, useReportUser, useRespondConnection } from '@/features/connections/api';
import { Screen, Section } from '@/shared/layout/screen';
import { Avatar, Badge, Button, Card, InlineError, Input, ListRow, Loading, Separator, Text } from '@/shared/ui';
import { fmt, t } from '@/shared/i18n';
import { useDebounced } from '@/shared/hooks/use-debounced';
import type { ReportInput } from '@/types/api';

const REASONS: ReportInput['reason'][] = ['harassment', 'spam', 'inappropriate', 'other'];

export default function ConnectionsScreen() {
  const router = useRouter();
  const contacts = useContacts();
  const incoming = useConnectionRequests('incoming');
  const outgoing = useConnectionRequests('outgoing');
  const respond = useRespondConnection();
  const create = useCreateConnection();
  const block = useBlockUser();
  const report = useReportUser();
  const [handle, setHandle] = useState('');
  const dh = useDebounced(handle.trim().replace(/^@/, '').toLowerCase(), 400);
  const lookup = useLookup(dh);
  const [msg, setMsg] = useState('');
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [reason, setReason] = useState<ReportInput['reason']>('other');
  const [details, setDetails] = useState('');
  const [done, setDone] = useState<string | null>(null);

  const askBlock = (userId: string) => {
    const go = () => block.mutate(userId);
    if (Platform.OS === 'web') { if (window.confirm(t('contacts.blockConfirm'))) go(); return; }
    Alert.alert('', t('contacts.blockConfirm'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.block'), style: 'destructive', onPress: go }]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('contacts.title') }} />
      <Section title={t('contacts.find')}>
        <Input value={handle} onChangeText={setHandle} placeholder="@handle" autoCapitalize="none" accessibilityLabel={t('contacts.handle')} />
        {lookup.isError ? <Text variant="small" tone="secondary">{t('contacts.notFound')}</Text> : null}
        {lookup.data ? (
          <Card className="gap-2">
            <View className="flex-row items-center gap-3"><Avatar name={lookup.data.displayName} /><View className="flex-1"><Text variant="body-strong">{lookup.data.displayName}</Text><Text variant="small" tone="secondary">@{lookup.data.handle}</Text></View>{lookup.data.roles.map((r) => <Badge key={r} label={t(`role.${r}`)} tone={r} />)}</View>
            <Input value={msg} onChangeText={setMsg} placeholder={t('contacts.message')} maxLength={500} />
            <InlineError error={create.error} />
            {done === lookup.data.userId ? <Text tone="success" variant="small">{t('contacts.sent')}</Text> : (
              <Button title={t('contacts.connect')} loading={create.isPending} onPress={() => create.mutate({ toUserId: lookup.data!.userId, message: msg.trim() }, { onSuccess: () => setDone(lookup.data!.userId) })} />
            )}
          </Card>
        ) : null}
      </Section>

      {incoming.data?.items.length || outgoing.data?.items.length ? (
        <Section title={t('contacts.incoming')}>
          <InlineError error={respond.error} />
          <View className="gap-2">
            {incoming.data?.items.map((r) => (
              <Card key={r.id} className="gap-2">
                <View className="flex-row items-center gap-3"><Avatar name={r.counterpart.displayName} /><View className="flex-1"><Text variant="body-strong">{r.counterpart.displayName}</Text>{r.message ? <Text variant="small" tone="secondary">{r.message}</Text> : null}</View></View>
                <View className="flex-row gap-2">
                  <Button size="sm" variant="secondary" className="flex-1" title={t('common.decline')} onPress={() => respond.mutate({ id: r.id, action: 'decline' })} />
                  <Button size="sm" className="flex-1" title={t('common.accept')} onPress={() => respond.mutate({ id: r.id, action: 'accept' })} />
                </View>
              </Card>
            ))}
            {outgoing.data?.items.map((r) => (
              <Card key={r.id} className="flex-row items-center gap-3">
                <Avatar name={r.counterpart.displayName} /><View className="flex-1"><Text variant="body-strong">{r.counterpart.displayName}</Text><Text variant="caption" tone="tertiary">{t('requests.pending')} · {fmt.relative(r.createdAt)}</Text></View>
                <Button size="sm" variant="ghost" title={t('common.withdraw')} onPress={() => respond.mutate({ id: r.id, action: 'cancel' })} />
              </Card>
            ))}
          </View>
        </Section>
      ) : null}

      <Section title={t('contacts.title')}>
        {contacts.isLoading ? <Loading /> : !contacts.data?.items.length ? <Text variant="small" tone="secondary">{t('contacts.empty')}</Text> : (
          <View className="rounded-lg border border-border bg-surface">
            {contacts.data.items.map((c, i) => (
              <View key={c.userId}>
                {i > 0 ? <Separator /> : null}
                <ListRow title={c.displayName} subtitle={c.handle ? `@${c.handle}` : undefined} left={<Avatar name={c.displayName} />}
                  onPress={c.conversationId ? () => router.push(`/(app)/messages/${c.conversationId}`) : undefined}
                  right={<View className="flex-row gap-1"><Button size="sm" variant="ghost" title={t('common.report')} onPress={() => setReportFor(c.userId)} /><Button size="sm" variant="ghost" title={t('common.block')} onPress={() => askBlock(c.userId)} /></View>} />
              </View>
            ))}
          </View>
        )}
      </Section>

      {reportFor ? (
        <Card className="gap-2">
          <Text variant="h3">{t('contacts.reportTitle')}</Text>
          <View className="flex-row flex-wrap gap-1">{REASONS.map((r) => <Button key={r} size="sm" variant={reason === r ? 'primary' : 'secondary'} title={t(`contacts.reasons.${r}`)} onPress={() => setReason(r)} />)}</View>
          <Input value={details} onChangeText={setDetails} multiline placeholder={t('contacts.reason')} maxLength={2000} />
          <InlineError error={report.error} />
          {report.isSuccess ? <Text tone="success" variant="small">{t('contacts.reported')}</Text> : null}
          <View className="flex-row gap-2">
            <Button variant="secondary" className="flex-1" title={t('common.close')} onPress={() => { setReportFor(null); report.reset(); }} />
            <Button className="flex-1" title={t('common.send')} loading={report.isPending} onPress={() => report.mutate({ targetUserId: reportFor, reason, details: details.trim() || undefined })} />
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}
