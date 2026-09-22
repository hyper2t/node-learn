import { Pressable, View } from 'react-native';
import { cn } from '@/shared/lib/cn';
import { Text } from './text';

export function ListRow({ title, subtitle, right, onPress, left, className }: {
  title: string; subtitle?: string; right?: React.ReactNode; left?: React.ReactNode; onPress?: () => void; className?: string;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      className={cn('min-h-[56px] flex-row items-center gap-3 px-4 py-3', onPress && 'active:bg-element', className)}
    >
      {left}
      <View className="flex-1 gap-0.5">
        <Text variant="body-strong" numberOfLines={1}>{title}</Text>
        {subtitle ? <Text variant="small" tone="secondary" numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right}
    </Pressable>
  );
}
export function Separator() {
  return <View className="ml-4 h-hairline bg-border" />;
}
