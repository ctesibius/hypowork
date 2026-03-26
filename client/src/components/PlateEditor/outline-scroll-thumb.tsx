import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useScrollRef } from 'platejs/react';

import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type HeadingInfo = {
  id: string;
  text: string;
  level: number;
  top: number;
  normalizedY: number;
};

export type ScrollThumbProps = {
  containerRef?: React.RefObject<HTMLElement | null>;
  /** Ref to the editor card (or any anchor); when position='sticky' we fix to viewport and align to anchor's right edge */
  anchorRef?: React.RefObject<HTMLElement | null>;
  /** 'fixed' = viewport (default). 'absolute' = inside a relative parent (e.g. editor card). 'sticky' = fixed to viewport, aligned to anchorRef right edge */
  position?: 'fixed' | 'absolute' | 'sticky';
};

const VISIBLE_COUNT = 10;
const MARK_SPACING = 10;
/** Max track height; actual height shrinks when fewer headings are visible. */
const TRACK_VIEW_HEIGHT_MAX = 120;
const MIN_TRACK_HEIGHT = 14;
/** Max visual height for the active mark (dock-style); inactive marks stay at MARK_INACTIVE_HEIGHT. */
const MARK_MAX_HEIGHT = 6;
const MARK_INACTIVE_HEIGHT = 1;
/** Slight overshoot easing (macOS dock–like). */
const DOCK_EASE = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
const DOCK_DURATION_MS = 260;
/** Vertical padding inside track (matches legacy centering: trackHeight - span - 4). */
const TRACK_Y_PADDING = 4;
/** Edge fades need room; omit on very short tracks. */
const MIN_TRACK_HEIGHT_FOR_FADES = 32;
/** Same width for track + chevrons; wide enough for right-inset marks (see MARK_INSET_RIGHT). */
const TRACK_WIDTH = 18;
/** Space between track’s right edge and marks (px). */
const MARK_INSET_RIGHT = 3;

