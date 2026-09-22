import { View } from 'react-native';
import { Image } from 'expo-image';
import { cn } from '@/shared/lib/cn';
import { avatarUrl } from '@/infrastructure/uploads/urls';
import { Text } from './text';

export function Avatar({ name, url, fileId, size = 40, className }: { name: string; url?: string | null; fileId?: string | null; size?: number; className?: string }) {
  const src = url ?? avatarUrl(fileId, Math.max(64, size * 2));
  const initials = name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join('') || '?';
  return (
    <View className={cn('items-center justify-center overflow-hidden rounded-full bg-element', className)} style={{ width: size, height: size }} accessibilityLabel={name}>
      {src ? <Image source={{ uri: src }} style={{ width: size, height: size }} contentFit="cover" /> : (
        <Text variant={size >= 48 ? 'h3' : 'small-strong'} tone="secondary">{initials}</Text>
      )}
    </View>
  );
}
