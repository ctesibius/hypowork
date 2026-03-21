'use client';

import { Plate, usePlateEditor } from 'platejs/react';

import { EditorKit } from '@/kits/editor-kit';
import { Editor, EditorContainer } from '@/ui/editor';

export function PlateEditor() {
  const editor = usePlateEditor({
    plugins: EditorKit,
  });

  return (
    <Plate editor={editor}>
      <EditorContainer>
        <Editor variant="demo" placeholder="Type..." />
      </EditorContainer>
    </Plate>
  );
}
