'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export interface ToolbarButtonProps extends React.ComponentProps<typeof Button> {
  active?: boolean;
}

export const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  ({ className, active, ...props }, ref) => (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      className={cn(
        'h-8 w-8',
        active && 'bg-accent text-accent-foreground',
        className
      )}
      {...props}
    />
  )
);
ToolbarButton.displayName = 'ToolbarButton';
