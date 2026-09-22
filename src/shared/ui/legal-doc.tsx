import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform, Pressable, ScrollView, View, useWindowDimensions,
  type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ViewStyle,
} from 'react-native';
import { Stack } from 'expo-router';
import type { LegalDoc } from '@/content/legal';
import { Screen, PageHeader } from '@/shared/layout/screen';
import { MarkdownView, parseMarkdown, type TocEntry } from '@/shared/markdown';
import { cn } from '@/shared/lib/cn';
import { t } from '@/shared/i18n';
import { Text } from './text';

const ASIDE_WIDTH = 200;
const ASIDE_WIDTH_COMPACT = 128;
/** Below this window width the right-hand TOC column gives way to a card above the article. */
const ASIDE_MIN_WINDOW_WIDTH = 340;
/** Compact (narrow) TOC column below this width; full 200px column at and above. */
const ASIDE_FULL_WINDOW_WIDTH = 800;
const SCROLL_MARGIN = 16;
/** `position: sticky` exists only on the web; RN's ViewStyle type does not know it. */
const STICKY_ASIDE = Platform.OS === 'web' ? ({ position: 'sticky', top: 24 } as unknown as ViewStyle) : undefined;

/**
 * Legal page: Markdown body with a table of contents on the RIGHT of the content, on every
 * platform and width:
 * - window >= 800 (desktop web, tablets): 200px sticky TOC column;
 * - 340 <= window < 800 (phones, web and native): compact 128px TOC column;
 * - < 340: TOC falls back to a card above the article.
 * The TOC highlights the section currently in view (scroll-spy) and tapping an entry scrolls
 * the article. Web measures heading offsets against the live DOM; native uses onLayout offsets.
 * `#hash` deep links work on web.
 */
