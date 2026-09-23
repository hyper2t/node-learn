import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { Logo } from '@/shared/ui/logo';
import { Text } from '@/shared/ui/text';

/**
 * Branded full-screen transition used while an OAuth return is exchanging its
 * session and the route guard decides where to land. A plain spinner made the
 * hand-off look like two separate loads; this keeps one stable surface on
 * screen from the provider redirect until the destination renders.
 */
export function SplashTransition({ label }: { label?: string }) {
  // useState (not useRef): the lint config forbids reading a ref during render,
  // and the driver value has to be interpolated inline in the style prop.
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 720, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 720, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View className="flex-1 items-center justify-center gap-5 bg-background p-6" accessibilityRole="progressbar">
      <Animated.View
        style={{
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.04] }) }],
        }}
      >
        <Logo size={48} />
      </Animated.View>
      {label ? <Text variant="small" tone="secondary">{label}</Text> : null}
    </View>
  );
}
