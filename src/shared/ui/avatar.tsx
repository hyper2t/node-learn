import { View } from 'react-native';
import { Image } from 'expo-image';
import { cn } from '@/shared/lib/cn';
import { Text } from './text';

export function Avatar({ name, url, size = 40, className }: { name: string; url?: string | null; size?: number; className?: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join('') || '?';
  return (
    <View className={cn('items-center justify-center overflow-hidden rounded-full bg-element', className)} style={{ width: size, height: size }} accessibilityLabel={name}>
      {url ? <Image source={{ uri: url }} style={{ width: size, height: size }} contentFit="cover" /> : (
        <Text variant={size >= 48 ? 'h3' : 'small-strong'} tone="secondary">{initials}</Text>
      )}
    </View>
  );
}
