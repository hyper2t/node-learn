import { View } from 'react-native';
import { Stack } from 'expo-router';
import type { LegalDoc } from '@/content/legal';
import { Screen, PageHeader } from '@/shared/layout/screen';
import { Text } from './text';

export function LegalDocView({ doc }: { doc: LegalDoc }) {
  return (
    <Screen width="narrow">
      <Stack.Screen options={{ title: doc.title }} />
      <PageHeader title={doc.title} body={`Last updated ${doc.updated}`} />
      <Text variant="body" tone="secondary" className="pb-4">{doc.intro}</Text>
      <View className="gap-6 pb-10">
        {doc.sections.map((s) => (
          <View key={s.heading} className="gap-2" accessibilityRole="summary">
            <Text variant="h3">{s.heading}</Text>
            {s.body.map((p, i) => <Text key={i} variant="body">{p}</Text>)}
          </View>
        ))}
      </View>
    </Screen>
  );
}
