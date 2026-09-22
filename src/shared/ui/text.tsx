import { Text as RNText, type TextProps } from 'react-native';
import { cn } from '@/shared/lib/cn';

type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'body-strong' | 'small' | 'small-strong' | 'caption';
type Tone = 'default' | 'secondary' | 'tertiary' | 'primary' | 'danger' | 'success' | 'onPrimary';

const variantClass: Record<Variant, string> = {
  display: 'text-display', h1: 'text-h1', h2: 'text-h2', h3: 'text-h3', body: 'text-body', 'body-strong': 'text-body-strong',
  small: 'text-small', 'small-strong': 'text-small-strong', caption: 'text-caption',
};
const toneClass: Record<Tone, string> = {
  default: 'text-foreground', secondary: 'text-foreground-secondary', tertiary: 'text-foreground-tertiary', primary: 'text-primary',
  danger: 'text-danger', success: 'text-success', onPrimary: 'text-on-primary',
};

export type AppTextProps = TextProps & { variant?: Variant; tone?: Tone; className?: string };
export function Text({ variant = 'body', tone = 'default', className, ...rest }: AppTextProps) {
  return <RNText className={cn('font-sans', variantClass[variant], toneClass[tone], className)} {...rest} />;
}
