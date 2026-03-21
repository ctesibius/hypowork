'use client';

import { KEYS } from 'platejs';

import { FixedToolbarKit } from './fixed-toolbar-kit';
import { FloatingToolbarKit } from './floating-toolbar-kit';

// Import plugins from @platejs/basic-nodes
import { ParagraphPlugin } from '@platejs/core/react';
import {
  BaseHeadingPlugin,
  BaseBlockquotePlugin,
  BaseBasicMarksPlugin,
} from '@platejs/basic-nodes';

// Import plugins from other plate packages
import { LinkPlugin } from '@platejs/link/react';
import { ListPlugin } from '@platejs/list/react';
import { IndentPlugin } from '@platejs/indent/react';
import { AutoformatPlugin } from '@platejs/autoformat';
import {
  autoformatSmartQuotes,
  autoformatPunctuation,
  autoformatArrow,
  autoformatMath,
  autoformatLegal,
  autoformatLegalHtml,
} from '@platejs/autoformat';

// Full-featured editor kit for hypowork
export const EditorKit = [
  // Core elements
  ParagraphPlugin,
  BaseHeadingPlugin,
  BaseBlockquotePlugin,

  // Basic marks (bold, italic, underline, etc.)
  BaseBasicMarksPlugin,

  // Lists
  ListPlugin,

  // Indent
  IndentPlugin.configure({
    inject: {
      targetPlugins: [...KEYS.heading, KEYS.p, KEYS.blockquote],
    },
  }),

  // Links
  LinkPlugin,

  // Autoformat
  AutoformatPlugin.configure({
    options: {
      enableUndoOnDelete: true,
      rules: [
        // Marks
        { match: '**', mode: 'mark', type: KEYS.bold },
        { match: '__', mode: 'mark', type: KEYS.underline },
        { match: '*', mode: 'mark', type: KEYS.italic },
        { match: '_', mode: 'mark', type: KEYS.italic },
        { match: '~~', mode: 'mark', type: KEYS.strikethrough },
        { match: '`', mode: 'mark', type: KEYS.code },

        // Blocks
        { match: '# ', mode: 'block', type: KEYS.h1 },
        { match: '## ', mode: 'block', type: KEYS.h2 },
        { match: '### ', mode: 'block', type: KEYS.h3 },
        { match: '#### ', mode: 'block', type: KEYS.h4 },
        { match: '##### ', mode: 'block', type: KEYS.h5 },
        { match: '###### ', mode: 'block', type: KEYS.h6 },
        { match: '> ', mode: 'block', type: KEYS.blockquote },

        // Import autoformat rules
        ...autoformatSmartQuotes,
        ...autoformatPunctuation,
        ...autoformatLegal,
        ...autoformatLegalHtml,
        ...autoformatArrow,
        ...autoformatMath,
      ],
    },
  }),

  // UI plugins
  ...FixedToolbarKit,
  ...FloatingToolbarKit,
];
