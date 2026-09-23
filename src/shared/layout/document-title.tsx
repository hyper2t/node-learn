import Head from 'expo-router/head';
import { Platform } from 'react-native';
import { usePathname } from 'expo-router';
import { t } from '@/shared/i18n';

/**
 * Browser tab title for the web console. Native navigation headers come from
 * Stack.Screen options; those do not reach document.title on web, so this maps
 * the current pathname to a page name and renders "<Page> · Node Learn".
 *
 * Mounted once in the root layout, so a new screen only needs an entry here
 * when it should show something other than the app name.
 */
const APP = t('app.name');

/** Longest-prefix match, so /relations/123/evidence resolves before /relations. */
const ROUTES: { prefix: string; title: () => string }[] = [
  { prefix: '/learning', title: () => t('tabs.learning') },
  { prefix: '/messages', title: () => t('tabs.messages') },
  { prefix: '/profile', title: () => t('tabs.profile') },
  { prefix: '/relations', title: () => t('tabs.learning') },
  { prefix: '/teachers', title: () => t('teachers.title') },
  { prefix: '/requests', title: () => t('requests.title') },
  { prefix: '/connections', title: () => t('contacts.title') },
  { prefix: '/notifications', title: () => t('notifications.title') },
  { prefix: '/settings', title: () => t('profile.settings') },
  { prefix: '/admin', title: () => t('admin.title') },
  { prefix: '/auth/oauth-return', title: () => t('auth.finishing') },
  { prefix: '/auth/register', title: () => t('auth.signUp') },
  { prefix: '/auth/recover', title: () => t('auth.recoverTitle') },
  { prefix: '/auth/reset', title: () => t('auth.recoverTitle') },
  { prefix: '/auth/verify', title: () => t('auth.verifyTitle') },
  { prefix: '/auth', title: () => t('auth.signIn') },
  { prefix: '/onboarding', title: () => t('gate.ageTitle') },
  { prefix: '/legal/privacy', title: () => t('gate.privacyLink') },
  { prefix: '/legal/terms', title: () => t('gate.termsLink') },
];

export function pageTitle(pathname: string): string {
  const hit = ROUTES.filter((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];
  return hit ? `${hit.title()} \u00b7 ${APP}` : APP;
}

export function DocumentTitle() {
  const pathname = usePathname();
  if (Platform.OS !== 'web') return null;
  return (
    <Head>
      <title>{pageTitle(pathname)}</title>
    </Head>
  );
}
