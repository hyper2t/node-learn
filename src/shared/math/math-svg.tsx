import { memo, useMemo } from 'react';
import { ScrollView, Text as RNText, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useThemeColors } from '@/shared/hooks/use-theme-colors';
import { renderTex } from './tex';

/** MathJax's ex unit relative to the font size (its default ex/em ratio). */
const EX_PER_EM = 0.5;

export type MathSvgProps = { tex: string; display?: boolean; fontSize?: number };

/** Invalid TeX falls back to the raw source so the author can see and fix it. */
function Fallback({ tex, display, error }: { tex: string; display: boolean; error: string }) {
  return (
    <RNText accessibilityHint={error} className="font-mono text-danger">
      {display ? `$$${tex}$$` : `$${tex}$`}
    </RNText>
  );
}

/** Native: SVG through react-native-svg. Inline formulas sit in the text run; display ones scroll horizontally when wide. */
export const MathSvg = memo(function MathSvg({ tex, display = false, fontSize = 16 }: MathSvgProps) {
  const colors = useThemeColors();
  const r = useMemo(() => renderTex(tex, display), [tex, display]);
  if (!r.ok) return <Fallback tex={tex} display={display} error={r.error} />;
  const ex = fontSize * EX_PER_EM;
  const svg = (
    <SvgXml
      xml={r.svg}
      width={r.widthEx * ex}
      height={r.heightEx * ex}
      color={colors.foreground}
      accessibilityLabel={tex}
      accessibilityRole="image"
      // Inline views sit on the baseline; MathJax's vertical-align is the depth below it.
      style={display ? undefined : { transform: [{ translateY: -r.verticalAlignEx * ex }] }}
    />
  );
  if (!display) return svg;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="min-w-full justify-center py-1">
      <View>{svg}</View>
    </ScrollView>
  );
});
