import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Platform, Pressable, ScrollView, View, useWindowDimensions,
  type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ViewStyle,
} from 'react-native';
import { Stack } from 'expo-router';
import type { LegalDoc } from '@/content/legal';
import { Screen, PageHeader } from '@/shared/layout/screen';
import { MarkdownView, parseMarkdown, type TocEntry } from '@/shared/markdown';
import { cn } from '@/shared/lib/cn';
import { t } from '@/shared/i18n';
import { Icon } from '@/shared/ui/icon';
import { Text } from './text';

const ASIDE_WIDTH = 200;
/** Window width at and above which the TOC becomes a permanent right-hand column (web and native). */
const ASIDE_MIN_WINDOW_WIDTH = 800;
const DRAWER_WIDTH = 280;
const SCROLL_MARGIN = 16;
/** `position: sticky` exists only on the web; RN's ViewStyle type does not know it. */
const STICKY_ASIDE = Platform.OS === 'web' ? ({ position: 'sticky', top: 24 } as unknown as ViewStyle) : undefined;

/**
 * Legal page: Markdown body + table of contents, on every platform.
 * - Wide layouts (web and native, window >= 800): sticky TOC column to the right of the article.
 * - Narrow layouts (phones): a floating button on the right edge opens a right-hand TOC drawer.
 * Both variants share the scroll-spy: the entry for the section in view is highlighted, and
 * selecting an entry scrolls the article. Web measures heading offsets against the live DOM;
 * native uses onLayout offsets. `#hash` deep links work on web.
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
  const [tocOpen, setTocOpen] = useState(false);
  const [slide] = useState(() => new Animated.Value(0));

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

  const useNativeDriver = Platform.OS !== 'web';
  const openToc = useCallback(() => {
    setTocOpen(true);
    Animated.timing(slide, { toValue: 1, duration: 200, useNativeDriver }).start();
  }, [slide, useNativeDriver]);
  const closeToc = useCallback(() => {
    Animated.timing(slide, { toValue: 0, duration: 160, useNativeDriver }).start(() => setTocOpen(false));
  }, [slide, useNativeDriver]);

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
  const showAside = hasToc && winWidth >= ASIDE_MIN_WINDOW_WIDTH;
  const selectFromToc = useCallback((id: string) => {
    scrollToId(id);
    if (!showAside) closeToc();
  }, [scrollToId, closeToc, showAside]);

  return (
    <Screen width="article" scroll={false}>
      <Stack.Screen options={{ title: doc.title }} />
      <View className="flex-1">
        <ScrollView
          ref={scrollRef}
          onScroll={hasToc ? onScroll : undefined}
          scrollEventThrottle={32}
          className="flex-1"
          contentContainerClassName="pb-16"
          keyboardShouldPersistTaps="handled"
        >
          <PageHeader title={doc.title} body={t('legal.lastUpdated', { date: doc.updated })} />
          {doc.intro ? <Text variant="body" tone="secondary" className="pb-6">{doc.intro}</Text> : null}
          <View onLayout={onRowLayout} className={cn('pb-10', showAside ? 'flex-row items-start gap-10' : 'gap-6')}>
            <View onLayout={onArticleLayout} className={cn('min-w-0', showAside && 'flex-1')} style={showAside ? { maxWidth: 680 } : undefined}>
              <MarkdownView blocks={blocks} onHeadingLayout={onHeadingLayout} />
            </View>
            {showAside ? (
              <View style={[{ width: ASIDE_WIDTH }, STICKY_ASIDE]}>
                <TableOfContents entries={toc} activeId={activeId} onSelect={selectFromToc} />
              </View>
            ) : null}
          </View>
        </ScrollView>

        {hasToc && !showAside ? (
          <View pointerEvents="box-none" className="absolute inset-0">
            {tocOpen ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                onPress={closeToc}
                className="absolute inset-0 bg-overlay"
              />
            ) : null}
            {tocOpen ? (
              <Animated.View
                accessibilityViewIsModal
                style={{
                  position: 'absolute', top: 0, bottom: 0, right: 0, width: DRAWER_WIDTH,
                  shadowColor: '#0B1220', shadowOpacity: 0.18, shadowRadius: 16, elevation: 8,
                  transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [DRAWER_WIDTH, 0] }) }],
                }}
              >
                {/* NativeWind classes live on a plain View: Animated.* skips the className transform. */}
                <View className="flex-1 border-l border-border bg-surface px-4 py-5">
                  <TableOfContents entries={toc} activeId={activeId} onSelect={selectFromToc} />
                </View>
              </Animated.View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('legal.onThisPage')}
                onPress={openToc}
                className="absolute right-3 top-24 h-11 w-11 items-center justify-center rounded-full border border-border bg-surface shadow-card"
              >
                <Icon name="menu" size={20} color="#5F6570" />
              </Pressable>
            )}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function TableOfContents({ entries, activeId, onSelect }: {
  entries: TocEntry[]; activeId: string | null; onSelect: (id: string) => void;
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
              className={cn('border-l-2 py-1.5 pr-2', active ? 'border-primary' : 'border-border', e.depth > 0 ? 'pl-6' : 'pl-3')}
            >
              <Text variant={active ? 'small-strong' : 'small'} tone={active ? 'primary' : 'secondary'} numberOfLines={2}>{e.text}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
