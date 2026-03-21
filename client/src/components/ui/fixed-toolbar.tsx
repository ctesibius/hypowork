'use client';

import React from 'react';
import { FixedToolbar as FixedToolbarBase } from '@udecode/toolbar';

import { cn } from '@/lib/utils';

/**
 * `@udecode/toolbar` `FixedToolbar` already renders a sticky `Toolbar` (z-50, border-b, bg).
 * Do not wrap in a second `sticky` — nested sticky inside `overflow-auto` main can collapse
 * or hide the real toolbar row; only merge layout classes onto the single toolbar root.
 */
export function FixedToolbar(props: React.ComponentProps<typeof FixedToolbarBase>) {
  return (
    <FixedToolbarBase
      {...props}
      className={cn('min-h-[2.5rem] shrink-0', props.className)}
    />
  );
}