/** Right-rail heading marks: uses Plate scroll container by default so marks align with the scrolling editor. */
export function OutlineScrollThumb({
  containerRef: containerRefProp,
  anchorRef,
  position = 'fixed',
}: ScrollThumbProps) {
  const plateScrollRef = useScrollRef();
  const containerRef = containerRefProp ?? plateScrollRef;

  const [headings, setHeadings] = useState<HeadingInfo[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isTrackHovered, setIsTrackHovered] = useState(false);
  const [thumbOffset, setThumbOffset] = useState(0);
  const [fixedRight, setFixedRight] = useState<number>(12);
  const trackRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const thumbOffsetRef = useRef(0);
  const isDragging = useRef(false);
  const hoverLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tocPopoverOpen, setTocPopoverOpen] = useState(false);
  const tocOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tocCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeHeadingRowRef = useRef<HTMLButtonElement | null>(null);

  const maxOffset =
    headings.length > 0 ? Math.max(0, headings.length - VISIBLE_COUNT) : 0;

  const updateThumbOffset = useCallback(
    (val: number | ((prev: number) => number)) => {
      setThumbOffset((prev) => {
        const next = typeof val === 'function' ? val(prev) : val;
        thumbOffsetRef.current = next;
        return next;
      });
    },
    []
  );

  const gatherHeadings = useCallback(() => {
    const container = containerRef?.current;
    if (!container) return;

    const els = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const scrollHeight = container.scrollHeight;
    const containerRect = container.getBoundingClientRect();
    const collected: HeadingInfo[] = [];

    els.forEach((el, i) => {
      const htmlEl = el as HTMLElement;
      const id = htmlEl.id || `heading-${i}`;
      if (!htmlEl.id) htmlEl.id = id;
      const elRect = htmlEl.getBoundingClientRect();
      const top = elRect.top - containerRect.top + container.scrollTop;
      collected.push({
        id,
        text: htmlEl.textContent || '',
        level: Number.parseInt(el.tagName[1], 10),
        top,
        normalizedY: top / scrollHeight,
      });
    });

    setHeadings(collected);
  }, [containerRef]);

  // Set up scroll listener - ALWAYS (not dependent on headings.length)
  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    // Initial gather
    gatherHeadings();

    const onScroll = () => {
      const container = containerRef?.current;
      if (!container) return;

      const scrollTop = container.scrollTop + 100;

      // Get current headings from state (outside the setHeadings call)
      setHeadings((currentHeadings) => {
        if (currentHeadings.length === 0) {
          return [...currentHeadings]; // Force re-render
        }

        let current = '';
        let currentIdx = 0;
        for (let i = 0; i < currentHeadings.length; i++) {
          if (currentHeadings[i].top <= scrollTop) {
            current = currentHeadings[i].id;
            currentIdx = i;
          }
        }
        // Update activeId directly
        setActiveId(current);

        const offset = thumbOffsetRef.current;
        const centerOffset = Math.floor(VISIBLE_COUNT / 2);
        const idealOffset = currentIdx - centerOffset;
        const currMaxOffset = Math.max(
          0,
          currentHeadings.length - VISIBLE_COUNT
        );
        const clampedOffset = Math.max(0, Math.min(currMaxOffset, idealOffset));
        if (clampedOffset !== offset) {
          updateThumbOffset(clampedOffset);
        }

        return currentHeadings;
      });
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    // Also listen to window scroll as fallback for non-scrollable containers
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
    };
  }, [containerRef, gatherHeadings, updateThumbOffset]);

  // ResizeObserver: fires when the scroll container's own box changes (e.g. layout).
  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;
    const observer = new ResizeObserver(gatherHeadings);
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef, gatherHeadings]);

  // DOM edits inside a fixed-height overflow-y-auto area grow scrollHeight but often do NOT
  // resize the container's border box, so ResizeObserver misses them — refresh heading marks then.
  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    let raf = 0;
    const scheduleGather = () => {
      if (raf !== 0) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        gatherHeadings();
      });
    };

    const mo = new MutationObserver(scheduleGather);
    mo.observe(container, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      if (raf !== 0) cancelAnimationFrame(raf);
    };
  }, [containerRef, gatherHeadings]);

  useEffect(
    () => () => {
      if (hoverLeaveTimerRef.current) clearTimeout(hoverLeaveTimerRef.current);
      if (tocOpenTimerRef.current) clearTimeout(tocOpenTimerRef.current);
      if (tocCloseTimerRef.current) clearTimeout(tocCloseTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (!tocPopoverOpen || !activeId) return;
    const id = requestAnimationFrame(() => {
      activeHeadingRowRef.current?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    });
    return () => cancelAnimationFrame(id);
  }, [tocPopoverOpen, activeId]);

  useEffect(() => {
    if (position !== 'sticky' || !anchorRef?.current) return;
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setFixedRight(Math.max(12, window.innerWidth - rect.right));
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [position, anchorRef]);

  const scrollToHeading = useCallback(
    (id: string) => {
      const el = document.getElementById(id) as HTMLElement | null;
      const container = containerRef?.current;
      if (!el || !container) return;
      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const targetTop =
        elRect.top - containerRect.top + container.scrollTop - 20;
      container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    },
    [containerRef]
  );

  const handleTrackInteraction = useCallback(
    (clientY: number) => {
      if (!trackRef.current || headings.length === 0) return;
      const rect = trackRef.current.getBoundingClientRect();
      const contentHeight =
        (headings.slice(thumbOffset, thumbOffset + VISIBLE_COUNT).length - 1) *
        MARK_SPACING;
      const topOffset = Math.max(
        0,
        (rect.height - contentHeight - TRACK_Y_PADDING) / 2
      );
      const yInContent = clientY - rect.top - topOffset;
      const ratio = Math.max(
        0,
        Math.min(1, contentHeight > 0 ? yInContent / contentHeight : 0)
      );

      const visibleHeadings = headings.slice(
        thumbOffset,
        thumbOffset + VISIBLE_COUNT
      );
      const idx = Math.round(ratio * (visibleHeadings.length - 1));
      const target =
        visibleHeadings[Math.max(0, Math.min(idx, visibleHeadings.length - 1))];
      if (target) scrollToHeading(target.id);
    },
    [headings, thumbOffset, scrollToHeading]
  );

  const onMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    handleTrackInteraction(e.clientY);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging.current) handleTrackInteraction(e.clientY);
    };
    const onMouseUp = () => {
      isDragging.current = false;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [handleTrackInteraction]);

  const scrollThumbUp = () => updateThumbOffset((o) => Math.max(0, o - 1));
  const scrollThumbDown = () =>
    updateThumbOffset((o) => Math.min(maxOffset, o + 1));

  const visibleHeadings =
    headings.length > 0
      ? headings.slice(thumbOffset, thumbOffset + VISIBLE_COUNT)
      : [];
  const canScrollUp = thumbOffset > 0;
  const canScrollDown = thumbOffset < maxOffset;
  const spacing = MARK_SPACING;
  const nVisible = visibleHeadings.length;
  const actualTrackHeight = Math.max(0, nVisible - 1) * spacing;
  const markColumnHeight =
    nVisible <= 1 ? MARK_MAX_HEIGHT : actualTrackHeight + MARK_MAX_HEIGHT;
  const naturalTrackHeight =
    nVisible === 0
      ? MIN_TRACK_HEIGHT
      : Math.max(MIN_TRACK_HEIGHT, markColumnHeight + TRACK_Y_PADDING);
  const trackHeight = Math.min(TRACK_VIEW_HEIGHT_MAX, naturalTrackHeight);
  const trackTopOffset = Math.max(
    0,
    (trackHeight - actualTrackHeight - TRACK_Y_PADDING) / 2
  );
  const edgeFadeHeight =
    trackHeight >= MIN_TRACK_HEIGHT_FOR_FADES
      ? 16
      : Math.max(0, Math.floor((trackHeight - 4) / 2));

  const isSticky = position === 'sticky';

  const wrapperStyle: React.CSSProperties = {
    position: isSticky
      ? 'fixed'
      : position === 'absolute'
        ? 'absolute'
        : 'fixed',
    top: '50%',
    transform: 'translateY(-50%)',
    ...(isSticky
      ? { right: fixedRight }
      : position === 'absolute'
        ? {}
        : { right: 12 }),
    zIndex: 100,
    width: TRACK_WIDTH,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 4,
    transition: 'opacity 0.2s',
  };

  return (
    <Popover
      open={tocPopoverOpen}
      onOpenChange={setTocPopoverOpen}
      modal={false}
    >
      <PopoverAnchor asChild>
        <div
          ref={wrapperRef}
          data-outline-scroll-thumb
          style={wrapperStyle}
          onMouseEnter={() => {
            if (hoverLeaveTimerRef.current) {
              clearTimeout(hoverLeaveTimerRef.current);
              hoverLeaveTimerRef.current = null;
            }
            setIsTrackHovered(true);
            if (tocCloseTimerRef.current) {
              clearTimeout(tocCloseTimerRef.current);
              tocCloseTimerRef.current = null;
            }
            if (tocOpenTimerRef.current) clearTimeout(tocOpenTimerRef.current);
            tocOpenTimerRef.current = setTimeout(() => {
              tocOpenTimerRef.current = null;
              setTocPopoverOpen(true);
            }, 140);
          }}
          onMouseLeave={() => {
            hoverLeaveTimerRef.current = setTimeout(() => {
              setIsTrackHovered(false);
              setHoveredId(null);
              hoverLeaveTimerRef.current = null;
            }, 120);
            if (tocOpenTimerRef.current) {
              clearTimeout(tocOpenTimerRef.current);
              tocOpenTimerRef.current = null;
            }
            tocCloseTimerRef.current = setTimeout(() => {
              tocCloseTimerRef.current = null;
              setTocPopoverOpen(false);
            }, 280);
          }}
        >
      <button
        type="button"
        onClick={scrollThumbUp}
        disabled={!canScrollUp}
        className="flex h-5 w-full shrink-0 items-center justify-end rounded transition-opacity duration-200"
        style={{
          margin: 0,
          padding: 0,
          paddingRight: MARK_INSET_RIGHT,
          border: 'none',
          background: 'transparent',
          boxSizing: 'border-box',
          WebkitAppearance: 'none',
          appearance: 'none',
          opacity: canScrollUp ? (isTrackHovered ? 0.7 : 0.3) : 0.1,
          color: 'hsl(var(--thumb-mark-active, 0 0% 20%))',
          cursor: canScrollUp ? 'pointer' : 'default',
        }}
      >
        <ChevronUp size={12} strokeWidth={2.5} className="shrink-0" />
      </button>

      <div className="relative flex items-center">
        <div
          ref={trackRef}
          className="relative cursor-pointer select-none overflow-hidden"
          style={{ height: trackHeight, width: TRACK_WIDTH }}
          onMouseDown={onMouseDown}
          role="group"
          aria-label="Document outline track"
        >
          {canScrollUp && edgeFadeHeight > 0 ? (
            <div
              className="pointer-events-none absolute top-0 right-0 left-0 z-10"
              style={{
                height: edgeFadeHeight,
                background:
                  'linear-gradient(to bottom, hsl(var(--thumb-bg, 0 0% 98%)), transparent)',
              }}
            />
          ) : null}
          {canScrollDown && edgeFadeHeight > 0 ? (
            <div
              className="pointer-events-none absolute right-0 bottom-0 left-0 z-10"
              style={{
                height: edgeFadeHeight,
                background:
                  'linear-gradient(to top, hsl(var(--thumb-bg, 0 0% 98%)), transparent)',
              }}
            />
          ) : null}

          {visibleHeadings.map((h, i) => {
            const isActive = h.id === activeId;
            const isHovered = h.id === hoveredId;
            const y = trackTopOffset + i * spacing;

            const baseWidth =
              h.level === 1 ? 10 : h.level === 2 ? 8 : h.level === 3 ? 6 : 4;
            const width = isActive
              ? baseWidth + 10
              : isHovered
                ? baseWidth + 2
                : baseWidth;
            const height = isActive ? MARK_MAX_HEIGHT : MARK_INACTIVE_HEIGHT;

            return (
              <div
                key={h.id}
                className="absolute cursor-pointer rounded-full"
                style={{
                  backgroundColor: isActive
                    ? 'hsl(var(--thumb-mark-active, 0 0% 12%))'
                    : 'hsl(var(--thumb-mark, 0 0% 45%))',
                  right: MARK_INSET_RIGHT,
                  top: y,
                  width,
                  height,
                  transformOrigin: 'right center',
                  transform: isActive
                    ? 'scaleX(1.12) scaleY(1.08)'
                    : 'scaleX(1) scaleY(1)',
                  boxShadow: isActive
                    ? '0 1px 6px hsl(var(--thumb-mark-active, 0 0% 12%) / 0.35)'
                    : undefined,
                  transition: `width ${DOCK_DURATION_MS}ms ${DOCK_EASE}, height ${DOCK_DURATION_MS}ms ${DOCK_EASE}, transform ${DOCK_DURATION_MS}ms ${DOCK_EASE}, opacity 150ms ease, box-shadow ${DOCK_DURATION_MS}ms ${DOCK_EASE}`,
                  opacity: isActive
                    ? 1
                    : isHovered
                      ? 0.85
                      : isTrackHovered
                        ? 0.5
                        : 0.3,
                }}
                onMouseEnter={() => {
                  if (hoverLeaveTimerRef.current) {
                    clearTimeout(hoverLeaveTimerRef.current);
                    hoverLeaveTimerRef.current = null;
                  }
                  setHoveredId(h.id);
                }}
                onMouseLeave={() => {
                  hoverLeaveTimerRef.current = setTimeout(() => {
                    setHoveredId(null);
                    hoverLeaveTimerRef.current = null;
                  }, 80);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  scrollToHeading(h.id);
                }}
                role="button"
                tabIndex={0}
                aria-label={h.text}
              />
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={scrollThumbDown}
        disabled={!canScrollDown}
        className="flex h-5 w-full shrink-0 items-center justify-end rounded transition-opacity duration-200"
        style={{
          margin: 0,
          padding: 0,
          paddingRight: MARK_INSET_RIGHT,
          border: 'none',
          background: 'transparent',
          boxSizing: 'border-box',
          WebkitAppearance: 'none',
          appearance: 'none',
          opacity: canScrollDown ? (isTrackHovered ? 0.7 : 0.3) : 0.1,
          color: 'hsl(var(--thumb-mark-active, 0 0% 20%))',
          cursor: canScrollDown ? 'pointer' : 'default',
        }}
      >
        <ChevronDown size={12} strokeWidth={2.5} className="shrink-0" />
      </button>
        </div>
      </PopoverAnchor>

      <PopoverContent
        align="end"
        side="left"
        sideOffset={6}
        className="z-200 w-[min(100vw-2rem,16rem)] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerEnter={() => {
          if (tocCloseTimerRef.current) {
            clearTimeout(tocCloseTimerRef.current);
            tocCloseTimerRef.current = null;
          }
        }}
        onPointerLeave={() => {
          tocCloseTimerRef.current = setTimeout(() => {
            tocCloseTimerRef.current = null;
            setTocPopoverOpen(false);
          }, 200);
        }}
      >
        <div className="border-b px-3 py-2 text-[11px] font-medium text-muted-foreground">
          Outline
        </div>
        <ScrollArea className="max-h-[min(70vh,18rem)]">
          <div className="p-1 pr-2">
            {headings.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                No headings in this document.
              </p>
            ) : (
              headings.map((h) => {
                const isCurrent = h.id === activeId;
                return (
                  <button
                    key={h.id}
                    type="button"
                    ref={isCurrent ? activeHeadingRowRef : undefined}
                    className={cn(
                      'block w-full rounded-sm py-1.5 pr-2 text-left text-sm transition-colors',
                      isCurrent
                        ? 'bg-accent font-medium text-accent-foreground'
                        : 'text-foreground hover:bg-muted/80'
                    )}
                    style={{
                      paddingLeft: 8 + (h.level - 1) * 14,
                    }}
                    onClick={() => {
                      scrollToHeading(h.id);
                      setTocPopoverOpen(false);
                    }}
                  >
                    <span className="line-clamp-2">{h.text || '(empty)'}</span>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
