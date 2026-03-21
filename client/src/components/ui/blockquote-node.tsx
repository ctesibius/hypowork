'use client';

import React from 'react';
import { PlateElement, type PlateElementProps } from 'platejs/react';
import { cn } from '@/lib/utils';

export function BlockquoteElement(props: PlateElementProps) {
  return (
    <PlateElement
      as="blockquote"
      {...props}
      className={cn(
        'mt-4 mb-4 border-l-4 border-primary pl-4 italic text-muted-foreground',
        props.className
      )}
    >
      {props.children}
    </PlateElement>
  );
}
