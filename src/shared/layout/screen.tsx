import { KeyboardAvoidingView, Platform, ScrollView, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from '@/shared/lib/cn';
import { useBreakpoint } from '@/shared/hooks/use-breakpoint';
import { useShell } from '@/shared/hooks/use-shell';
import { Text } from '@/shared/ui/text';

type Width = 'narrow' | 'default' | 'wide';
const WIDTH: Record<Width, string> = { narrow: 'max-w-[560px]', default: 'max-w-[840px]', wide: 'max-w-[1200px]' };

/**
 * Page container: safe area, centred max-width column, optional scroll +
 * keyboard avoidance. On the web sidebar shell padding is larger and the
 * column can be wider (`width="wide"` for dashboards / two-column pages).
 */
export function Screen({ children, scroll = true, className, padded = true, edges, width = 'default' }: {
  children: React.ReactNode; scroll?: boolean; className?: string; padded?: boolean; edges?: ('top' | 'bottom' | 'left' | 'right')[]; width?: Width;
}) {
  const bp = useBreakpoint();
  const shell = useShell();
  const inner = (
    <View className={cn('w-full flex-1 self-center', WIDTH[width], padded && (shell === 'sidebar' ? (bp === 'desktop' ? 'px-10' : 'px-6') : 'px-4'), className)}>{children}</View>
  );
  return (
    <SafeAreaView className="flex-1 bg-background" edges={edges ?? ['top', 'left', 'right']}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView className="flex-1" contentContainerClassName={cn('flex-grow', shell === 'sidebar' ? 'pb-16' : 'pb-8')} keyboardShouldPersistTaps="handled">{inner}</ScrollView>
        ) : inner}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function PageHeader({ title, body, right, className, ...rest }: ViewProps & { title: string; body?: string; right?: React.ReactNode; className?: string }) {
  const shell = useShell();
  return (
    <View className={cn('flex-row items-start justify-between gap-3 pb-4', shell === 'sidebar' ? 'pt-8 pb-6' : 'pt-4', className)} {...rest}>
      <View className="flex-1 gap-1">
        <Text variant={shell === 'sidebar' ? 'display' : 'h1'} accessibilityRole="header">{title}</Text>
        {body ? <Text variant="small" tone="secondary">{body}</Text> : null}
      </View>
      {right ? <View className="flex-row items-center gap-2 pt-1">{right}</View> : null}
    </View>
  );
}

export function Section({ title, children, right, className }: { title: string; children: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <View className={cn('gap-2 py-3', className)}>
      <View className="flex-row items-center justify-between">
        <Text variant="h3" accessibilityRole="header">{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

/**
 * Two columns on desktop (main + aside), stacked elsewhere.
 * `aside` is rendered first on narrow layouts when `asideFirst` is set.
 */
export function TwoColumn({ main, aside, asideFirst = false, asideWidth = 320 }: { main: React.ReactNode; aside: React.ReactNode; asideFirst?: boolean; asideWidth?: number }) {
  const bp = useBreakpoint();
  if (bp !== 'desktop') {
    return <View>{asideFirst ? aside : null}{main}{!asideFirst ? aside : null}</View>;
  }
  return (
    <View className="flex-row items-start gap-8">
      <View className="min-w-0 flex-1">{main}</View>
      <View style={{ width: asideWidth }}>{aside}</View>
    </View>
  );
}

/** Responsive card grid: 1 column on phones, 2 on tablet, 3 on desktop. */
export function Grid({ children, className }: { children: React.ReactNode; className?: string }) {
  const bp = useBreakpoint();
  const cols = bp === 'desktop' ? 3 : bp === 'tablet' ? 2 : 1;
  const items = Array.isArray(children) ? children.flat() : [children];
  if (cols === 1) return <View className={cn('gap-2', className)}>{items}</View>;
  return (
    <View className={cn('flex-row flex-wrap', className)} style={{ marginHorizontal: -6 }}>
      {items.map((ch, i) => (
        <View key={(ch as { key?: string | null })?.key ?? i} style={{ width: `${100 / cols}%`, paddingHorizontal: 6, paddingBottom: 12 }}>{ch}</View>
      ))}
    </View>
  );
}
