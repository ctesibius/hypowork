'use client';

import React from 'react';
import { PlateElement, type PlateElementProps } from 'platejs/react';
import { cn } from '@/lib/utils';

export function ParagraphElement(props: PlateElementProps) {
  return (
    <PlateElement
      {...props}
      className={cn('mb-4 last:mb-0', props.className)}
    >
      {props.children}
    </PlateElement>
  );
}
