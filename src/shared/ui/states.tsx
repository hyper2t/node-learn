import { ActivityIndicator, View } from 'react-native';
import { t } from '@/shared/i18n';
import { useThemeColors } from '@/shared/hooks/use-theme-colors';
import { ApiError } from '@/infrastructure/api';
import { Button } from './button';
import { Text } from './text';

export function Loading({ label }: { label?: string }) {
  const c = useThemeColors();
  return (
    <View className="flex-1 items-center justify-center gap-3 p-6" accessibilityRole="progressbar">
      <ActivityIndicator color={c.primary} />
      {label ? <Text variant="small" tone="secondary">{label}</Text> : null}
    </View>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: { title: string; onPress: () => void } }) {
  return (
    <View className="flex-1 items-center justify-center gap-2 p-8">
      <Text variant="h3" className="text-center">{title}</Text>
      {body ? <Text variant="small" tone="secondary" className="text-center">{body}</Text> : null}
      {action ? <Button variant="secondary" className="mt-3" title={action.title} onPress={action.onPress} /> : null}
    </View>
  );
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'email_not_verified') return t('errors.email_not_verified');
    if (err.code === 'age_gate_required') return t('errors.age_gate_required');
    if (err.code === 'duplicate_request') return t('errors.duplicate_request');
    if (err.code === 'blocked') return t('errors.blocked');
    if (err.code === 'handle_taken') return t('errors.handle_taken');
    switch (err.kind) {
      case 'network': return t('errors.network');
      case 'timeout': return t('errors.timeout');
      case 'unauthorized': return t('errors.unauthorized');
      case 'forbidden': return t('errors.forbidden');
      case 'not_found': return t('errors.not_found');
      case 'rate_limited': return t('errors.rate_limited');
      case 'validation': return err.message || t('errors.validation');
      case 'conflict': return t('errors.conflict');
      default: return t('errors.generic');
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return t('errors.generic');
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 p-8" accessibilityLiveRegion="polite">
      <Text variant="body" tone="secondary" className="text-center">{errorMessage(error)}</Text>
      {onRetry ? <Button variant="secondary" title={t('common.retry')} onPress={onRetry} /> : null}
    </View>
  );
}

export function InlineError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <View className="rounded-md bg-danger-subtle px-3 py-2" accessibilityLiveRegion="polite">
      <Text variant="small" tone="danger">{errorMessage(error)}</Text>
    </View>
  );
}
