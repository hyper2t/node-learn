import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/infrastructure/api/errors';

export function createQueryClient(): QueryClient {
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
