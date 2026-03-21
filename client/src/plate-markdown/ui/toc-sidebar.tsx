'use client';

import type { Heading } from '@platejs/toc';
import { useTocSideBar, useTocSideBarState } from '@platejs/toc/react';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const headingItemVariants = cva(
  'block w-full cursor-pointer truncate rounded-none px-0.5 py-1.5 text-left font-medium text-muted-foreground text-sm underline decoration-[0.5px] underline-offset-4 hover:bg-accent hover:text-foreground',
  {
    variants: {
      depth: {
        1: 'pl-0.5',
        2: 'pl-4',
        3: 'pl-6',
      },
      active: {
        true: 'font-semibold text-foreground',
        false: '',
      },
    },
    defaultVariants: { active: false },
  }
);

export function TocSideBar({
  className,
  open = true,
  topOffset = 80,
}: {
  className?: string;
  open?: boolean;
  topOffset?: number;
}) {
  const state = useTocSideBarState({ open, topOffset });
  const { navProps, onContentClick } = useTocSideBar(state);
  const { headingList, activeContentId } = state;

  return (
    <nav
      aria-label="Table of contents"
      className={cn(
        'shrink-0 overflow-y-auto border-border border-l bg-muted/30',
        className
      )}
      {...navProps}
    >
      <div className="sticky top-0 px-2 py-3">
        {headingList.length > 0 ? (
          <ul className="space-y-0.5">
            {headingList.map((item: Heading) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={cn(
                    headingItemVariants({
                      depth: (item.depth <= 3 ? item.depth : 3) as 1 | 2 | 3,
                      active: item.id === activeContentId,
                    })
                  )}
                  onClick={(e) => onContentClick(e, item, 'smooth')}
                  aria-current={
                    item.id === activeContentId ? 'location' : undefined
                  }
                >
                  {item.title}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-xs">
            No headings in this document.
          </p>
        )}
      </div>
    </nav>
  );
}
