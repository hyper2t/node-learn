import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { cn } from '@/shared/lib/cn';
import { t } from '@/shared/i18n';
import { addTag, hasTag, normalizeTag, removeTag, MAX_TAGS } from '@/shared/lib/tags';
import { Button } from './button';
import { Icon } from './icon';
import { Input } from './input';
import { Text } from './text';

/**
 * Multi-select tag field: pick any number of suggested tags and/or type custom ones
 * (Enter/comma or the Add button commits the draft). Selected tags render as removable
 * chips. Used for student Topics in onboarding and settings.
 */
export function TagPicker({ label, value, onChange, suggestions = [], max = MAX_TAGS, placeholder, hint }: {
  label?: string;
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: readonly string[];
  max?: number;
  placeholder?: string;
  hint?: string;
}) {
  const [draft, setDraft] = useState('');
  const full = value.length >= max;
  const available = suggestions.filter((s) => !hasTag(value, s));
  const commitDraft = () => {
    const next = addTag(value, draft, max);
    if (next !== value) {
      onChange(next);
      setDraft('');
    }
  };
  return (
    <View className="gap-1.5">
      {label ? <Text variant="small-strong">{label}</Text> : null}
      {value.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {value.map((tag) => (
            <Pressable
              key={tag}
              accessibilityRole="button"
              accessibilityLabel={t('tags.remove', { tag })}
              onPress={() => onChange(removeTag(value, tag))}
              className="min-h-[32px] flex-row items-center gap-1.5 rounded-full border border-primary bg-primary-subtle px-3"
            >
              <Text variant="small" tone="primary">{tag}</Text>
              <Icon name="close" size={12} color="#2F6FED" />
            </Pressable>
          ))}
        </View>
      ) : null}
      {available.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {available.map((s) => (
            <Pressable
              key={s}
              accessibilityRole="button"
              disabled={full}
              onPress={() => onChange(addTag(value, s, max))}
              className={cn('min-h-[32px] items-center justify-center rounded-full border border-border bg-surface px-3', full && 'opacity-40')}
            >
              <Text variant="small" tone="secondary">{s}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View className="flex-row items-center gap-2">
        <View className="min-w-0 flex-1">
          <Input
            value={draft}
            onChangeText={(v) => {
              if (v.endsWith(',')) {
                const next = addTag(value, v.slice(0, -1), max);
                if (next !== value) onChange(next);
                setDraft('');
              } else {
                setDraft(v);
              }
            }}
            onSubmitEditing={commitDraft}
            placeholder={placeholder ?? t('tags.placeholder')}
            autoCapitalize="none"
            returnKeyType="done"
          />
        </View>
        <Button size="sm" variant="secondary" title={t('tags.add')} disabled={full || normalizeTag(draft).length === 0} onPress={commitDraft} />
      </View>
      <Text variant="caption" tone="tertiary">{hint ?? t('tags.max', { max })}</Text>
    </View>
  );
}
