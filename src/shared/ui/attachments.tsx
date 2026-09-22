import { useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { pickDocuments, pickImage, uploadFile, UploadError, type PickedFile, type UploadedFile } from '@/infrastructure/uploads';
import { cn } from '@/shared/lib/cn';
import { t } from '@/shared/i18n';
import type { Attachment } from '@/types/api';
import { Button } from './button';
import { Text } from './text';

export type PendingAttachment = { key: string; file: PickedFile; status: 'uploading' | 'done' | 'failed'; progress: number; uploaded?: UploadedFile; error?: string };

const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const ext = (name: string) => (name.split('.').pop() ?? '').toUpperCase().slice(0, 4);

/** Pick + upload files for a purpose; reports the completed file ids upward. */
export function AttachmentPicker({ relationId, max = 5, value, onChange }: { relationId: string; max?: number; value: PendingAttachment[]; onChange: (next: PendingAttachment[]) => void }) {
  const [busy, setBusy] = useState(false);
  const latest = { current: value };

  const update = (key: string, patch: Partial<PendingAttachment>) => {
    latest.current = latest.current.map((a) => (a.key === key ? { ...a, ...patch } : a));
    onChange(latest.current);
  };
  const start = async (files: PickedFile[]) => {
    const room = Math.max(0, max - latest.current.length);
    const items: PendingAttachment[] = files.slice(0, room).map((file) => ({ key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, file, status: 'uploading', progress: 0 }));
    if (!items.length) return;
    latest.current = [...latest.current, ...items];
    onChange(latest.current);
    await Promise.all(items.map(async (it) => {
      try {
        const uploaded = await uploadFile('evidence', it.file, { relationId, onProgress: (p) => update(it.key, { progress: p.total ? p.loaded / p.total : 0 }) });
        update(it.key, { status: 'done', progress: 1, uploaded });
      } catch (e) {
        update(it.key, { status: 'failed', error: e instanceof UploadError ? e.message : t('relation.uploadFailed') });
      }
    }));
  };
  const add = async (kind: 'image' | 'file') => {
    setBusy(true);
    try {
      const picked = kind === 'image' ? [await pickImage()].filter((f): f is PickedFile => !!f) : await pickDocuments(max - value.length);
      await start(picked);
    } finally { setBusy(false); }
  };
  const remove = (key: string) => onChange(value.filter((a) => a.key !== key));

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
      {value.length < max ? (
        <View className="flex-row gap-2">
          <Button size="sm" variant="secondary" title={t('relation.addImage')} disabled={busy} onPress={() => add('image')} />
          <Button size="sm" variant="secondary" title={t('relation.addAttachment')} disabled={busy} onPress={() => add('file')} />
        </View>
      ) : null}
      <Text variant="caption" tone="tertiary">{t('relation.attachmentHint')}</Text>
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

/** Read-only list with preview / open for the evidence detail page. */
export function AttachmentList({ items }: { items: Attachment[] }) {
  if (!items.length) return null;
  const open = (a: Attachment) => (Platform.OS === 'web' ? window.open(a.url, '_blank', 'noopener') : Linking.openURL(a.url));
  const images = items.filter((a) => a.mimeType.startsWith('image/'));
  const files = items.filter((a) => !a.mimeType.startsWith('image/'));
  return (
    <View className="gap-2">
      <Text variant="small-strong">{t('relation.attachments')}</Text>
      {images.length ? (
        <View className="flex-row flex-wrap gap-2">
          {images.map((a) => (
            <Pressable key={a.fileId} onPress={() => open(a)} accessibilityRole="imagebutton" accessibilityLabel={a.fileName} className="overflow-hidden rounded-md border border-border">
              <Image source={{ uri: a.url }} style={{ width: 120, height: 120 }} contentFit="cover" />
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
