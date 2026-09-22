import { Pressable, View } from 'react-native';
import { cn } from '@/shared/lib/cn';
import { Text } from './text';

export function ChoiceCard({ title, body, selected, onPress, tone }: { title: string; body?: string; selected: boolean; onPress: () => void; tone?: 'student' | 'teacher' }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={cn('rounded-lg border-2 bg-surface p-4', selected ? (tone === 'teacher' ? 'border-teacher' : 'border-primary') : 'border-border')}
    >
      <Text variant="h3">{title}</Text>
      {body ? <Text variant="small" tone="secondary" className="mt-1">{body}</Text> : null}
    </Pressable>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => onChange(!checked)} className="min-h-[44px] flex-row items-start gap-3 py-2">
      <View className={cn('mt-0.5 h-5 w-5 items-center justify-center rounded-xs border', checked ? 'border-primary bg-primary' : 'border-border-strong bg-surface')}>
        {checked ? <Text variant="caption" tone="onPrimary">✓</Text> : null}
      </View>
      <Text variant="small" className="flex-1">{label}</Text>
    </Pressable>
  );
}

export function SegmentedControl<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <View className="flex-row rounded-md bg-element p-1" accessibilityRole="tablist">
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: o.value === value }}
          onPress={() => onChange(o.value)}
          className={cn('min-h-[36px] flex-1 items-center justify-center rounded-sm', o.value === value && 'bg-surface')}
        >
          <Text variant="small-strong" tone={o.value === value ? 'default' : 'secondary'}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
