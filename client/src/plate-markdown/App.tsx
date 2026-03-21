import { useEffect, useRef, useState } from 'react';
import { Plate, usePlateEditor } from 'platejs/react';
import { ScrollThumb as LibraryScrollThumb } from '@platejs/toc/react';
import { Editor, EditorContainer } from '@/ui/editor';
import { plugins } from './plugins';
import { mockValue } from './mockValue';

export default function App() {
  const editorCardRef = useRef<HTMLDivElement>(null);
  const [loadMs, setLoadMs] = useState<number | null>(null);
  const editor = usePlateEditor({
    plugins,
    value: mockValue,
  });

  useEffect(() => {
    if (loadMs !== null) return;
    const start = window.__loadStart;
    if (start === undefined) return;
    const raf = requestAnimationFrame(() => {
      const elapsed = performance.now() - start;
      setLoadMs(Math.round(elapsed));
    });
    return () => cancelAnimationFrame(raf);
  }, [loadMs]);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-5xl px-4">
        <Plate editor={editor}>
          <div className="flex gap-4">
            <div
              ref={editorCardRef}
              className="relative min-w-0 flex-1 overflow-visible rounded-lg border border-border bg-card shadow-sm"
            >
              <EditorContainer className="min-h-[400px]" variant="demo">
                <Editor
                  variant="demo"
                  placeholder="Type something..."
                  spellCheck={false}
                />
              </EditorContainer>
              <LibraryScrollThumb containerRef={editorCardRef} anchorRef={editorCardRef} position="sticky" />
            </div>
          </div>
        </Plate>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-muted-foreground text-sm">
          <span>Markdown note — full kit (mod+J AI, Copilot mock)</span>
          {loadMs !== null && (
            <span className="font-medium font-mono text-foreground">
              Load: {loadMs} ms
            </span>
          )}
          <span className="text-muted-foreground/80">
            {mockValue.length} blocks
          </span>
        </div>
      </main>
    </div>
  );
}
