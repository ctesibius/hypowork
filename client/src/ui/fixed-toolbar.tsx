'use client';

import type { ComponentProps } from 'react';
import { FixedToolbar as FixedToolbarBase } from '@udecode/toolbar';

import { cn } from '@/lib/utils';

/** See `components/ui/fixed-toolbar.tsx` — one sticky `Toolbar` root only. */
export function FixedToolbar(props: ComponentProps<typeof FixedToolbarBase>) {
  return (
    <FixedToolbarBase
      {...props}
      className={cn('min-h-[2.5rem] shrink-0', props.className)}
    />
  );
}
