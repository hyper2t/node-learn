import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { t } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Text } from '@/shared/ui';
import { SNIPPET_GROUPS, type MathSnippet, type SnippetGroup } from './math-snippets';

/**
 * LaTeX preset buttons for the question composer. Stateless about text: it only reports which
 * snippet was pressed; the form inserts it into whichever field was focused last.
 */
export function MathToolbar({ target, onInsert }: { target: 'title' | 'body'; onInsert: (s: MathSnippet) => void }) {
  const [group, setGroup] = useState<SnippetGroup['id']>('basic');
  const snippets = SNIPPET_GROUPS.find((g) => g.id === group)?.snippets ?? [];
  return (
    <View className="gap-2 rounded-md border border-border bg-element/60 p-2" accessibilityRole="toolbar" accessibilityLabel={t('qa.math.toolbar')}>
      <View className="flex-row items-center justify-between gap-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1">
          {SNIPPET_GROUPS.map((g) => (
            <Pressable
              key={g.id}
              onPress={() => setGroup(g.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: g.id === group }}
              className={cn('rounded-full px-3 py-1', g.id === group ? 'bg-primary' : 'bg-surface')}
            >
              <Text variant="caption" tone={g.id === group ? 'onPrimary' : 'secondary'}>{t(`qa.math.groups.${g.id}`)}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>{t(target === 'title' ? 'qa.math.intoTitle' : 'qa.math.intoBody')}</Text>
      </View>
      <View className="flex-row flex-wrap gap-1">
        {snippets.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => onInsert(s)}
            accessibilityRole="button"
            accessibilityLabel={s.hint}
            // Keep focus in the text field on web so the caret position survives the click.
            {...({ onMouseDown: (e: { preventDefault: () => void }) => e.preventDefault(), title: s.hint } as object)}
            className="min-w-[44px] items-center justify-center rounded-sm border border-border bg-surface px-2 py-1.5 active:bg-element"
          >
            <Text variant="small" className="font-mono">{s.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
