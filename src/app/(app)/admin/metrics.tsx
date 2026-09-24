import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';
import { useAdminMetrics } from '@/features/admin/api';
import { useMe } from '@/features/identity/api';
import { Grid, PageHeader, Screen, Section } from '@/shared/layout/screen';
import { Card, Empty, ErrorState, Loading, SegmentedControl, Text } from '@/shared/ui';
import { fmt, t } from '@/shared/i18n';
import type { AdminMetrics, MetricRate } from '@/types/api';

const pct = (r: MetricRate) => (r.pct === null ? '—' : `${r.pct}%`);
const frac = (r: MetricRate) => `${r.num}/${r.den}`;
const num = (v: number | null) => (v === null ? '—' : String(v));
const hours = (v: number | null) => (v === null ? '—' : t('admin.metrics.hours', { n: v }));
/** Week label in Asia/Taipei regardless of the viewer's zone. */
const weekLabel = (iso: string) => new Date(Date.parse(iso) + 8 * 3_600_000).toISOString().slice(5, 10);

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'danger' | 'success' }) {
  return (
    <Card className="min-w-[150px] flex-1 gap-1">
      <Text variant="caption" tone="secondary">{label}</Text>
      <Text variant="h2" tone={tone ?? 'default'}>{value}</Text>
      {hint ? <Text variant="caption" tone="tertiary">{hint}</Text> : null}
    </Card>
  );
}

function KeyValues({ rows }: { rows: [string, string | number][] }) {
  return (
    <Card className="gap-1">
      {rows.map(([k, v]) => (
        <View key={k} className="flex-row justify-between gap-4">
          <Text variant="small" tone="secondary">{k}</Text>
          <Text variant="small-strong">{v}</Text>
        </View>
      ))}
    </Card>
  );
}

const COLS = ['week', 'signups', 'act', 'newRel', 'active', 'evidence', 'perActive', 'fb', 'reviews', 'complete'] as const;

function WeeklyTable({ m }: { m: AdminMetrics }) {
  const cell = (s: string | number, head = false) => <Text variant={head ? 'caption' : 'small'} tone={head ? 'secondary' : 'default'} className="w-[76px]">{s}</Text>;
  return (
    <ScrollView horizontal>
      <View className="gap-1">
        <View className="flex-row">{COLS.map((c) => <View key={c}>{cell(t(`admin.metrics.cols.${c}`), true)}</View>)}</View>
        {[...m.weekly].reverse().map((w) => (
          <View key={w.weekStart} className="flex-row">
            {cell(weekLabel(w.weekStart))}{cell(w.signups)}{cell(pct(w.activation48h))}{cell(w.newRelations)}{cell(w.activeRelations)}
            {cell(w.evidence)}{cell(num(w.evidencePerActive))}{cell(hours(w.feedbackMedianHours))}{cell(w.reviews)}{cell(w.completeRelations)}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export default function AdminMetricsScreen() {
  const me = useMe();
  const isAdmin = !!me.data?.isAdmin;
  const [weeks, setWeeks] = useState<'4' | '12' | '26'>('12');
  const q = useAdminMetrics(Number(weeks), isAdmin);

  if (me.isLoading) return <Loading />;
  if (!isAdmin) return <Screen><Stack.Screen options={{ title: t('admin.metrics.title') }} /><Empty title={t('errors.forbidden')} /></Screen>;
  const m = q.data;
  return (
    <Screen>
      <Stack.Screen options={{ title: t('admin.metrics.title') }} />
      <PageHeader title={t('admin.metrics.title')} body={t('admin.metrics.body')} />
      <SegmentedControl value={weeks} onChange={setWeeks} options={(['4', '12', '26'] as const).map((w) => ({ value: w, label: t('admin.metrics.weeks', { n: w }) }))} />
      {q.isLoading ? <Loading /> : q.isError || !m ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <View className="gap-4 py-4">
          <Grid>
            <Stat label={`★ ${t('admin.metrics.northStar')}`} value={String(m.totals.completeRelations)} hint={t('admin.metrics.northStarHint')} />
            <Stat label={t('admin.metrics.activation')} value={pct(m.totals.activation48h)}
              hint={`${frac(m.totals.activation48h)} · ${t('admin.metrics.students')} ${pct(m.totals.activationStudents)} · ${t('admin.metrics.teachers')} ${pct(m.totals.activationTeachers)}`} />
            <Stat label={t('admin.metrics.evidencePerActive')} value={num(m.totals.evidencePerActiveWeek)} />
            <Stat label={t('admin.metrics.feedbackMedian')} value={hours(m.totals.feedbackMedianHours)} tone={m.totals.feedbackMedianHours !== null && m.totals.feedbackMedianHours > 48 ? 'danger' : undefined} />
            <Stat label={t('admin.metrics.awaiting')} value={String(m.totals.awaitingOver48h)} tone={m.totals.awaitingOver48h ? 'danger' : 'success'} />
            <Stat label={t('admin.metrics.retention')} value={pct(m.totals.retention4w)} hint={frac(m.totals.retention4w)} />
            <Stat label={t('admin.metrics.reviewRate')} value={pct(m.totals.reviewRate)} hint={frac(m.totals.reviewRate)} />
          </Grid>

          {m.awaiting.length ? (
            <Section title={t('admin.metrics.awaiting')}>
              <View className="gap-2">
                {m.awaiting.map((a) => (
                  <Card key={a.evidenceId} className="gap-1">
                    <Text variant="body-strong" numberOfLines={1}>{a.title}</Text>
                    <Text variant="small" tone="secondary">{a.teacherName} ← {a.studentName} · {t('admin.metrics.waited', { n: a.hours })} · {fmt.relative(a.waitingSince)}</Text>
                  </Card>
                ))}
              </View>
            </Section>
          ) : null}

          <Section title={t('admin.metrics.funnel')}>
            <KeyValues rows={(Object.keys(m.funnel) as (keyof AdminMetrics['funnel'])[]).map((k) => [t(`admin.metrics.f.${k}`), m.funnel[k]])} />
          </Section>
          <Section title={t('admin.metrics.qa')}>
            <KeyValues rows={[
              [t('admin.metrics.q.questions'), m.qa.questions],
              [t('admin.metrics.q.answered24h'), `${pct(m.qa.answered24h)} (${frac(m.qa.answered24h)})`],
              [t('admin.metrics.q.accepted'), m.qa.accepted],
              [t('admin.metrics.q.toRequests'), m.qa.toRequests],
            ]} />
          </Section>
          <Section title={t('admin.metrics.weekly')}>
            <Card><WeeklyTable m={m} /></Card>
          </Section>
          <Text variant="caption" tone="tertiary">{t('admin.metrics.excluded', { n: m.excludedUsers })} · {fmt.relative(m.generatedAt)}</Text>
        </View>
      )}
    </Screen>
  );
}
