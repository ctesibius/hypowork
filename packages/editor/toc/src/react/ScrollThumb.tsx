import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

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
const TRACK_VIEW_HEIGHT = 120;

export function ScrollThumb({
  containerRef: containerRefProp,
  anchorRef,
  position = 'fixed',
}: ScrollThumbProps) {
  const containerRef = containerRefProp;

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

    const els = container.querySelectorAll('h1, h2, h3');
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

  // ResizeObserver for content changes
  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;
    const observer = new ResizeObserver(gatherHeadings);
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef, gatherHeadings]);

  useEffect(
    () => () => {
      if (hoverLeaveTimerRef.current) clearTimeout(hoverLeaveTimerRef.current);
    },
    []
  );

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
      const topOffset = Math.max(0, (rect.height - contentHeight - 4) / 2);
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

  // Don't return null early - always render, just show empty state if no headings
  // if (headings.length === 0) {
  //   console.log('[Library ScrollThumb] Returning null - no headings, headings:', headings.length);
  //   return null;
  // }

  const visibleHeadings =
    headings.length > 0
      ? headings.slice(thumbOffset, thumbOffset + VISIBLE_COUNT)
      : [];
  const canScrollUp = thumbOffset > 0;
  const canScrollDown = thumbOffset < maxOffset;
  const spacing = MARK_SPACING;
  const actualTrackHeight = (visibleHeadings.length - 1) * spacing;
  const trackHeight = TRACK_VIEW_HEIGHT;
  const trackTopOffset = Math.max(0, (trackHeight - actualTrackHeight - 4) / 2);

  const isSticky = position === 'sticky';
  const isLibrary = true;
  const verticalOffset = isLibrary ? 0 : 0;

  // Use inline styles instead of Tailwind classes to ensure they work
  const wrapperStyle: React.CSSProperties = {
    position: isSticky
      ? 'fixed'
      : position === 'absolute'
        ? 'absolute'
        : 'fixed',
    top: '50%',
    transform: `translateY(calc(-50% - ${verticalOffset}px))`,
    ...(isSticky
      ? { right: fixedRight }
      : position === 'absolute'
        ? {}
        : { right: 12 }),
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    boxShadow:
      '0 0 24px rgba(59, 130, 246, 0.8), 0 0 48px rgba(59, 130, 246, 0.4)',
    transition: 'opacity 0.2s',
  };

  return (
    <div
      ref={wrapperRef}
      data-library-thumb
      style={wrapperStyle}
      onMouseEnter={() => {
        if (hoverLeaveTimerRef.current) {
          clearTimeout(hoverLeaveTimerRef.current);
          hoverLeaveTimerRef.current = null;
        }
        setIsTrackHovered(true);
      }}
      onMouseLeave={() => {
        hoverLeaveTimerRef.current = setTimeout(() => {
          setIsTrackHovered(false);
          setHoveredId(null);
          hoverLeaveTimerRef.current = null;
        }, 120);
      }}
    >
      <span
        className="rounded bg-blue-500/90 px-1 py-0.5 font-bold text-[9px] text-white"
        title="Library thumb (fixed)"
      >
        LIB
      </span>
      <button
        type="button"
        onClick={scrollThumbUp}
        disabled={!canScrollUp}
        className="flex h-5 w-5 items-center justify-center rounded transition-opacity duration-200"
        style={{
          opacity: canScrollUp ? (isTrackHovered ? 0.7 : 0.3) : 0.1,
          color: 'hsl(var(--thumb-mark-active))',
          cursor: canScrollUp ? 'pointer' : 'default',
        }}
      >
        <ChevronUp size={12} strokeWidth={2.5} />
      </button>

      <div className="relative flex items-center">
        {hoveredId && isTrackHovered && (
          <div
            className="pointer-events-none absolute right-7 whitespace-nowrap rounded px-2.5 py-1 font-medium text-[11px] shadow-lg"
            style={{
              backgroundColor: 'hsl(var(--thumb-tooltip-bg))',
              color: 'hsl(var(--thumb-tooltip-fg))',
              opacity: 1,
              transition: 'opacity 0.15s',
            }}
          >
            {headings.find((h) => h.id === hoveredId)?.text}
          </div>
        )}

        <div
          ref={trackRef}
          className="relative cursor-pointer select-none overflow-hidden"
          style={{ height: trackHeight, width: 16 }}
          onMouseDown={onMouseDown}
          role="group"
          aria-label="Document outline track"
        >
          {canScrollUp && (
            <div
              className="pointer-events-none absolute top-0 right-0 left-0 z-10"
              style={{
                height: 16,
                background:
                  'linear-gradient(to bottom, hsl(var(--thumb-bg, 0 0% 98%)), transparent)',
              }}
            />
          )}
          {canScrollDown && (
            <div
              className="pointer-events-none absolute right-0 bottom-0 left-0 z-10"
              style={{
                height: 16,
                background:
                  'linear-gradient(to top, hsl(var(--thumb-bg, 0 0% 98%)), transparent)',
              }}
            />
          )}

          {visibleHeadings.map((h, i) => {
            const isActive = h.id === activeId;
            const isHovered = h.id === hoveredId;
            const y = trackTopOffset + i * spacing;

            const baseWidth = h.level === 1 ? 10 : h.level === 2 ? 7 : 4;
            const width = isActive
              ? baseWidth + 4
              : isHovered
                ? baseWidth + 2
                : baseWidth;
            const height = isActive ? 2 : 1;

            return (
              <div
                key={h.id}
                className="absolute right-0 cursor-pointer rounded-full transition-all duration-150"
                style={{
                  backgroundColor: isActive
                    ? 'hsl(var(--thumb-mark-active))'
                    : 'hsl(var(--thumb-mark))',
                  top: y,
                  width,
                  height,
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
        className="flex h-5 w-5 items-center justify-center rounded transition-opacity duration-200"
        style={{
          opacity: canScrollDown ? (isTrackHovered ? 0.7 : 0.3) : 0.1,
          color: 'hsl(var(--thumb-mark-active))',
          cursor: canScrollDown ? 'pointer' : 'default',
        }}
      >
        <ChevronDown size={12} strokeWidth={2.5} />
      </button>
    </div>
  );
}