export function LegalDocView({ doc }: { doc: LegalDoc }) {
  const { blocks, toc } = useMemo(() => parseMarkdown(doc.markdown), [doc.markdown]);
  const { width: winWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const pos = useRef({ row: null as number | null, article: null as number | null, headings: {} as Record<string, number> });
  const scrollY = useRef(0);
  const frame = useRef<number | null>(null);
  const hashHandled = useRef(false);
  const [activeId, setActiveId] = useState<string | null>(toc[0]?.id ?? null);

  /** Live top offset of a heading inside the scroll container (web measures the DOM directly). */
  const offsetOf = useCallback((id: string): number | null => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const node = (scrollRef.current as unknown as { getNativeScrollRef?: () => HTMLElement | null } | null)?.getNativeScrollRef?.() ?? null;
      const el = node ? document.getElementById(id) : null;
      if (node && el) return el.getBoundingClientRect().top - node.getBoundingClientRect().top + node.scrollTop;
    }
    const { row, article, headings } = pos.current;
    const y = headings[id];
    return row == null || article == null || y == null ? null : row + article + y;
  }, []);

  const updateActive = useCallback((y: number, viewport: number, content: number) => {
    if (toc.length === 0) return;
    let current = toc[0]!.id;
    if (content > 0 && viewport > 0 && y + viewport >= content - 2) {
      current = toc[toc.length - 1]!.id; // reached the end: the last section counts as read
    } else {
      for (const e of toc) {
        const top = offsetOf(e.id);
        if (top != null && top - SCROLL_MARGIN - 8 <= y) current = e.id;
      }
    }
    setActiveId((prev) => (prev === current ? prev : current));
  }, [toc, offsetOf]);

  const scrollToId = useCallback((id: string, animated = true): boolean => {
    // Measured against the live DOM at scroll time (web) so font loading / reflow can't skew it.
    const y = offsetOf(id);
    if (y == null) return false;
    const target = Math.max(0, y - SCROLL_MARGIN);
    scrollRef.current?.scrollTo({ y: target, animated });
    scrollY.current = target; // keep the scroll-spy in sync with programmatic scrolls
    setActiveId(id);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try { window.history.replaceState(null, '', `#${id}`); } catch { /* ignore */ }
    }
    return true;
  }, [offsetOf]);

  // Runs once per frame after a burst of onLayout callbacks (mount, resize, font load):
  // honours a web deep link (/legal/privacy#your-rights) once, then refreshes the active entry.
  const onLayoutSettled = useCallback(() => {
    if (!hashHandled.current && Platform.OS === 'web' && typeof window !== 'undefined') {
      let id = '';
      try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { id = ''; }
      if (!id) hashHandled.current = true;
      else if (scrollToId(id, false)) { hashHandled.current = true; return; }
    }
    updateActive(scrollY.current, 0, 0);
  }, [scrollToId, updateActive]);

  const bump = useCallback(() => {
    if (frame.current != null) return;
    frame.current = requestAnimationFrame(() => { frame.current = null; onLayoutSettled(); });
  }, [onLayoutSettled]);
  useEffect(() => () => { if (frame.current != null) cancelAnimationFrame(frame.current); }, []);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    scrollY.current = contentOffset.y;
    updateActive(contentOffset.y, layoutMeasurement.height, contentSize.height);
  }, [updateActive]);

  const onHeadingLayout = useCallback((id: string, y: number) => {
    if (pos.current.headings[id] === y) return;
    pos.current.headings[id] = y;
    bump();
  }, [bump]);
  const onRowLayout = useCallback((e: LayoutChangeEvent) => {
    const { y } = e.nativeEvent.layout;
    if (pos.current.row !== y) { pos.current.row = y; bump(); }
  }, [bump]);
  const onArticleLayout = useCallback((e: LayoutChangeEvent) => {
    const { y } = e.nativeEvent.layout;
    if (pos.current.article !== y) { pos.current.article = y; bump(); }
  }, [bump]);

  const hasToc = toc.length > 0;
  const wide = winWidth >= ASIDE_FULL_WINDOW_WIDTH;
  const showRight = hasToc && winWidth >= ASIDE_MIN_WINDOW_WIDTH;

  return (
    <Screen width="article" scrollRef={scrollRef} onScroll={hasToc ? onScroll : undefined} scrollEventThrottle={32}>
      <Stack.Screen options={{ title: doc.title }} />
      <PageHeader title={doc.title} body={t('legal.lastUpdated', { date: doc.updated })} />
      {doc.intro ? <Text variant="body" tone="secondary" className="pb-6">{doc.intro}</Text> : null}
      <View onLayout={onRowLayout} className={cn('pb-10', showRight ? 'flex-row items-start' : 'gap-6', showRight && (wide ? 'gap-10' : 'gap-4'))}>
        {hasToc && !showRight ? (
          <View className="pb-6 rounded-md border border-border bg-surface px-4 py-3">
            <TableOfContents entries={toc} activeId={activeId} onSelect={scrollToId} compact />
          </View>
        ) : null}
        <View onLayout={onArticleLayout} className={cn('min-w-0', showRight && 'flex-1')} style={wide ? { maxWidth: 680 } : undefined}>
          <MarkdownView blocks={blocks} onHeadingLayout={onHeadingLayout} />
        </View>
        {showRight ? (
          <View style={[{ width: wide ? ASIDE_WIDTH : ASIDE_WIDTH_COMPACT }, STICKY_ASIDE]}>
            <TableOfContents entries={toc} activeId={activeId} onSelect={scrollToId} compact={!wide} />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function TableOfContents({ entries, activeId, onSelect, compact = false }: {
  entries: TocEntry[]; activeId: string | null; onSelect: (id: string) => void; compact?: boolean;
}) {
  return (
    <View role="navigation" aria-label={t('legal.onThisPage')}>
      <Text variant="caption" tone="tertiary" className="pb-2 uppercase tracking-wide">{t('legal.onThisPage')}</Text>
      <View>
        {entries.map((e) => {
          const active = e.id === activeId;
          return (
            <Pressable
              key={e.id}
              accessibilityRole="link"
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(e.id)}
              className={cn('border-l-2 pr-1', compact ? 'py-1' : 'py-1.5 pr-2', active ? 'border-primary' : 'border-border', e.depth > 0 ? 'pl-4' : 'pl-3')}
            >
              <Text
                variant={compact ? 'caption' : active ? 'small-strong' : 'small'}
                tone={active ? 'primary' : 'secondary'}
                numberOfLines={compact ? 3 : 2}
              >
                {e.text}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
