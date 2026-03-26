/**
 * Obsidian-style wikilink parsing and resolution.
 *
 * Handles:
 *   [[Title]]            → link to page by title (case-insensitive)
 *   [[Title#heading]]   → link to page by title, anchor ignored
 *   [[Title|alias]]     → link with display alias
 *
 * ZIP import keeps `[[wikilinks]]` in stored markdown (Plate + `document-link-support` expect that).
 * This helper remains for ad-hoc transforms only — **not** used on import (UUID markdown links are
 * not indexed like `[[title]]` and do not become mention chips in the editor).
 */

import matter from "gray-matter";

const WIKILINK_RE = /\[\[([^\]|#]+)(?:#[^\]]*)?(?:\|([^\]]+))?\]\]/g;

/** BlockSuite-style: trim + lowercase for wikilink / title map keys. */
export function normalizeTitleForLookup(title: string): string {
  return title.trim().toLowerCase();
}

/** Basename without `.md` (no dash→space), for secondary map key like BlockSuite. */
export function stemFromZipPath(fullPath: string): string {
  const base = fullPath.replace(/\\/g, "/").split("/").pop() ?? fullPath;
  return base.replace(/\.md$/i, "");
}

/**
 * Replace `[[wikilinks]]` with `[text](uuid)` markdown links. **Not used by ZIP import** (see
 * `document-import.service.ts`). Unresolved links become `[text](#)`.
 */
export function resolveObsidianWikilinks(
  content: string,
  titleToPageIdMap: Map<string, string>,
): string {
  return content.replace(WIKILINK_RE, (_, title: string, alias: string | undefined) => {
    const normalized = normalizeTitleForLookup(title);
    const pageId = titleToPageIdMap.get(normalized);
    if (!pageId) {
      return `[${alias ?? title}](#)`;
    }
    const linkText = alias ?? title;
    return `[${linkText}](${pageId})`;
  });
}

/**
 * Extract frontmatter via gray-matter (BlockSuite uses parseMatter / YAML).
 * Returns body without frontmatter and optional `title` or `name` from YAML.
 */
export function parseMarkdownFrontmatter(raw: string): {
  title: string | null;
  body: string;
} {
  try {
    const { data, content } = matter(raw);
    if (data == null || typeof data !== "object" || Array.isArray(data)) {
      return { title: null, body: typeof content === "string" ? content : raw };
    }
    const rec = data as Record<string, unknown>;
    const titleRaw = rec.title ?? rec.name;
    const title =
      titleRaw !== undefined && titleRaw !== null ? String(titleRaw).trim() || null : null;
    return { title, body: typeof content === "string" ? content : raw };
  } catch {
    return { title: null, body: raw };
  }
}

/**
 * Derive a document title from a filename path.
 * e.g. "docs/project-plan.md" → "project-plan"
 */
export function titleFromFilename(filename: string): string {
  const base = filename.split("/").pop() ?? filename;
  return base.replace(/\.md$/i, "").replace(/[-_]/g, " ");
}

/**
 * **Obsidian vault → collection placement**
 *
 * In Obsidian, notes live under a vault root with optional subfolders (`Daily/2025-03-25.md`).
 * Those folders are **not** OS paths on our server; they are how users **group** notes.
 * We persist that grouping as a single **collection path** string (forward slashes, no trailing slash),
 * stored in DB column `folder_path` until a dedicated `collections` table exists
 * (see `docs/design/documents-collections.md`).
 *
 * ZIP import mirrors a vault export: archive paths like `Projects/Spec/intro.md` yield
 * collection path `Projects/Spec` and title/body from the file. Root-level `note.md` → null
 * (document sits in the workspace “root” collection).
 *
 * @param filename Vault-relative path inside the ZIP, normalized to forward slashes
 * @returns Collection path excluding the `.md` basename, or `null` for root-level files
 */
export function collectionPathFromZipFilename(filename: string): string | null {
  const norm = filename.replace(/\\/g, "/").replace(/^\/+/, "");
  const lastSlash = norm.lastIndexOf("/");
  if (lastSlash <= 0) return null;
  const dir = norm.slice(0, lastSlash).replace(/\/+/g, "/");
  return dir.length === 0 ? null : dir;
}

/** @deprecated Use {@link collectionPathFromZipFilename} — same behavior; name kept for older call sites. */
export const folderPathFromZipFilename = collectionPathFromZipFilename;
