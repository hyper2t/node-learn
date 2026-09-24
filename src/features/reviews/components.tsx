import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Avatar, Badge, Button, Card, Checkbox, InlineError, Input, SegmentedControl, Text } from '@/shared/ui';
import { fmt, t } from '@/shared/i18n';
import { REVIEW_TAGS, type ReportInput, type ReviewTag, type TeacherReview } from '@/types/api';
import { useRelationReview, useReplyToReview, useReportReview, useTeacherReviews, useUpsertReview } from './api';

export function Stars({ value, onChange, size = 'body' }: { value: number; onChange?: (v: number) => void; size?: 'body' | 'h2' }) {
  return (
    <View className="flex-row gap-1" accessibilityLabel={onChange ? undefined : t('reviews.starsLabel', { n: value })}>
      {[1, 2, 3, 4, 5].map((n) => {
        const star = <Text variant={size} tone={n <= value ? 'primary' : 'tertiary'}>{n <= value ? '★' : '☆'}</Text>;
        return onChange
          ? <Pressable key={n} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('reviews.starsLabel', { n })} onPress={() => onChange(n)}>{star}</Pressable>
          : <View key={n}>{star}</View>;
      })}
    </View>
  );
}

const REASONS: ReportInput['reason'][] = ['spam', 'harassment', 'inappropriate', 'other'];

function ReportReview({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportInput['reason']>('spam');
  const report = useReportReview();
  if (report.isSuccess) return <Text variant="caption" tone="secondary">{t('qa.reported')}</Text>;
  if (!open) return <Button size="sm" variant="ghost" className="self-start" title={t('common.report')} onPress={() => setOpen(true)} />;
  return (
    <View className="gap-2">
      <SegmentedControl value={reason} onChange={setReason} options={REASONS.map((r) => ({ value: r, label: t(`contacts.reasons.${r}`) }))} />
      <InlineError error={report.error} />
      <View className="flex-row gap-2">
        <Button size="sm" variant="secondary" className="flex-1" title={t('common.cancel')} onPress={() => setOpen(false)} />
        <Button size="sm" variant="danger" className="flex-1" title={t('common.report')} loading={report.isPending} onPress={() => report.mutate({ id, reason })} />
      </View>
    </View>
  );
}

function ReplyEditor({ review, onDone }: { review: TeacherReview; onDone: () => void }) {
  const [text, setText] = useState(review.reply ?? '');
  const reply = useReplyToReview(review);
  return (
    <View className="gap-2">
      <Input label={t('reviews.yourReply')} value={text} onChangeText={setText} multiline maxLength={500} />
      <InlineError error={reply.error} />
      <View className="flex-row gap-2">
        <Button size="sm" variant="secondary" className="flex-1" title={t('common.cancel')} onPress={onDone} />
        <Button size="sm" className="flex-1" title={t('common.save')} loading={reply.isPending} onPress={() => reply.mutate(text.trim(), { onSuccess: onDone })} />
      </View>
    </View>
  );
}

/** One review. `viewer`: the reviewed teacher may reply; other members (not the author) may report. */
export function ReviewItem({ review, viewer }: { review: TeacherReview; viewer: 'teacher' | 'author' | 'other' }) {
  const [replying, setReplying] = useState(false);
  return (
    <Card className="gap-2">
      <View className="flex-row items-center gap-2">
        <Avatar name={review.author.displayName} fileId={review.author.avatarFileId} size={28} />
        <Text variant="small-strong" className="flex-1">{review.author.displayName}</Text>
        <Text variant="caption" tone="tertiary">{fmt.date(review.createdAt)}</Text>
      </View>
      <Stars value={review.rating} />
      {review.tags.length ? <View className="flex-row flex-wrap gap-1">{review.tags.map((tg) => <Badge key={tg} label={t(`reviews.tags.${tg}`)} tone="success" />)}</View> : null}
      {review.body ? <Text>{review.body}</Text> : null}
      {viewer !== 'other' && review.anonymous ? <Text variant="caption" tone="tertiary">{t('reviews.postedAnonymously')}</Text> : null}
      {review.reply && !replying ? (
        <View className="gap-1 rounded-md bg-element p-2">
          <Text variant="caption" tone="secondary">{t('reviews.teacherReply')}</Text>
          <Text variant="small">{review.reply}</Text>
        </View>
      ) : null}
      {viewer === 'teacher' && !replying ? <Button size="sm" variant="ghost" className="self-start" title={review.reply ? t('reviews.editReply') : t('reviews.reply')} onPress={() => setReplying(true)} /> : null}
      {viewer === 'teacher' && replying ? <ReplyEditor review={review} onDone={() => setReplying(false)} /> : null}
      {viewer === 'other' ? <ReportReview id={review.id} /> : null}
    </Card>
  );
}

function ReviewForm({ relationId, teacherId, initial, onDone }: { relationId: string; teacherId: string; initial: TeacherReview | null; onDone: () => void }) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [body, setBody] = useState(initial?.body ?? '');
  const [tags, setTags] = useState<ReviewTag[]>(initial?.tags ?? []);
  const [anonymous, setAnonymous] = useState(initial?.anonymous ?? false);
  const save = useUpsertReview(relationId, teacherId);
  const toggle = (tg: ReviewTag) => setTags((cur) => (cur.includes(tg) ? cur.filter((x) => x !== tg) : [...cur, tg]));
  return (
    <View className="gap-3">
      <Stars value={rating} onChange={setRating} size="h2" />
      <View className="flex-row flex-wrap gap-2">
        {REVIEW_TAGS.map((tg) => (
          <Pressable key={tg} accessibilityRole="checkbox" accessibilityState={{ checked: tags.includes(tg) }} onPress={() => toggle(tg)}>
            <Badge label={t(`reviews.tags.${tg}`)} tone={tags.includes(tg) ? 'success' : 'neutral'} />
          </Pressable>
        ))}
      </View>
      <Input label={t('reviews.body')} value={body} onChangeText={setBody} multiline maxLength={800} placeholder={t('common.optional')} />
      <Checkbox checked={anonymous} onChange={setAnonymous} label={t('reviews.anonymous')} />
      <Text variant="caption" tone="tertiary">{t('reviews.privacyHint')}</Text>
      <InlineError error={save.error} />
      <View className="flex-row gap-2">
        {initial ? <Button variant="secondary" className="flex-1" title={t('common.cancel')} onPress={onDone} /> : null}
        <Button className="flex-1" title={t('reviews.submit')} disabled={rating < 1} loading={save.isPending}
          onPress={() => save.mutate({ rating, body: body.trim(), tags, anonymous }, { onSuccess: onDone })} />
      </View>
    </View>
  );
}

