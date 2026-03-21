'use client';

import { createPlatePlugin } from 'platejs/react';
import { FixedToolbarButtons } from '@/components/FixedToolbarButtons';

/** Original (components) toolbar — mount above package toolbar to compare visibility. */
export const FixedToolbarOriginalKit = [
  createPlatePlugin({
    key: 'fixed-toolbar-original',
    render: {
      beforeEditable: () => (
        <div
          data-testid="toolbar-original"
          className="sticky top-0 z-10 shrink-0"
        >
          <FixedToolbarButtons />
        </div>
      ),
    },
  }),
];
