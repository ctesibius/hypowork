'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useScrollRef } from 'platejs/react';

type HeadingInfo = {
  id: string;
  text: string;
  level: number;
  top: number;
  normalizedY: number;
};

const VISIBLE_COUNT = 10;
const MARK_SPACING = 10;
const TRACK_VIEW_HEIGHT = 120;

type ScrollThumbProps = {
  containerRef?: React.RefObject<HTMLElement | null>;
  /** Ref to the editor card (or any anchor); when position='sticky' we fix to viewport and align to anchor's right edge */
  anchorRef?: React.RefObject<HTMLElement | null>;
  /** 'fixed' = viewport right; 'absolute' = inside card; 'sticky' = fixed to viewport, aligned to anchorRef right edge */
  position?: 'fixed' | 'absolute' | 'sticky';
};

export function ScrollThumb({
  containerRef: containerRefProp,
  anchorRef: _anchorRef,
  position = 'fixed',
}: ScrollThumbProps) {
  const plateScrollRef = useScrollRef();
  const containerRef = containerRefProp ?? plateScrollRef;

  const [headings, setHeadings] = useState<HeadingInfo[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isTrackHovered, setIsTrackHovered] = useState(false);
  const [thumbOffset, setThumbOffset] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const thumbOffsetRef = useRef(0);
  const hoverLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const maxOffset = Math.max(0, headings.length - VISIBLE_COUNT);

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
      const top =
        elRect.top - containerRect.top + container.scrollTop;
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

  useEffect(() => {
    const container = containerRef?.current;
    if (!container || !headings.length) return;

    const timer = setTimeout(gatherHeadings, 300);

    const onScroll = () => {
      const scrollTop = container.scrollTop + 100;
      let current = '';
      let currentIdx = 0;
      for (let i = 0; i < headings.length; i++) {
        if (headings[i].top <= scrollTop) {
          current = headings[i].id;
          currentIdx = i;
        }
      }
      setActiveId(current);

      const offset = thumbOffsetRef.current;
      const centerOffset = Math.floor(VISIBLE_COUNT / 2);
      const idealOffset = currentIdx - centerOffset;
      const currMaxOffset = Math.max(0, headings.length - VISIBLE_COUNT);
      const clampedOffset = Math.max(0, Math.min(currMaxOffset, idealOffset));
      if (clampedOffset !== offset) {
        updateThumbOffset(clampedOffset);
      }
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      container.removeEventListener('scroll', onScroll);
    };
  }, [containerRef, headings, gatherHeadings, updateThumbOffset]);

  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;
    const observer = new ResizeObserver(gatherHeadings);
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef, gatherHeadings]);

  useEffect(() => {
    return () => {
      if (hoverLeaveTimerRef.current) clearTimeout(hoverLeaveTimerRef.current);
    };
  }, []);

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
      const contentHeight = (headings.slice(thumbOffset, thumbOffset + VISIBLE_COUNT).length - 1) * MARK_SPACING;
      const topOffset = Math.max(0, (rect.height - contentHeight - 4) / 2);
      const yInContent = clientY - rect.top - topOffset;
      const ratio = Math.max(0, Math.min(1, contentHeight > 0 ? yInContent / contentHeight : 0));

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

  if (headings.length === 0) return null;

  const visibleHeadings = headings.slice(
    thumbOffset,
    thumbOffset + VISIBLE_COUNT
  );
  const canScrollUp = thumbOffset > 0;
  const canScrollDown = thumbOffset < maxOffset;
  const spacing = MARK_SPACING;
  const actualTrackHeight = (visibleHeadings.length - 1) * spacing;
  const trackHeight = TRACK_VIEW_HEIGHT;
  const trackTopOffset = Math.max(
    0,
    (trackHeight - actualTrackHeight - 4) / 2
  );

  const isSticky = position === 'sticky';
  const isVite = true;
  const verticalOffset = isVite ? 120 : 0;
  const positionClass =
    isSticky
      ? 'fixed top-1/2 z-[100] flex flex-col items-center gap-1'
      : position === 'absolute'
        ? 'absolute left-0 top-1/2 z-[100] flex -translate-y-1/2 flex-col items-center gap-1'
        : 'fixed left-3 top-1/2 z-[100] flex -translate-y-1/2 flex-col items-center gap-1';

  const thumbStyle: React.CSSProperties =
    isSticky
      ? {
          left: 12,
          top: '50%',
          transform: `translateY(calc(-50% - ${verticalOffset}px))`,
          boxShadow:
            '0 0 24px rgba(147, 51, 234, 0.55), 0 0 48px rgba(147, 51, 234, 0.25)',
        }
      : position === 'absolute'
        ? {
            boxShadow:
              '0 0 24px rgba(147, 51, 234, 0.55), 0 0 48px rgba(147, 51, 234, 0.25)',
          }
        : {
            boxShadow:
              '0 0 24px rgba(147, 51, 234, 0.55), 0 0 48px rgba(147, 51, 234, 0.25)',
          };

  const thumbContent = (
    <div
      ref={wrapperRef}
      data-vite-thumb
      className={positionClass}
      style={{
        ...thumbStyle,
        transition: 'opacity 0.2s, transform 0.2s',
      }}
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
        className="rounded bg-violet-500/90 px-1 py-0.5 text-[9px] font-bold text-white"
        title="Vite app thumb (not library)"
      >
        Vite
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
              className="pointer-events-none absolute right-7 whitespace-nowrap rounded px-2.5 py-1 text-[11px] font-medium shadow-lg"
              style={{
                backgroundColor: 'hsl(var(--thumb-tooltip-bg))',
                color: 'hsl(var(--thumb-tooltip-fg))',
                opacity: 1,
                transition: 'opacity 0.15s, transform 0.15s',
                transform: 'translateX(0)',
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
              className="pointer-events-none absolute top-0 left-0 right-0 z-10"
              style={{
                height: 16,
                background:
                  'linear-gradient(to bottom, hsl(var(--thumb-bg, 0 0% 98%)), transparent)',
              }}
            />
          )}
          {canScrollDown && (
            <div
              className="pointer-events-none absolute bottom-0 left-0 right-0 z-10"
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
                onClick={(e: React.MouseEvent) => {
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

  return thumbContent;
}
