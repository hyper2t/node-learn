import { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { pickDocuments, pickImage, uploadFile, UploadError, UPLOAD_LIMITS, type PickedFile, type UploadedFile } from '@/infrastructure/uploads';
import { useBreakpoint } from '@/shared/hooks/use-breakpoint';
import { useThemeColors } from '@/shared/hooks/use-theme-colors';
import { cn } from '@/shared/lib/cn';
import { t } from '@/shared/i18n';
import type { Attachment, UploadPurpose } from '@/types/api';
import { Button } from './button';
import { Icon, type IconName } from './icon';
import { Text } from './text';

export type PendingAttachment = { key: string; file: PickedFile; status: 'uploading' | 'done' | 'failed'; progress: number; uploaded?: UploadedFile; error?: string };

const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const ext = (name: string) => (name.split('.').pop() ?? '').toUpperCase().slice(0, 4);
const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Ids of the finished uploads, in order — what the API expects as `attachmentFileIds`. */
export const doneFileIds = (items: PendingAttachment[]) => items.filter((a) => a.status === 'done' && a.uploaded).map((a) => a.uploaded!.fileId);
export const isUploading = (items: PendingAttachment[]) => items.some((a) => a.status === 'uploading');

/** Existing server attachments (e.g. when editing) as already-finished items. */
export function fromAttachments(items: Attachment[]): PendingAttachment[] {
  return items.map((a) => {
    const kind = a.mimeType.startsWith('image/') ? 'image' : 'file';
    return {
      key: a.fileId, status: 'done', progress: 1,
      file: { uri: a.url, name: a.fileName, mimeType: a.mimeType, size: a.sizeBytes, kind },
      uploaded: { fileId: a.fileId, bucketId: '', name: a.fileName, mimeType: a.mimeType, size: a.sizeBytes, localUri: a.url },
    };
  });
}

type UploadsOptions = { purpose: UploadPurpose; relationId?: string; max: number; value: PendingAttachment[]; onChange: (next: PendingAttachment[]) => void };

/** Pick → upload → progress/failed bookkeeping shared by every attachment UI. */
function useAttachmentUploads({ purpose, relationId, max, value, onChange }: UploadsOptions) {
  const [busy, setBusy] = useState(false);
  const latest = { current: value };

  const update = (key: string, patch: Partial<PendingAttachment>) => {
    latest.current = latest.current.map((a) => (a.key === key ? { ...a, ...patch } : a));
    onChange(latest.current);
  };
  const run = async (it: PendingAttachment) => {
    try {
      const uploaded = await uploadFile(purpose, it.file, { relationId, onProgress: (p) => update(it.key, { progress: p.total ? p.loaded / p.total : 0 }) });
      update(it.key, { status: 'done', progress: 1, uploaded });
    } catch (e) {
      update(it.key, { status: 'failed', error: e instanceof UploadError ? e.message : t('attachments.failed') });
    }
  };
  const start = async (files: PickedFile[]) => {
    const room = Math.max(0, max - latest.current.length);
    const items: PendingAttachment[] = files.slice(0, room).map((file) => ({ key: newKey(), file, status: 'uploading', progress: 0 }));
    if (!items.length) return;
    latest.current = [...latest.current, ...items];
    onChange(latest.current);
    await Promise.all(items.map(run));
  };
  const add = async (kind: 'image' | 'file') => {
    setBusy(true);
    try {
      const picked = kind === 'image' ? [await pickImage()].filter((f): f is PickedFile => !!f) : await pickDocuments(max - value.length);
      await start(picked);
    } finally { setBusy(false); }
  };
  const retry = (key: string) => {
    const it = latest.current.find((a) => a.key === key);
    if (!it) return;
    update(key, { status: 'uploading', progress: 0, error: undefined });
    void run(it);
  };
  const remove = (key: string) => onChange(value.filter((a) => a.key !== key));
  return { busy, add, retry, remove, full: value.length >= max };
}

/** Pick + upload files for a purpose (evidence form layout: list rows with progress). */
export function AttachmentPicker({ purpose = 'evidence', relationId, max = 5, value, onChange }: {
  purpose?: UploadPurpose; relationId?: string; max?: number; value: PendingAttachment[]; onChange: (next: PendingAttachment[]) => void;
}) {
  const { busy, add, remove, full } = useAttachmentUploads({ purpose, relationId, max, value, onChange });
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text variant="small-strong">{t('relation.attachments')}</Text>
        <Text variant="caption" tone="tertiary">{value.length}/{max}</Text>
      </View>
      <View className="gap-2">
        {value.map((a) => (
          <Pressable key={a.key} onPress={a.status === 'failed' ? () => remove(a.key) : undefined} className={cn('flex-row items-center gap-3 rounded-md border px-3 py-2', a.status === 'failed' ? 'border-danger bg-danger-subtle' : 'border-border bg-surface')}>
            <Thumb uri={a.file.kind === 'image' ? a.file.uri : null} name={a.file.name} />
            <View className="flex-1">
              <Text variant="small-strong" numberOfLines={1}>{a.file.name}</Text>
              <Text variant="caption" tone={a.status === 'failed' ? 'danger' : 'tertiary'}>
                {a.status === 'uploading' ? `${t('relation.uploading')} ${Math.round(a.progress * 100)}%` : a.status === 'failed' ? a.error : fmtSize(a.file.size || a.uploaded?.size || 0)}
              </Text>
              {a.status === 'uploading' ? <View className="mt-1 h-1 overflow-hidden rounded-full bg-element"><View className="h-1 bg-primary" style={{ width: `${Math.max(4, a.progress * 100)}%` }} /></View> : null}
            </View>
            {a.status !== 'uploading' ? <Button size="sm" variant="ghost" title="×" accessibilityLabel={t('common.close')} onPress={() => remove(a.key)} /> : null}
          </Pressable>
        ))}
      </View>
      {!full ? (
        <View className="flex-row gap-2">
          <Button size="sm" variant="secondary" title={t('relation.addImage')} disabled={busy} onPress={() => add('image')} />
          <Button size="sm" variant="secondary" title={t('relation.addAttachment')} disabled={busy} onPress={() => add('file')} />
        </View>
      ) : null}
      <Text variant="caption" tone="tertiary">{t('relation.attachmentHint')}</Text>
    </View>
  );
}

