'use client';

import { useState } from 'react';
import { useParams } from '@/lib/router';
import { PlateMarkdownDocumentEditor } from '@/components/PlateEditor/PlateMarkdownDocumentEditor';
import { EmptyState } from '@/components/EmptyState';
import { FileText } from 'lucide-react';

export function PlateDocumentTest() {
  const { documentId } = useParams<{ documentId: string }>();
  const [markdown, setMarkdown] = useState('');

  if (!documentId) {
    return <EmptyState icon={FileText} message="No document ID provided." />;
  }

  return (
    <div className="max-w-4xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Plate Editor Test</h1>
        <p className="text-sm text-muted-foreground">
          Document ID: {documentId}
        </p>
        <p className="rounded-md border border-muted bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Uses <code className="font-mono text-xs">PlateMarkdownDocumentEditor</code> (slim plugin set + custom toolbar).
          Production documents use{" "}
          <code className="font-mono text-xs">PlateFullKitMarkdownDocumentEditor</code> (same kit as{" "}
          <code className="font-mono text-xs">/plate-markdown-test</code>). See{" "}
          <code className="font-mono text-xs">PlateEditor/FEATURE_PARITY_PLAN.md</code>.
        </p>
      </div>

      <PlateMarkdownDocumentEditor
        key={documentId}
        initialMarkdown=""
        onMarkdownChange={setMarkdown}
        className="min-h-[500px]"
      />

      <div className="rounded-md border border-border bg-muted p-4">
        <h3 className="text-sm font-medium">Markdown preview:</h3>
        <pre className="mt-2 max-h-[200px] overflow-auto whitespace-pre-wrap text-xs">{markdown}</pre>
      </div>
    </div>
  );
}
