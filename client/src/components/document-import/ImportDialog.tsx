"use client";
import { useCallback, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UploadIcon, AlertCircleIcon, CheckCircleIcon, FileIcon } from "lucide-react";
import { useFilePicker } from "use-file-picker";
import type { SelectedFilesOrErrors } from "use-file-picker/types";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { queryKeys } from "@/lib/queryKeys";
import { documentImportApi, type ImportResult } from "@/api/document-import";
import { ApiError } from "@/api/client";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  projectId?: string;
};

export function ImportDialog({ open, onOpenChange, companyId, projectId }: Props) {
  const queryClient = useQueryClient();
  const dropRef = useRef<HTMLDivElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const acceptExtensions = [".md", ".mdx", ".zip"];

  const importMut = useMutation({
    mutationFn: () => {
      if (!selectedFile) throw new Error("No file selected");
      return documentImportApi.importFile(companyId, selectedFile, projectId);
    },
    onSuccess: (result) => {
      setImportResult(result);
      setImportError(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.companyDocuments.list(companyId) });
    },
    onError: (err) => {
      setImportError(err instanceof ApiError ? err.message : String(err));
    },
  });

  const handleFile = useCallback((file: File) => {
    setSelectedFile(file);
    setImportResult(null);
    setImportError(null);
  }, []);

  const { openFilePicker } = useFilePicker({
    readFilesContent: false,
    accept: acceptExtensions,
    multiple: false,
    onFilesSelected: (data: SelectedFilesOrErrors<undefined, unknown>) => {
      if ("errors" in data && data.errors?.length) return;
      const files = "plainFiles" in data ? data.plainFiles : undefined;
      if (files?.[0]) handleFile(files[0]);
    },
  });

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setSelectedFile(null);
        setImportResult(null);
        setImportError(null);
        setIsDragOver(false);
        importMut.reset();
      }
      onOpenChange(next);
    },
    [onOpenChange, importMut],
  );

  const handleImport = () => {
    if (!selectedFile) return;
    importMut.mutate();
  };

  // ── Drag and drop ────────────────────────────────────────────────────────

  const isValidExtension = (filename: string) =>
    acceptExtensions.some((ext) => filename.toLowerCase().endsWith(ext));

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only clear drag-over when leaving the drop zone entirely
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (!files.length) return;
      const file = files[0]!;
      if (!isValidExtension(file.name)) return;
      handleFile(file);
    },
    [handleFile],
  );

  // ─────────────────────────────────────────────────────────────────────────

  const isLoading = importMut.isPending;
  const hasResult = importResult !== null;
  const hasError = importError !== null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import documents</DialogTitle>
        </DialogHeader>

        {/* File selection — drag/drop zone + browse button */}
        {!hasResult && !hasError && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Import Markdown files or an Obsidian vault ZIP. Wikilinks will be resolved
              automatically.
            </p>

            {/* Drop zone */}
            <div
              ref={dropRef}
              onDragEnter={onDragEnter}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`
                relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8
                transition-colors cursor-pointer select-none
                ${isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/30 hover:border-muted-foreground/60"
                }
              `}
              onClick={() => void openFilePicker()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") void openFilePicker(); }}
            >
              <input
                type="file"
                accept={acceptExtensions.join(",")}
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  // Reset so same file can be re-selected
                  e.target.value = "";
                }}
              />

              <div className={`mb-3 rounded-full p-3 ${isDragOver ? "bg-primary/10" : "bg-muted"}`}>
                {selectedFile ? (
                  <FileIcon className="size-6 text-primary" />
                ) : (
                  <UploadIcon className={`size-6 ${isDragOver ? "text-primary" : "text-muted-foreground"}`} />
                )}
              </div>

              {selectedFile ? (
                <p className="text-sm font-medium text-center">{selectedFile.name}</p>
              ) : (
                <p className="text-sm text-muted-foreground text-center">
                  {isDragOver ? "Drop to import" : "Drag & drop a file here, or click to browse"}
                </p>
              )}
              {selectedFile && (
                <p className="text-xs text-muted-foreground mt-1">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Supported: .md, .mdx, .zip (Obsidian vault)
            </p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="py-4 text-center text-sm text-muted-foreground">
            Importing...
          </div>
        )}

        {/* Success state */}
        {hasResult && !isLoading && (
          <div className="space-y-3">
            {importResult.imported.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <CheckCircleIcon className="size-4 text-green-500" />
                  Imported ({importResult.imported.length})
                </p>
                <ul className="text-sm text-muted-foreground space-y-0.5 pl-5 list-disc">
                  {importResult.imported.map((doc) => (
                    <li key={doc.id}>{doc.title ?? doc.filename}</li>
                  ))}
                </ul>
              </div>
            )}

            {importResult.failed.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <AlertCircleIcon className="size-4 text-destructive" />
                  Failed ({importResult.failed.length})
                </p>
                <ul className="text-sm text-destructive space-y-0.5 pl-5 list-disc">
                  {importResult.failed.map((f) => (
                    <li key={f.filename}>
                      {f.filename}: {f.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Error state */}
        {hasError && !isLoading && (
          <p className="text-sm text-destructive">{importError}</p>
        )}

        <DialogFooter>
          {hasResult ? (
            <Button type="button" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleImport}
                disabled={!selectedFile || isLoading}
              >
                Import
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
