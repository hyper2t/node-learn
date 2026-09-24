import { useState } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, type Href } from 'expo-router';
import { useMe } from '@/features/identity/api';
import { useReports, useResolveReport } from '@/features/admin/api';
import { Screen, PageHeader } from '@/shared/layout/screen';
import { Avatar, Badge, Button, Card, Empty, ErrorState, InlineError, Input, Loading, SegmentedControl, Text, confirm } from '@/shared/ui';
import { fmt, t } from '@/shared/i18n';
import type { ReportAction, ReportItem, ReportStatus } from '@/types/api';

function ReportCard({ r, onResolve, busy }: { r: ReportItem; onResolve: (action: ReportAction, note: string) => void; busy: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const isContent = r.targetType !== 'user';
  const confirmRemove = () => {
    void confirm({ title: t('admin.actions.remove_content'), message: t('admin.removeConfirm'), confirmLabel: t('admin.actions.remove_content'), destructive: true })
      .then((ok) => { if (ok) onResolve('remove_content', note.trim()); });
  };
  const confirmSuspend = () => {
    const go = () => onResolve('suspend', note.trim());
    void confirm({ title: t('admin.suspend'), message: t('admin.suspendConfirm'), confirmLabel: t('admin.suspend'), destructive: true }).then((ok) => { if (ok) go(); });
  };
  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-3">
        <Avatar name={r.target.displayName} fileId={r.target.avatarFileId} />
        <View className="flex-1">
          <Text variant="body-strong">{r.target.displayName}{r.target.handle ? ` · @${r.target.handle}` : ''}</Text>
          <Text variant="caption" tone="tertiary">{t('admin.reportedBy', { name: r.reporter.displayName })} · {fmt.relative(r.createdAt)}</Text>
        </View>
        <Badge label={t(`contacts.reasons.${r.reason}`)} tone={r.reason === 'harassment' ? 'danger' : 'neutral'} />
      </View>
      {isContent ? (
        <View className="gap-1 rounded-md bg-element p-3">
          <Badge label={t(`admin.targets.${r.targetType}`)} />
          <Text variant="small">{r.contentExcerpt ?? t('admin.removedContent')}</Text>
          {r.contentHref ? <Button size="sm" variant="ghost" className="self-start" title={t('admin.viewContent')} onPress={() => router.push(r.contentHref as Href)} /> : null}
        </View>
      ) : null}
      {r.details ? <Text variant="small" tone="secondary">{r.details}</Text> : null}
      {r.status === 'resolved' ? (
        <Text variant="small" tone="secondary">{t('admin.resolvedAs', { action: t(`admin.actions.${r.resolution ?? 'dismiss'}`) })}{r.resolvedAt ? ` · ${fmt.relative(r.resolvedAt)}` : ''}</Text>
      ) : (
        <>
          <Input value={note} onChangeText={setNote} placeholder={t('admin.note')} maxLength={1000} />
          <View className="flex-row gap-2">
            <Button size="sm" variant="secondary" className="flex-1" title={t('admin.actions.dismiss')} disabled={busy} onPress={() => onResolve('dismiss', note.trim())} />
            <Button size="sm" variant="secondary" className="flex-1" title={t('admin.actions.warn')} disabled={busy} onPress={() => onResolve('warn', note.trim())} />
            <Button size="sm" variant="danger" className="flex-1" title={t('admin.actions.suspend')} disabled={busy} onPress={confirmSuspend} />
          </View>
          {isContent && r.contentExcerpt ? <Button size="sm" variant="danger" title={t('admin.actions.remove_content')} disabled={busy} onPress={confirmRemove} /> : null}
        </>
      )}
    </Card>
  );
}

export default function AdminReportsScreen() {
  const me = useMe();
  const isAdmin = !!me.data?.isAdmin;
  const [status, setStatus] = useState<ReportStatus>('open');
  const reports = useReports(status, isAdmin);
  const resolve = useResolveReport();
  const items = reports.data?.pages.flatMap((p) => p.items) ?? [];

  if (me.isLoading) return <Loading />;
  if (!isAdmin) return <Screen><Stack.Screen options={{ title: t('admin.title') }} /><Empty title={t('errors.forbidden')} /></Screen>;
  return (
    <Screen>
      <Stack.Screen options={{ title: t('admin.title') }} />
      <PageHeader title={t('admin.reports')} body={t('admin.reportsBody')} />
      <SegmentedControl value={status} onChange={setStatus} options={[{ value: 'open', label: t('admin.open') }, { value: 'resolved', label: t('admin.resolved') }]} />
      <InlineError error={resolve.error} />
      <View className="gap-3 py-3">
        {reports.isLoading ? <Loading /> : reports.isError ? <ErrorState error={reports.error} onRetry={() => reports.refetch()} /> : items.length === 0 ? (
          <Empty title={t('admin.empty')} />
        ) : items.map((r) => (
          <ReportCard key={r.id} r={r} busy={resolve.isPending} onResolve={(action, note) => resolve.mutate({ id: r.id, action, note: note || undefined })} />
        ))}
        {reports.hasNextPage ? <Button variant="secondary" title={t('common.continue')} loading={reports.isFetchingNextPage} onPress={() => reports.fetchNextPage()} /> : null}
      </View>
    </Screen>
  );
}
