'use client';

import { createPlatePlugin } from 'platejs/react';

import { FixedToolbar } from '@/ui/fixed-toolbar';
import { FixedToolbarButtons } from '@/ui/fixed-toolbar-buttons';

export const FixedToolbarKit = [
  createPlatePlugin({
    key: 'fixed-toolbar',
    render: {
      beforeEditable: () => (
        <FixedToolbar className="z-10 min-h-[2.5rem] shrink-0">
          <FixedToolbarButtons />
        </FixedToolbar>
      ),
    },
  }),
];
