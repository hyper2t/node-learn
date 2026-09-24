import { memo, type ReactNode } from 'react';
import { Linking, Platform, Text as RNText, View, type LayoutChangeEvent, type TextProps } from 'react-native';
import { Link, type Href } from 'expo-router';
import { cn } from '@/shared/lib/cn';
import { MathSvg } from '@/shared/math';
import { Text } from '@/shared/ui/text';
import type { Block, HeadingBlock, Inline } from './parse';

/** Called for every top-level heading with its `y` offset inside the MarkdownView container. */
export type HeadingLayoutHandler = (id: string, y: number) => void;

type ListBlock = Extract<Block, { type: 'list' }>;

/* ---------- inline ---------- */

function Inlines({ nodes }: { nodes: Inline[] }) {
  return <>{nodes.map((n, i) => <InlineNode key={i} node={n} />)}</>;
}

function InlineNode({ node }: { node: Inline }) {
  switch (node.type) {
    case 'text':
      return <>{node.text}</>;
    case 'br':
      return <>{'\n'}</>;
    case 'strong':
      return <RNText className="font-semibold"><Inlines nodes={node.children} /></RNText>;
    case 'em':
      return <RNText className="italic"><Inlines nodes={node.children} /></RNText>;
    case 'code':
      return <RNText className="rounded-xs bg-element px-1 font-mono">{node.text}</RNText>;
    case 'link':
      return <MdLink href={node.href}><Inlines nodes={node.children} /></MdLink>;
    case 'math':
      // `$$…$$` mid-paragraph stays in the text run but keeps display-style limits/fractions.
      return <MathSvg tex={node.display ? `\\displaystyle ${node.tex}` : node.tex} />;
  }
}

const LINK_CLASS = 'text-primary underline';

function MdLink({ href, children }: { href: string; children: ReactNode }) {
  // In-app route → expo-router Link (client-side navigation, real <a href> on web).
  if (href.startsWith('/')) {
    return (
      <Link href={href as Href} asChild>
        <RNText className={LINK_CLASS}>{children}</RNText>
      </Link>
    );
  }
  if (Platform.OS === 'web') {
    // RN-web renders Text with `href` as an anchor; `hrefAttrs` is web-only and not in the RN types.
    const anchor = {
      href,
      hrefAttrs: /^https?:/i.test(href) ? { target: '_blank', rel: 'noopener noreferrer' } : undefined,
    } as unknown as TextProps;
    return <RNText accessibilityRole="link" className={LINK_CLASS} {...anchor}>{children}</RNText>;
  }
  return (
    <RNText accessibilityRole="link" className={LINK_CLASS} onPress={() => { Linking.openURL(href).catch(() => undefined); }}>
      {children}
    </RNText>
  );
}

/* ---------- blocks ---------- */

function Heading({ block, first, onLayout }: { block: HeadingBlock; first: boolean; onLayout?: HeadingLayoutHandler }) {
  const variant = block.level <= 1 ? 'h1' : block.level === 2 ? 'h2' : 'h3';
  // RN-web picks the <hN> tag from aria-level (defaults to h1); the prop is not in the RN types.
  const level: { 'aria-level'?: number } | undefined = Platform.OS === 'web' ? { 'aria-level': block.level } : undefined;
  return (
    <View
      nativeID={block.id}
      onLayout={onLayout ? (e: LayoutChangeEvent) => onLayout(block.id, e.nativeEvent.layout.y) : undefined}
      className={cn(!first && (block.level <= 2 ? 'mt-4' : 'mt-2'))}
    >
      <Text variant={variant} accessibilityRole="header" {...level}>
        <Inlines nodes={block.children} />
      </Text>
    </View>
  );
}

function List({ block, depth }: { block: ListBlock; depth: number }) {
  return (
    <View className="gap-1.5" role="list">
      {block.items.map((item, i) => (
        <View key={i} className="flex-row gap-2" role="listitem">
          <Text variant="body" tone="secondary" aria-hidden style={{ minWidth: block.ordered ? 24 : 14 }} className={cn(block.ordered && 'text-right')}>
            {block.ordered ? `${block.start + i}.` : depth % 2 === 0 ? '\u2022' : '\u25E6'}
          </Text>
          <View className="min-w-0 flex-1 gap-1.5">
            {item.map((b, j) => <BlockNode key={j} block={b} depth={depth + 1} />)}
          </View>
        </View>
      ))}
    </View>
  );
}

function BlockNode({ block, depth }: { block: Block; depth: number }) {
  switch (block.type) {
    case 'heading':
      return <Heading block={block} first={false} />;
    case 'paragraph':
      return <Text variant="body"><Inlines nodes={block.children} /></Text>;
    case 'list':
      return <List block={block} depth={depth} />;
    case 'blockquote':
      return (
        <View className="gap-2 border-l-2 border-border-strong pl-4">
          {block.children.map((b, i) => <BlockNode key={i} block={b} depth={depth + 1} />)}
        </View>
      );
    case 'code':
      return (
        <View className="rounded-md bg-element px-3 py-2">
          <Text variant="small" className="font-mono" selectable>{block.text}</Text>
        </View>
      );
    case 'math':
      return <MathSvg tex={block.tex} display fontSize={17} />;
    case 'hr':
      return <View className="my-2 border-t border-border" role="separator" />;
  }
}

/**
 * Renders the tree produced by `parseMarkdown` with the app's Text/View primitives.
 * Top-level headings get `nativeID` (DOM id on web) and report their offset through
 * `onHeadingLayout`, which lets a container drive a table of contents / scroll-spy.
 */
export const MarkdownView = memo(function MarkdownView({ blocks, onHeadingLayout, className }: {
  blocks: Block[]; onHeadingLayout?: HeadingLayoutHandler; className?: string;
}) {
  return (
    <View className={cn('gap-3', className)}>
      {blocks.map((b, i) =>
        b.type === 'heading'
          ? <Heading key={b.id} block={b} first={i === 0} onLayout={onHeadingLayout} />
          : <BlockNode key={i} block={b} depth={0} />,
      )}
    </View>
  );
});
