'use client';

import React from 'react';
import { FloatingToolbar as FloatingToolbarBase } from '@udecode/toolbar';

export function FloatingToolbar(props: React.ComponentProps<typeof FloatingToolbarBase>) {
  return <FloatingToolbarBase {...props} />;
}
