import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';
import { cn } from '@/shared/lib/cn';
import { useThemeColors } from '@/shared/hooks/use-theme-colors';
import { Text } from './text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'sm';
export type ButtonProps = Omit<PressableProps, 'children'> & {
  title: string; variant?: Variant; size?: Size; loading?: boolean; className?: string; full?: boolean;
};

const box: Record<Variant, string> = {
  primary: 'bg-primary active:bg-primary-pressed', secondary: 'bg-element border border-border active:bg-selected',
  ghost: 'bg-transparent active:bg-element', danger: 'bg-danger-subtle active:opacity-80',
};
const label: Record<Variant, 'onPrimary' | 'default' | 'primary' | 'danger'> = { primary: 'onPrimary', secondary: 'default', ghost: 'primary', danger: 'danger' };

export function Button({ title, variant = 'primary', size = 'md', loading, disabled, className, full, ...rest }: ButtonProps) {
  const colors = useThemeColors();
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      className={cn('flex-row items-center justify-center rounded-md', size === 'md' ? 'min-h-[44px] px-4' : 'min-h-[36px] px-3', box[variant], isDisabled && 'opacity-50', full && 'w-full', className)}
      {...rest}
    >
      {loading ? <ActivityIndicator size="small" color={variant === 'primary' ? colors.onPrimary : colors.primary} /> : (
        <Text variant={size === 'md' ? 'body-strong' : 'small-strong'} tone={label[variant]}>{title}</Text>
      )}
    </Pressable>
  );
}
