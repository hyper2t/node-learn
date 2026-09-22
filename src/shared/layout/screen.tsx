import { KeyboardAvoidingView, Platform, ScrollView, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from '@/shared/lib/cn';
import { useBreakpoint } from '@/shared/hooks/use-breakpoint';
import { Text } from '@/shared/ui/text';

/** Page container: safe area, max content width on desktop, optional scroll + keyboard avoidance. */
export function Screen({ children, scroll = true, className, padded = true, edges }: {
  children: React.ReactNode; scroll?: boolean; className?: string; padded?: boolean; edges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
  const bp = useBreakpoint();
  const inner = (
    <View className={cn('w-full flex-1 self-center', bp === 'desktop' ? 'max-w-[960px]' : 'max-w-[720px]', padded && 'px-4', className)}>{children}</View>
  );
  return (
    <SafeAreaView className="flex-1 bg-background" edges={edges ?? ['top', 'left', 'right']}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView className="flex-1" contentContainerClassName="flex-grow pb-8" keyboardShouldPersistTaps="handled">{inner}</ScrollView>
        ) : inner}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function PageHeader({ title, body, right, className, ...rest }: ViewProps & { title: string; body?: string; right?: React.ReactNode; className?: string }) {
  return (
    <View className={cn('flex-row items-start justify-between gap-3 pb-4 pt-4', className)} {...rest}>
      <View className="flex-1 gap-1">
        <Text variant="h1" accessibilityRole="header">{title}</Text>
        {body ? <Text variant="small" tone="secondary">{body}</Text> : null}
      </View>
      {right}
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
