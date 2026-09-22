import { Link } from 'expo-router';
import { Screen } from '@/shared/layout/screen';
import { Text } from '@/shared/ui';
import { t } from '@/shared/i18n';

export default function NotFound() {
  return (
    <Screen>
      <Text variant="h1" className="mt-12">{t('errors.not_found')}</Text>
      <Link href="/" className="mt-4"><Text tone="primary">{t('tabs.home')}</Text></Link>
    </Screen>
  );
}
