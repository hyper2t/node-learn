import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import { t } from '@/shared/i18n';
import { Text } from './text';

/**
 * Thin banner shown while offline. Source of truth is TanStack's onlineManager,
 * which we also feed on native from expo-network in state/query-client (web uses navigator.onLine).
 */
export function OfflineBanner() {
  const [online, setOnline] = useState(onlineManager.isOnline());
  useEffect(() => onlineManager.subscribe(setOnline), []);
  if (online) return null;
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" className="items-center bg-warning-subtle px-3 py-1.5">
      <Text variant="small-strong" tone="default">{t('common.offline')}</Text>
    </View>
  );
}
