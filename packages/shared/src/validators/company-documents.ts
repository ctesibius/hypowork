import { z } from "zod";
import { issueDocumentFormatSchema, issueDocumentKeySchema } from "./issue.js";

/** Standalone company notes (not linked to an issue via `issue_documents`). */
export const createCompanyDocumentSchema = z.object({
  title: z.string().trim().max(200).nullable().optional(),
  format: issueDocumentFormatSchema,
  body: z.string().max(524288),
});

export const updateCompanyDocumentSchema = z.object({
  title: z.string().trim().max(200).nullable().optional(),
  format: issueDocumentFormatSchema.optional(),
  body: z.string().max(524288),
  changeSummary: z.string().trim().max(500).nullable().optional(),
  baseRevisionId: z.string().uuid().nullable().optional(),
});

export const attachCompanyDocumentToIssueSchema = z.object({
  issueId: z.string().uuid(),
  key: issueDocumentKeySchema,
});

export type CreateCompanyDocument = z.infer<typeof createCompanyDocumentSchema>;
export type UpdateCompanyDocument = z.infer<typeof updateCompanyDocumentSchema>;
export type AttachCompanyDocumentToIssue = z.infer<typeof attachCompanyDocumentToIssueSchema>;
