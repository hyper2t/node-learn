import { Redirect } from 'expo-router';
import { useAuth } from '@/state/auth';
import { Loading } from '@/shared/ui';

/**
 * Entry route. The Gate in the root layout only corrects the route after it mounts,
 * which races with this redirect on cold start — so guests are sent to auth here.
 */
export default function Index() {
  const auth = useAuth();
  if (auth.status === 'loading') return <Loading />;
  return <Redirect href={auth.status === 'authenticated' ? '/(app)/(tabs)' : '/auth'} />;
}
