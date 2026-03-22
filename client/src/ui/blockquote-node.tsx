'use client';

import { NodeApi } from 'platejs';
import { type PlateElementProps, PlateElement } from 'platejs/react';

import { CopyToClipboardButton } from '@/components/ui/copy-to-clipboard-button';

export function BlockquoteElement({ children, ...rest }: PlateElementProps) {
  const plain = NodeApi.string(rest.element);

  return (
    <PlateElement
      as="blockquote"
      className="relative my-1 border-l-2 pr-12 pl-6 italic"
      {...rest}
    >
      <div
        className="pointer-events-auto absolute top-1 right-1 z-10"
        contentEditable={false}
      >
        <CopyToClipboardButton text={plain} className="size-7" />
      </div>
      {children}
    </PlateElement>
  );
}