/** On the relation page: the learner writes/edits; the teacher reads and replies. */
export function RelationReviewCard({ relationId, teacherId, isStudent }: { relationId: string; teacherId: string; isStudent: boolean }) {
  const q = useRelationReview(relationId);
  const [editing, setEditing] = useState(false);
  if (!q.data) return null;
  const { review, canWrite, eligibleFrom } = q.data;
  if (!isStudent) return review ? <View className="my-4 gap-2"><Text variant="h3">{t('reviews.fromLearner')}</Text><ReviewItem review={review} viewer="teacher" /></View> : null;
  if (!review && !canWrite) {
    return eligibleFrom ? <Text variant="small" tone="tertiary" className="my-4">{t('reviews.availableFrom', { date: fmt.date(eligibleFrom) })}</Text> : null;
  }
  return (
    <Card className="my-4 gap-2">
      <Text variant="h3">{review ? t('reviews.yourReview') : t('reviews.writeTitle')}</Text>
      {review && !editing ? (
        <>
          <ReviewItem review={review} viewer="author" />
          {canWrite ? (
            <>
              <Text variant="caption" tone="tertiary">{t('reviews.editableUntil', { date: fmt.date(review.editableUntil) })}</Text>
              <Button size="sm" variant="secondary" className="self-start" title={t('common.edit')} onPress={() => setEditing(true)} />
            </>
          ) : null}
        </>
      ) : (
        <ReviewForm relationId={relationId} teacherId={teacherId} initial={review} onDone={() => setEditing(false)} />
      )}
    </Card>
  );
}

/** Public list on the teacher profile. */
export function TeacherReviewsSection({ teacherId, viewerId }: { teacherId: string; viewerId: string | undefined }) {
  const q = useTeacherReviews(teacherId);
  const pages = q.data?.pages ?? [];
  const items = pages.flatMap((p) => p.items);
  const summary = pages[0]?.summary;
  if (!summary || summary.count === 0) return null;
  const viewer = (r: TeacherReview) => (viewerId === r.teacherId ? 'teacher' : viewerId === r.author.userId ? 'author' : 'other');
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <Text variant="h3">{t('reviews.title', { n: summary.count })}</Text>
        {summary.avgRating !== null ? <><Stars value={Math.round(summary.avgRating)} /><Text variant="small-strong">{summary.avgRating.toFixed(1)}</Text></> : null}
      </View>
      {summary.avgRating === null ? <Text variant="caption" tone="tertiary">{t('reviews.averageHidden')}</Text> : null}
      {items.map((r) => <ReviewItem key={r.id} review={r} viewer={viewer(r)} />)}
      {q.hasNextPage ? <Button size="sm" variant="secondary" className="self-start" title={t('reviews.more')} loading={q.isFetchingNextPage} onPress={() => q.fetchNextPage()} /> : null}
    </View>
  );
}
