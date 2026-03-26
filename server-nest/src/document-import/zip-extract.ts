/**
 * ZIP extraction via fflate (Hypopedia / BlockSuite parity).
 *
 * Custom EOCD parsers miss data descriptors, Zip64 edge cases, etc. BlockSuite uses
 * `fflate.unzipSync` in `blocksuite/.../transformers/utils.ts` — same approach here.
 *
 * **Paths and collections:** Each entry’s `filename` is the path **inside the archive**
 * (e.g. `Areas/Work/spec.md`). Import treats directory segments as **Obsidian-style folders**
 * and maps them to our **collection placement** string (see `collectionPathFromZipFilename` in
 * `wikilink-resolver.ts`) — not to server filesystem directories.
 */

import { unzipSync } from "fflate";

const utf8 = new TextDecoder("utf-8", { fatal: false });

export interface ZipEntry {
  filename: string;
  content: string;
}

function normalizePath(key: string): string {
  return key.replace(/\\/g, "/").replace(/^\/+/, "");
}

function skipPath(p: string): boolean {
  return p.includes("__MACOSX") || p.includes(".DS_Store");
}

function isMarkdownBasename(path: string): boolean {
  const base = path.split("/").pop() ?? path;
  return base.toLowerCase().endsWith(".md");
}

function unzipToRecord(buffer: Buffer): Record<string, Uint8Array> | null {
  try {
    return unzipSync(new Uint8Array(buffer));
  } catch {
    return null;
  }
}

function collectFiltered(
  raw: Record<string, Uint8Array>,
  pathFilter: (normalizedPath: string) => boolean,
): ZipEntry[] {
  const entries: ZipEntry[] = [];
  for (const key of Object.keys(raw)) {
    const p = normalizePath(key);
    if (skipPath(p)) continue;
    if (!pathFilter(p)) continue;
    const bytes = raw[key];
    if (bytes === undefined) continue;
    entries.push({ filename: p, content: utf8.decode(bytes) });
  }
  return entries;
}

/**
 * Extract entries matching `pathFilter` (full normalized path). Decodes as UTF-8.
 */
export async function extractZipEntries(
  buffer: Buffer,
  pathFilter: (normalizedPath: string) => boolean,
): Promise<ZipEntry[]> {
  const raw = unzipToRecord(buffer);
  if (!raw) return [];
  return collectFiltered(raw, pathFilter);
}

/**
 * All `.md` files in the archive (case-insensitive on basename), with **vault-relative** paths
 * preserved in `filename` (folders in the ZIP → collection path on each document after import).
 */
export async function extractMarkdownFilesFromZip(buffer: Buffer): Promise<ZipEntry[]> {
  const raw = unzipToRecord(buffer);
  if (!raw) return [];

  const entries = collectFiltered(raw, isMarkdownBasename);

  return entries;
}
