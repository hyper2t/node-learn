import { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';
import { cn } from '@/shared/lib/cn';

/** Pulsing placeholder block. Compose several to mirror the real layout so content does not jump. */
export function Skeleton({ className, style }: { className?: string; style?: object }) {
  const [opacity] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ opacity }, style]} className={cn('h-4 rounded-md bg-element', className)} />;
}

export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <View className="gap-3 rounded-lg border border-border bg-surface p-4" accessibilityRole="progressbar" accessibilityLabel="Loading">
      <View className="flex-row items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <View className="flex-1 gap-2"><Skeleton className="w-2/3" /><Skeleton className="h-3 w-1/3" /></View>
      </View>
      {Array.from({ length: lines }).map((_, i) => <Skeleton key={i} className={i === lines - 1 ? 'w-1/2' : 'w-full'} />)}
    </View>
  );
}

export function SkeletonList({ count = 3, lines }: { count?: number; lines?: number }) {
  return <View className="gap-3">{Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} lines={lines} />)}</View>;
}
