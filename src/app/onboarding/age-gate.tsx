import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAgeGate, useSignOut } from '@/features/identity/api';
import { Screen, PageHeader } from '@/shared/layout/screen';
import { Button, Checkbox, ChoiceCard, InlineError, Text } from '@/shared/ui';
import { t } from '@/shared/i18n';
import type { AgeBand } from '@/types/api';

const BANDS: { value: AgeBand; label: string }[] = [
  { value: 'under_16', label: t('gate.under16') }, { value: '16_17', label: t('gate.b16_17') }, { value: '18_plus', label: t('gate.b18') },
];

export default function AgeGateScreen() {
  const [band, setBand] = useState<AgeBand | null>(null);
  const [privacy, setPrivacy] = useState(false);
  const gate = useAgeGate();
  const signOut = useSignOut();
  const router = useRouter();
  const tooYoung = band === 'under_16';
  return (
    <Screen>
      <View className="mx-auto w-full max-w-[520px] gap-4 py-6">
        <PageHeader title={t('gate.ageTitle')} body={t('gate.ageBody')} />
        <View className="gap-2" accessibilityRole="radiogroup">
          {BANDS.map((b) => <ChoiceCard key={b.value} title={b.label} selected={band === b.value} onPress={() => setBand(b.value)} />)}
        </View>
        {tooYoung ? <Text tone="danger">{t('gate.tooYoung')}</Text> : null}
        <Checkbox checked={privacy} onChange={setPrivacy} label={t('gate.privacy')} />
        <View className="flex-row gap-4">
          <Button size="sm" variant="ghost" title={t('gate.privacyLink')} onPress={() => router.push('/legal/privacy')} />
          <Button size="sm" variant="ghost" title={t('gate.termsLink')} onPress={() => router.push('/legal/terms')} />
        </View>
        <InlineError error={gate.error} />
        {tooYoung ? (
          <Button variant="secondary" title={t('common.signOut')} loading={signOut.isPending} onPress={() => signOut.mutate()} />
        ) : (
          <Button title={t('common.continue')} disabled={!band || !privacy} loading={gate.isPending} onPress={() => band && gate.mutate({ ageBand: band, acceptPrivacy: true })} />
        )}
      </View>
    </Screen>
  );
}
