import { useCallback, useEffect } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { create } from 'zustand';
import { t } from '@/shared/i18n';
import { Button } from './button';
import { Text } from './text';

export type ConfirmOptions = { title?: string; message: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean };
type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };
type DialogState = { pending: Pending | null; open: (p: Pending) => void; close: (ok: boolean) => void };

const useDialogStore = create<DialogState>((set, get) => ({
  pending: null,
  open: (p) => { get().pending?.resolve(false); set({ pending: p }); },
  close: (ok) => { const p = get().pending; set({ pending: null }); p?.resolve(ok); },
}));

/** Imperative confirm that renders the same accessible dialog on web and native (replaces window.confirm / Alert.alert). */
export function confirm(opts: ConfirmOptions | string): Promise<boolean> {
  const o = typeof opts === 'string' ? { message: opts } : opts;
  return new Promise((resolve) => useDialogStore.getState().open({ ...o, resolve }));
}

/** Hook form for components that prefer a callback style. */
export function useConfirm() {
  return useCallback((opts: ConfirmOptions | string, onOk: () => void) => { void confirm(opts).then((ok) => { if (ok) onOk(); }); }, []);
}

/** Mount once at the root. */
export function DialogHost() {
  const pending = useDialogStore((s) => s.pending);
  const close = useDialogStore((s) => s.close);
  useEffect(() => {
    if (!pending || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false); if (e.key === 'Enter') close(true); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pending, close]);
  if (!pending) return null;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => close(false)} accessibilityViewIsModal>
      <Pressable className="flex-1 items-center justify-center bg-black/40 p-6" onPress={() => close(false)} accessibilityLabel={t('common.close')}>
        <Pressable className="w-full max-w-[420px] gap-4 rounded-xl border border-border bg-surface p-5 shadow-lg" onPress={() => {}} accessibilityRole="alert" accessibilityLiveRegion="assertive">
          {pending.title ? <Text variant="h3">{pending.title}</Text> : null}
          <Text variant="body" tone="secondary">{pending.message}</Text>
          <View className="flex-row justify-end gap-2">
            <Button size="sm" variant="secondary" title={pending.cancelLabel ?? t('common.cancel')} onPress={() => close(false)} />
            <Button size="sm" variant={pending.destructive ? 'danger' : 'primary'} title={pending.confirmLabel ?? t('common.continue')} onPress={() => close(true)} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
