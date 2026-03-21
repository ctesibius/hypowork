'use client';

import type { ComponentProps } from 'react';
import { FixedToolbar as FixedToolbarBase } from '@udecode/toolbar';

export function FixedToolbar(props: ComponentProps<typeof FixedToolbarBase>) {
  return (
    <div className="sticky top-0 z-10 min-h-[2.5rem] w-full shrink-0 border-border border-b bg-background">
      <FixedToolbarBase {...props} />
    </div>
  );
}
