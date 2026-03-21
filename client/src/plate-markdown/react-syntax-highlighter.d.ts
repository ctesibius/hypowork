declare module 'react-syntax-highlighter' {
  import type { ComponentType } from 'react';
  export interface SyntaxHighlighterProps {
    language?: string;
    style?: Record<string, React.CSSProperties>;
    customStyle?: Record<string, unknown>;
    codeTagProps?: Record<string, unknown>;
    lineNumberStyle?: Record<string, unknown>;
    showLineNumbers?: boolean;
    PreTag?: keyof JSX.IntrinsicElements | ComponentType<unknown>;
    children?: string;
  }
  export const Prism: ComponentType<SyntaxHighlighterProps>;
}

declare module 'react-syntax-highlighter/dist/cjs/styles/prism' {
  import type { CSSProperties } from 'react';
  export const coldarkDark: Record<string, CSSProperties>;
}
