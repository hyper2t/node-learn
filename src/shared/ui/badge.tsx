import { View } from 'react-native';
import { cn } from '@/shared/lib/cn';
import { Text } from './text';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'student' | 'teacher';
const bg: Record<Tone, string> = {
  neutral: 'bg-element', primary: 'bg-primary-subtle', success: 'bg-success-subtle', warning: 'bg-warning-subtle', danger: 'bg-danger-subtle', student: 'bg-primary-subtle', teacher: 'bg-success-subtle',
};
const fg: Record<Tone, string> = {
  neutral: 'text-foreground-secondary', primary: 'text-primary', success: 'text-success', warning: 'text-warning', danger: 'text-danger', student: 'text-student', teacher: 'text-teacher',
};
export function Badge({ label, tone = 'neutral', className }: { label: string; tone?: Tone; className?: string }) {
  return (
    <View className={cn('self-start rounded-full px-2 py-0.5', bg[tone], className)}>
      <Text variant="caption" className={fg[tone]}>{label}</Text>
    </View>
  );
}
