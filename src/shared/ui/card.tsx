import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';
import { cn } from '@/shared/lib/cn';

export function Card({ className, ...rest }: ViewProps & { className?: string }) {
  return <View className={cn('rounded-lg border border-border bg-surface p-4', className)} {...rest} />;
}
export function PressableCard({ className, ...rest }: PressableProps & { className?: string }) {
  return <Pressable accessibilityRole="button" className={cn('rounded-lg border border-border bg-surface p-4 active:bg-element', className)} {...rest} />;
}
