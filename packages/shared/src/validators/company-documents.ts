import { z } from "zod";
import { issueDocumentFormatSchema, issueDocumentKeySchema } from "./issue.js";

export const companyDocumentKindSchema = z.enum(["prose", "canvas"]);

/** Standalone company notes (not linked to an issue via `issue_documents`). */
export const createCompanyDocumentSchema = z.object({
  title: z.string().trim().max(200).nullable().optional(),
  /** @deprecated Prefer `collectionPath` — same value; stored as `folder_path` until collections table ships. */
  folderPath: z.string().trim().max(4000).nullable().optional(),
  /**
   * Virtual collection placement (Obsidian-style path, forward slashes). If both `collectionPath` and
   * `folderPath` are sent, `collectionPath` wins.
   */
  collectionPath: z.string().trim().max(4000).nullable().optional(),
  /** When set, document is scoped to this board project (must belong to the same company). */
  projectId: z.string().uuid().nullable().optional(),
  format: issueDocumentFormatSchema,
  /** Canonical prose/markdown (SSOT for wikilinks / Mem0). */
  body: z.string().max(524288),
  /**
   * Optional React Flow graph JSON when `kind` is `canvas` (or legacy combined body in `body` only).
   * When set, must not duplicate primary docPage body — prose lives in `body`.
   */
  canvasGraph: z.string().max(524288).nullable().optional(),
  kind: companyDocumentKindSchema.optional(),
});

export const updateCompanyDocumentSchema = z.object({
  title: z.string().trim().max(200).nullable().optional(),
  /** @deprecated Prefer `collectionPath`. */
  folderPath: z.string().trim().max(4000).nullable().optional(),
  /** If both placement fields are sent, `collectionPath` wins. */
  collectionPath: z.string().trim().max(4000).nullable().optional(),
  format: issueDocumentFormatSchema.optional(),
  body: z.string().max(524288).optional(),
  canvasGraph: z.string().max(524288).nullable().optional(),
  changeSummary: z.string().trim().max(500).nullable().optional(),
  baseRevisionId: z.string().uuid().nullable().optional(),
  /** Omit to leave unchanged; null clears project link. */
  projectId: z.string().uuid().nullable().optional(),
});

export const attachCompanyDocumentToIssueSchema = z.object({
  issueId: z.string().uuid(),
  key: issueDocumentKeySchema,
});

export type CreateCompanyDocument = z.infer<typeof createCompanyDocumentSchema>;
export type UpdateCompanyDocument = z.infer<typeof updateCompanyDocumentSchema>;
export type AttachCompanyDocumentToIssue = z.infer<typeof attachCompanyDocumentToIssueSchema>;
