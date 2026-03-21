'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface ToolbarGroupProps extends React.HTMLAttributes<HTMLDivElement> {}

export function ToolbarGroup({ className, ...props }: ToolbarGroupProps) {
  return (
    <div
      className={cn('flex items-center gap-0.5', className)}
      {...props}
    />
  );
}
