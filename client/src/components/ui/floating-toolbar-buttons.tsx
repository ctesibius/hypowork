'use client';

import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  StrikethroughIcon,
  CodeIcon,
} from 'lucide-react';
import { KEYS } from 'platejs';
import { useEditorRef } from 'platejs/react';

import { ToolbarButton } from './toolbar-button';
import { ToolbarGroup } from './toolbar-group';

export function FloatingToolbarButtons() {
  const editor = useEditorRef();

  const toggleMark = (markKey: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    editor.tf.toggleMark(markKey);
  };

  return (
    <>
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
    </>
  );
}
