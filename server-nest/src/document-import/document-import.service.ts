/**
 * Document import service — server-side ZIP + markdown import.
 *
 * Two-phase import (mirrors BlockSuite's MarkdownTransformer.importMarkdownZip):
 *   Phase 1: Decompress ZIP, extract .md files, pre-create stub docs to get stable IDs.
 *   Phase 2: Persist each file's markdown body **verbatim** (Obsidian `[[wikilinks]]`, `![[embeds]]`, etc.).
 *
 * We do **not** rewrite `[[Title]]` → `[Title](uuid)`: Plate upgrades plain `[[...]]` to mention chips
 * via `applyWikilinkPlainTextToMentions`, and `document-link-support` indexes `[[...]]` / `@` — not
 * standard Markdown links. Rewriting also broke `![[...]]` image embeds.
 *
 * **Obsidian / vault folders → collections:** ZIP directory structure is interpreted like an
 * Obsidian vault: `Folder/sub/note.md` places the document in collection path `Folder/sub`.
 * That value is written via `collectionPath` on create (stored in `documents.folder_path` until
 * we add a `collections` table). Root-level `.md` files have no collection path (workspace root).
 */

import type { Db } from "@paperclipai/db";
import { documentService as expressDocumentService } from "@paperclipai/server/services/documents";
import {
  collectionPathFromZipFilename,
  parseMarkdownFrontmatter,
  titleFromFilename,
} from "./wikilink-resolver.js";
import { extractMarkdownFilesFromZip } from "./zip-extract.js";

export type ImportResult = {
  imported: Array<{ id: string; title: string | null; filename: string }>;
  failed: Array<{ filename: string; error: string }>;
};

interface MarkdownFileEntry {
  filename: string;
  docId: string;
  title: string;
  body: string;
  /** Revision id from stub create — required for optimistic-concurrency update. */
  baseRevisionId: string;
}

/**
 * Import a Markdown ZIP into a company (optionally scoped to a project).
 *
 * Phase 1: Create stub docs to get stable IDs.
 * Phase 2: Write each note's markdown body (wikilinks unchanged).
 */
export async function importMarkdownZip(
  db: Db,
  buffer: Buffer,
  companyId: string,
  projectId: string | null | undefined,
): Promise<ImportResult> {
  const docSvc = expressDocumentService(db);

  const mdFiles = await extractMarkdownFilesFromZip(buffer);

  if (mdFiles.length === 0) {
    return { imported: [], failed: [{ filename: "archive", error: "No .md files found in ZIP" }] };
  }

  // ── Phase 1: Pre-create stub docs to get stable IDs ──────────────────────
  const stubs: MarkdownFileEntry[] = [];

  for (const file of mdFiles) {
    const { title: rawTitle, body } = parseMarkdownFrontmatter(file.content);
    const docTitle = rawTitle ?? titleFromFilename(file.filename);
    // Obsidian-style: ZIP folders → collection placement (persisted as folder_path in DB).
    const collectionPath = collectionPathFromZipFilename(file.filename);

    const doc = await docSvc.createCompanyDocument({
      companyId,
      title: docTitle,
      format: "markdown",
      body: "", // stub — filled in phase 2
      ...(collectionPath != null ? { collectionPath } : {}),
      ...(projectId !== undefined ? { projectId: projectId ?? null } : {}),
    });

    const revId = doc.latestRevisionId;
    if (!revId) {
      throw new Error(`Import stub missing latestRevisionId for document ${doc.id}`);
    }

    stubs.push({
      filename: file.filename,
      docId: doc.id,
      title: docTitle,
      body,
      baseRevisionId: revId,
    });
  }

  // ── Phase 2: Persist markdown as authored (Obsidian [[wikilinks]] / ![[embeds]]) ─────────
  const results = await Promise.allSettled(
    stubs.map(async (stub) => {
      await docSvc.updateCompanyDocument({
        companyId,
        documentId: stub.docId,
        body: stub.body,
        baseRevisionId: stub.baseRevisionId,
      });
      return { id: stub.docId, title: stub.title, filename: stub.filename };
    }),
  );

  const imported: ImportResult["imported"] = [];
  const failed: ImportResult["failed"] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i]!;
    const stub = stubs[i]!;
    if (result.status === "fulfilled") {
      imported.push(result.value);
    } else {
      failed.push({ filename: stub.filename, error: String(result.reason?.message ?? result.reason) });
    }
  }

  return { imported, failed };
}

/**
 * Import a single markdown file into a company (optionally scoped to a project).
 * No wikilink resolution (single file — no cross-references to resolve).
 */
export async function importMarkdownFile(
  db: Db,
  content: string,
  filename: string,
  companyId: string,
  projectId: string | null | undefined,
): Promise<{ id: string; title: string | null }> {
  const docSvc = expressDocumentService(db);

  const { title, body } = parseMarkdownFrontmatter(content);
  const docTitle = title ?? titleFromFilename(filename);
  const collectionPath = collectionPathFromZipFilename(filename);

  const doc = await docSvc.createCompanyDocument({
    companyId,
    title: docTitle,
    format: "markdown",
    body,
    ...(collectionPath != null ? { collectionPath } : {}),
    ...(projectId !== undefined ? { projectId: projectId ?? null } : {}),
  });

  return { id: doc.id, title: doc.title };
}
