import { forwardRef, useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { cn } from '@/shared/lib/cn';
import { useThemeColors } from '@/shared/hooks/use-theme-colors';
import { Text } from './text';

export type InputProps = TextInputProps & { label?: string; hint?: string; error?: string; className?: string; containerClassName?: string };

export const Input = forwardRef<TextInput, InputProps>(function Input({ label, hint, error, className, containerClassName, multiline, onFocus, onBlur, ...rest }, ref) {
  const [focused, setFocused] = useState(false);
  const colors = useThemeColors();
  return (
    <View className={cn('gap-1.5', containerClassName)}>
      {label ? <Text variant="small-strong">{label}</Text> : null}
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.foregroundTertiary}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        className={cn(
          'rounded-md border bg-surface px-3 text-body text-foreground', multiline ? 'min-h-[96px] py-2' : 'min-h-[44px]',
          error ? 'border-danger' : focused ? 'border-primary' : 'border-border', className,
        )}
        {...rest}
      />
      {error ? <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">{error}</Text> : hint ? <Text variant="caption" tone="tertiary">{hint}</Text> : null}
    </View>
  );
});
