import { Platform } from 'react-native';
import { QueryClient, onlineManager } from '@tanstack/react-query';
import { ApiError } from '@/infrastructure/api/errors';

/**
 * Feed TanStack's onlineManager on native from expo-network so paused mutations
 * (message outbox) resume and the OfflineBanner reflects reality. Web already
 * listens to navigator.onLine by default.
 */
let wired = false;
function wireOnlineManager(): void {
  if (wired || Platform.OS === 'web') return;
  wired = true;
  onlineManager.setEventListener((setOnline) => {
    let sub: { remove: () => void } | null = null;
    void (async () => {
      const Network = await import('expo-network');
      const state = await Network.getNetworkStateAsync().catch(() => null);
      if (state) setOnline(!!state.isConnected && state.isInternetReachable !== false);
      sub = Network.addNetworkStateListener((s) => setOnline(!!s.isConnected && s.isInternetReachable !== false));
    })();
    return () => sub?.remove();
  });
}

export function createQueryClient(): QueryClient {
  wireOnlineManager();
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (count, error) => (error instanceof ApiError && !error.isRetryable ? false : count < 2),
      },
      mutations: { retry: false },
    },
  });
}
