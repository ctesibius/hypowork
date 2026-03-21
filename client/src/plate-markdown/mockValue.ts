import type { Value } from 'platejs';

/**
 * Demo value with rich content including Mermaid diagrams (basic + complex)
 */
export const mockValue: Value = [
  { type: 'h1', children: [{ text: 'Markdown Note with Mermaid' }] },
  {
    type: 'p',
    children: [
      { text: 'This note demonstrates the Plate editor with ' },
      { text: 'formatting', italic: true },
      { text: ' and a ' },
      { type: 'a', url: 'https://platejs.org', children: [{ text: 'link' }] },
      { text: '.' },
    ],
  },
  { type: 'h2', children: [{ text: 'Basic Mermaid Diagram' }] },
  {
    type: 'code_drawing',
    data: {
      drawingType: 'mermaid',
      drawingMode: 'Both',
      code: `graph TD
    A[Start] --> B{Is it?}
    B -->|Yes| C[OK]
    B -->|No| D[End]`,
    },
    children: [{ text: '' }],
  },
  { type: 'h2', children: [{ text: 'Complex Mermaid Diagram' }] },
  {
    type: 'code_drawing',
    data: {
      drawingType: 'mermaid',
      drawingMode: 'Both',
      code: `flowchart LR
    subgraph B["Backend"]
        direction TB
        API[API Gateway]
        DB[(Database)]
        API --> DB
    end

    subgraph F["Frontend"]
        direction TB
        UI[React App]
        Store[State]
        UI --> Store
    end

    F -->|HTTP| B

    style B fill:#e1f5fe
    style F fill:#fff3e0`,
    },
    children: [{ text: '' }],
  },
  { type: 'h2', children: [{ text: 'Table of contents' }] },
  { type: 'toc', children: [{ text: '' }] },
  { type: 'h2', children: [{ text: 'Blockquote' }] },
  {
    type: 'blockquote',
    children: [
      {
        type: 'p',
        children: [{ text: 'Blockquotes highlight important information.' }],
      },
    ],
  },
  { type: 'h2', children: [{ text: 'Code block' }] },
  {
    type: 'code_block',
    lang: 'javascript',
    children: [
      { type: 'code_line', children: [{ text: 'function hello() {' }] },
      { type: 'code_line', children: [{ text: "  return 'world';" }] },
      { type: 'code_line', children: [{ text: '}' }] },
    ],
  },
  { type: 'h2', children: [{ text: 'Table' }] },
  {
    type: 'table',
    colSizes: [120, 120],
    children: [
      {
        type: 'tr',
        children: [
          {
            type: 'th',
            children: [{ type: 'p', children: [{ text: 'Feature', bold: true }] }],
          },
          {
            type: 'th',
            children: [{ type: 'p', children: [{ text: 'Status', bold: true }] }],
          },
        ],
      },
      {
        type: 'tr',
        children: [
          { type: 'td', children: [{ type: 'p', children: [{ text: 'Mermaid Diagrams' }] }] },
          { type: 'td', children: [{ type: 'p', children: [{ text: '✓ Supported' }] }] },
        ],
      },
      {
        type: 'tr',
        children: [
          { type: 'td', children: [{ type: 'p', children: [{ text: 'Code Blocks' }] }] },
          { type: 'td', children: [{ type: 'p', children: [{ text: '✓ Supported' }] }] },
        ],
      },
    ],
  },
  { type: 'h2', children: [{ text: 'Lists' }] },
  {
    type: 'p',
    indent: 1,
    listStyleType: 'disc',
    children: [{ text: 'Bullet one' }],
  },
  {
    type: 'p',
    indent: 1,
    listStyleType: 'disc',
    children: [{ text: 'Bullet two' }],
  },
  {
    type: 'p',
    indent: 1,
    listStyleType: 'decimal',
    children: [{ text: 'Numbered one' }],
  },
  {
    type: 'p',
    indent: 1,
    listStyleType: 'decimal',
    children: [{ text: 'Numbered two' }],
  },
  { type: 'h2', children: [{ text: 'Callout' }] },
  {
    type: 'callout',
    variant: 'info',
    children: [
      {
        type: 'p',
        children: [
          { text: 'Press ' },
          { type: 'kbd', children: [{ text: '⌘+J' }] },
          { text: ' for AI or type / for slash commands.' },
        ],
      },
    ],
  },
  { type: 'h2', children: [{ text: 'Toggle' }] },
  {
    type: 'toggle',
    children: [
      {
        type: 'toggle_trigger',
        children: [{ text: 'Click to expand' }],
      },
      {
        type: 'toggle_content',
        children: [
          {
            type: 'p',
            children: [{ text: 'Toggle content goes here.' }],
          },
        ],
      },
    ],
  },
];
