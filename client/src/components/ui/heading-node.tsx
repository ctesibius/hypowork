'use client';

import React from 'react';
import { PlateElement, type PlateElementProps } from 'platejs/react';
import { cn } from '@/lib/utils';

const headingStyles = {
  1: 'text-4xl font-bold',
  2: 'text-3xl font-bold',
  3: 'text-2xl font-semibold',
  4: 'text-xl font-semibold',
  5: 'text-lg font-medium',
  6: 'text-base font-medium',
} as const;

export function H1Element(props: PlateElementProps) {
  return (
    <PlateElement
      as="h1"
      className={cn(headingStyles[1], 'mb-4 mt-6 first:mt-0')}
      {...props}
    >
      {props.children}
    </PlateElement>
  );
}

export function H2Element(props: PlateElementProps) {
  return (
    <PlateElement
      as="h2"
      className={cn(headingStyles[2], 'mb-3 mt-5')}
      {...props}
    >
      {props.children}
    </PlateElement>
  );
}

export function H3Element(props: PlateElementProps) {
  return (
    <PlateElement
      as="h3"
      className={cn(headingStyles[3], 'mb-2 mt-4')}
      {...props}
    >
      {props.children}
    </PlateElement>
  );
}

export function H4Element(props: PlateElementProps) {
  return (
    <PlateElement
      as="h4"
      className={cn(headingStyles[4], 'mb-2 mt-4')}
      {...props}
    >
      {props.children}
    </PlateElement>
  );
}

export function H5Element(props: PlateElementProps) {
  return (
    <PlateElement
      as="h5"
      className={cn(headingStyles[5], 'mb-2 mt-4')}
      {...props}
    >
      {props.children}
    </PlateElement>
  );
}

export function H6Element(props: PlateElementProps) {
  return (
    <PlateElement
      as="h6"
      className={cn(headingStyles[6], 'mb-2 mt-4')}
      {...props}
    >
      {props.children}
    </PlateElement>
  );
}
