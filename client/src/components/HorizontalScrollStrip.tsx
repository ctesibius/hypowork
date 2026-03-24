import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";

export type HorizontalScrollStripProps = {
  children: ReactNode;
  /** Fill parent height and stretch row children (e.g. Kanban columns). */
  stretch?: boolean;
  className?: string;
  scrollerClassName?: string;
};

export function HorizontalScrollStrip({
  children,
  stretch,
  className,
  scrollerClassName,
}: HorizontalScrollStripProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanLeft(scrollLeft > 1);
    setCanRight(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  useLayoutEffect(() => {
    updateScrollState();
  }, [updateScrollState]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    updateScrollState();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(updateScrollState);
    });
    ro.observe(el);
    el.addEventListener("scroll", updateScrollState, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", updateScrollState);
    };
  }, [updateScrollState]);

  const scrollBy = (delta: number) => {
    ref.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  const scrollNoBar =
    "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

  return (
    <div
      className={cn(
        "relative flex min-w-0 max-w-full flex-1 gap-1 sm:gap-2",
        stretch ? "h-full min-h-0 items-stretch" : "items-center",
        className,
      )}
    >
      <button
        type="button"
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background shadow-sm transition-opacity hover:bg-muted/50",
          stretch && "self-center",
          !canLeft && "pointer-events-none opacity-0",
        )}
        aria-label="Scroll left"
        onClick={() => scrollBy(-280)}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div
        ref={ref}
        className={cn(
          "flex min-w-0 flex-1 flex-nowrap overflow-x-auto overflow-y-hidden scroll-smooth",
          scrollNoBar,
          stretch && "h-full min-h-0 items-stretch",
          scrollerClassName,
        )}
      >
        {children}
      </div>
      <button
        type="button"
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background shadow-sm transition-opacity hover:bg-muted/50",
          stretch && "self-center",
          !canRight && "pointer-events-none opacity-0",
        )}
        aria-label="Scroll right"
        onClick={() => scrollBy(280)}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
