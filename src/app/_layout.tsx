import '../global.css';
import { useEffect, useMemo } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { getCurrentUser } from '@/infrastructure/appwrite';
import { createQueryClient } from '@/state/query-client';
import { useAuth } from '@/state/auth';
import { useMe } from '@/features/identity/api';
import { DialogHost, OfflineBanner } from '@/shared/ui';
import { DocumentTitle } from '@/shared/layout/document-title';
import { SplashTransition } from '@/shared/layout/splash-transition';
import { useThemeColors } from '@/shared/hooks/use-theme-colors';
import { t } from '@/shared/i18n';

export { ErrorBoundary } from 'expo-router';

/**
 * Route guard. Groups:
 *  auth/*        guest only (except oauth-return / verify which work either way)
 *  onboarding/*  authenticated but age-gate / role / profile incomplete
 *  (app)/*       authenticated + onboarded
 */
function Gate({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();
  const authed = auth.status === 'authenticated';
  const me = useMe(authed);

  const top = segments[0];
  const inAuth = top === 'auth';
  const passThrough = top === 'legal' || (inAuth && (segments[1] === 'oauth-return' || segments[1] === 'verify' || segments[1] === 'reset'));
  const ready = auth.status !== 'loading' && (!authed || me.data || me.isError);

  const target = useMemo(() => {
    if (!ready || passThrough) return null;
    if (!authed) return inAuth ? null : '/auth';
    const m = me.data;
    if (!m) return null; // error state: let screens surface it
    if (!m.ageBand || !m.privacyAcceptedAt) return top === 'onboarding' && segments[1] === 'age-gate' ? null : '/onboarding/age-gate';
    if (m.availableRoles.length === 0 || !m.activeRole) return top === 'onboarding' && segments[1] === 'role' ? null : '/onboarding/role';
    const role = m.activeRole;
    if (!m.onboarding[role]) {
      const p = role === 'student' ? 'student-profile' : 'teacher-profile';
      return top === 'onboarding' && segments[1] === p ? null : `/onboarding/${p}`;
    }
    if (inAuth || top === 'onboarding' || top === undefined) return '/';
    return null;
  }, [ready, passThrough, authed, inAuth, me.data, top, segments]);

  useEffect(() => {
    if (target) router.replace(target as never);
  }, [target, router]);

  // Same branded surface the OAuth return screen shows, so the hand-off from
  // provider redirect to destination reads as one continuous transition.
  if (!ready) return <SplashTransition label={inAuth ? t('auth.finishing') : undefined} />;
  return <>{children}</>;
}

export default function RootLayout() {
  const colors = useThemeColors();
  const queryClient = useMemo(() => createQueryClient(), []);
  useEffect(() => { void getCurrentUser().catch(() => {}); }, []);


  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
          <DocumentTitle />
          <OfflineBanner />
          <Gate>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
              <Stack.Screen name="(app)" />
              <Stack.Screen name="auth" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="legal" />
            </Stack>
          </Gate>
          <DialogHost />
          <StatusBar style="auto" />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
