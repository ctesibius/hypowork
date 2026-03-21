'use client';

import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  StrikethroughIcon,
  CodeIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
} from 'lucide-react';
import { KEYS } from 'platejs';
import { useEditorRef } from 'platejs/react';
import { toggleList } from '@platejs/list';

import { ToolbarButton } from './toolbar-button';
import { ToolbarGroup } from './toolbar-group';

export function FixedToolbarButtons() {
  const editor = useEditorRef();

  const toggleMark = (markKey: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    editor.tf.toggleMark(markKey);
  };

  return (
    <div className="flex w-full">
      <ToolbarGroup>
        <ToolbarButton
          title="Bold (⌘+B)"
          onMouseDown={toggleMark(KEYS.bold)}
        >
          <BoldIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Italic (⌘+I)"
          onMouseDown={toggleMark(KEYS.italic)}
        >
          <ItalicIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Underline (⌘+U)"
          onMouseDown={toggleMark(KEYS.underline)}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Strikethrough"
          onMouseDown={toggleMark(KEYS.strikethrough)}
        >
          <StrikethroughIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Code (⌘+E)"
          onMouseDown={toggleMark(KEYS.code)}
        >
          <CodeIcon className="h-4 w-4" />
        </ToolbarButton>
      </ToolbarGroup>

      <div className="mx-1 h-6 w-px bg-border" />

      <ToolbarGroup>
        <ToolbarButton
          title="Bulleted list"
          onMouseDown={(e) => {
            e.preventDefault();
            toggleList(editor, { listStyleType: 'disc' });
          }}
        >
          <ListIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Numbered list"
          onMouseDown={(e) => {
            e.preventDefault();
            toggleList(editor, { listStyleType: 'decimal' });
          }}
        >
          <ListOrderedIcon className="h-4 w-4" />
        </ToolbarButton>
      </ToolbarGroup>

      <div className="mx-1 h-6 w-px bg-border" />

      <ToolbarGroup>
        <ToolbarButton
          title="Blockquote"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.tf.setNodes({ type: KEYS.blockquote });
          }}
        >
          <QuoteIcon className="h-4 w-4" />
        </ToolbarButton>
      </ToolbarGroup>

      <div className="grow" />
    </div>
  );
}