function BarButton({ icon, label, iconOnly, disabled, onPress }: { icon: IconName; label: string; iconOnly: boolean; disabled: boolean; onPress: () => void }) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      {...(Platform.OS === 'web' ? ({ title: label } as object) : null)}
      hitSlop={4}
      className={cn('min-h-[44px] min-w-[44px] flex-row items-center justify-center gap-1.5 rounded-md border border-border bg-surface active:bg-element', iconOnly ? 'px-2.5' : 'px-3', disabled && 'opacity-50')}
    >
      <Icon name={icon} size={18} color={colors.foregroundSecondary} />
      {!iconOnly ? <Text variant="small-strong" tone="secondary">{label}</Text> : null}
    </Pressable>
  );
}

/** One uploaded/uploading item as a square tile (images) or a file chip. */
function Tile({ a, compact, onRemove, onRetry }: { a: PendingAttachment; compact: boolean; onRemove: () => void; onRetry: () => void }) {
  const size = compact ? 56 : 72;
  const failed = a.status === 'failed';
  const isImage = a.file.kind === 'image';
  return (
    <View
      accessibilityLabel={`${a.file.name}${failed ? `, ${a.error ?? t('attachments.failed')}` : a.status === 'uploading' ? `, ${t('attachments.uploading')}` : ''}`}
      className={cn('overflow-hidden rounded-md border', failed ? 'border-danger bg-danger-subtle' : 'border-border bg-surface')}
      style={isImage ? { width: size, height: size } : { height: size, width: compact ? 152 : 200 }}
    >
      {isImage ? (
        <Image source={{ uri: a.file.uri }} style={{ width: '100%', height: '100%', opacity: a.status === 'uploading' ? 0.55 : 1 }} contentFit="cover" />
      ) : (
        <View className="flex-1 flex-row items-center gap-2 px-2">
          <View className="h-9 w-9 items-center justify-center rounded-sm bg-element"><Text variant="caption" tone="secondary">{ext(a.file.name) || 'FILE'}</Text></View>
          <View className="min-w-0 flex-1">
            <Text variant="caption" numberOfLines={compact ? 1 : 2}>{a.file.name}</Text>
            <Text variant="caption" tone={failed ? 'danger' : 'tertiary'} numberOfLines={1}>
              {failed ? t('attachments.failedShort') : a.status === 'uploading' ? `${Math.round(a.progress * 100)}%` : fmtSize(a.file.size || a.uploaded?.size || 0)}
            </Text>
          </View>
        </View>
      )}
      {a.status === 'uploading' ? (
        <View className="absolute bottom-0 left-0 right-0 h-1 bg-element"><View className="h-1 bg-primary" style={{ width: `${Math.max(4, a.progress * 100)}%` }} /></View>
      ) : null}
      {failed && isImage ? (
        <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel={t('attachments.retry')} className="absolute inset-0 items-center justify-center bg-danger-subtle/80">
          <Text variant="caption" tone="danger">{t('attachments.retry')}</Text>
        </Pressable>
      ) : null}
      {failed && !isImage ? (
        <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel={t('attachments.retry')} className="absolute bottom-0.5 right-7 px-1">
          <Text variant="caption" tone="primary">{t('attachments.retry')}</Text>
        </Pressable>
      ) : null}
      {a.status !== 'uploading' ? (
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={t('attachments.remove', { name: a.file.name })}
          hitSlop={8}
          className="absolute right-0.5 top-0.5 h-6 w-6 items-center justify-center rounded-full bg-foreground/70"
        >
          <Text variant="caption" tone="onPrimary">×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Composer attachment bar (Q&A): [Image] [File] actions + count, with uploaded items as tiles.
 * - Phone: tiles in one horizontally scrolling strip; `compact` shows icon-only buttons.
 * - Tablet/desktop: tiles wrap onto more rows; buttons keep their labels unless `compact`.
 */
export function AttachmentBar({ purpose, relationId, max = 5, value, onChange, compact = false }: {
  purpose: UploadPurpose; relationId?: string; max?: number; value: PendingAttachment[]; onChange: (next: PendingAttachment[]) => void; compact?: boolean;
}) {
  const bp = useBreakpoint();
  const phone = bp === 'phone';
  const { busy, add, retry, remove, full } = useAttachmentUploads({ purpose, relationId, max, value, onChange });
  const iconOnly = compact;
  const tiles = value.map((a) => <Tile key={a.key} a={a} compact={compact || phone} onRemove={() => remove(a.key)} onRetry={() => retry(a.key)} />);
  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap items-center gap-2">
        <BarButton icon="image" label={t('attachments.addImage')} iconOnly={iconOnly} disabled={busy || full} onPress={() => { void add('image'); }} />
        <BarButton icon="paperclip" label={t('attachments.addFile')} iconOnly={iconOnly} disabled={busy || full} onPress={() => { void add('file'); }} />
        <View className="min-w-0 flex-1 items-end">
          <Text variant="caption" tone="tertiary" numberOfLines={phone ? 1 : 2} className="text-right">
            {value.length}/{max}{!compact && !phone ? ` · ${UPLOAD_LIMITS[purpose].label}` : ''}
          </Text>
        </View>
      </View>
      {value.length ? (
        phone ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pr-2 pt-0.5">{tiles}</ScrollView>
        ) : (
          <View className="flex-row flex-wrap gap-2">{tiles}</View>
        )
      ) : null}
      {phone && !compact ? <Text variant="caption" tone="tertiary">{UPLOAD_LIMITS[purpose].label}</Text> : null}
    </View>
  );
}

function Thumb({ uri, name }: { uri: string | null; name: string }) {
  return uri ? (
    <Image source={{ uri }} style={{ width: 44, height: 44, borderRadius: 6 }} contentFit="cover" accessibilityLabel={name} />
  ) : (
    <View className="h-11 w-11 items-center justify-center rounded-sm bg-element"><Text variant="caption" tone="secondary">{ext(name) || 'FILE'}</Text></View>
  );
}

/** Read-only list with preview / open (evidence detail, Q&A question and answers). */
export function AttachmentList({ items, title = t('relation.attachments'), showTitle = true }: { items: Attachment[]; title?: string; showTitle?: boolean }) {
  const bp = useBreakpoint();
  if (!items.length) return null;
  const open = (a: Attachment) => (Platform.OS === 'web' ? window.open(a.url, '_blank', 'noopener') : Linking.openURL(a.url));
  const images = items.filter((a) => a.mimeType.startsWith('image/'));
  const files = items.filter((a) => !a.mimeType.startsWith('image/'));
  const thumb = bp === 'desktop' ? 140 : bp === 'tablet' ? 128 : 104;
  return (
    <View className="gap-2">
      {showTitle ? <Text variant="small-strong">{title}</Text> : null}
      {images.length ? (
        <View className="flex-row flex-wrap gap-2">
          {images.map((a) => (
            <Pressable key={a.fileId} onPress={() => open(a)} accessibilityRole="imagebutton" accessibilityLabel={a.fileName} className="overflow-hidden rounded-md border border-border">
              <Image source={{ uri: a.url }} style={{ width: thumb, height: thumb }} contentFit="cover" />
            </Pressable>
          ))}
        </View>
      ) : null}
      {files.map((a) => (
        <Pressable key={a.fileId} onPress={() => open(a)} accessibilityRole="link" className="flex-row items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 active:bg-element">
          <View className="h-10 w-10 items-center justify-center rounded-sm bg-element"><Text variant="caption" tone="secondary">{ext(a.fileName) || 'FILE'}</Text></View>
          <View className="flex-1"><Text variant="small-strong" numberOfLines={1}>{a.fileName}</Text><Text variant="caption" tone="tertiary">{fmtSize(a.sizeBytes)}</Text></View>
          <Text variant="small-strong" tone="primary">{t('relation.open')}</Text>
        </Pressable>
      ))}
    </View>
  );
}
