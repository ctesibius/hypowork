import { and, asc, desc, eq, isNull, lt, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { documentRevisions, documents, issueDocuments, issues } from "@paperclipai/db";
import { issueDocumentKeySchema } from "@paperclipai/shared";
import { conflict, notFound, unprocessable } from "../errors.js";
import {
  assertStandaloneCompanyDocument,
  getDocumentNeighborhoodIds,
  listIncomingDocumentLinks,
  listOutgoingDocumentLinks,
  replaceDocumentLinksForSource,
} from "./document-link-support.js";

function normalizeDocumentKey(key: string) {
  const normalized = key.trim().toLowerCase();
  const parsed = issueDocumentKeySchema.safeParse(normalized);
  if (!parsed.success) {
    throw unprocessable("Invalid document key", parsed.error.issues);
  }
  return parsed.data;
}

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505";
}

type RevisionPruneTx = Pick<Db, "select" | "delete">;

/** Max revisions to keep per document; unset or `0` = no pruning (default). */
function documentRevisionRetainLast(): number {
  const raw = process.env.DOCUMENT_REVISION_RETAIN_LAST?.trim();
  if (raw === undefined || raw === "" || raw === "0") return 0;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 0;
  return Math.min(50_000, n);
}

function documentRevisionPruneMetricsEnabled(): boolean {
  return process.env.DOCUMENT_REVISION_PRUNE_METRICS === "1";
}

/**
 * After a new revision is written, drop older rows so at most `retainLast` remain (by revision_number desc).
 */
async function pruneDocumentRevisionsAfterAppend(
  tx: RevisionPruneTx,
  documentId: string,
  retainLast: number,
): Promise<void> {
  if (retainLast <= 0) return;
  const topN = await tx
    .select({ revisionNumber: documentRevisions.revisionNumber })
    .from(documentRevisions)
    .where(eq(documentRevisions.documentId, documentId))
    .orderBy(desc(documentRevisions.revisionNumber))
    .limit(retainLast);
  if (topN.length < retainLast) return;
  const cutoff = topN[topN.length - 1]!.revisionNumber;

  if (documentRevisionPruneMetricsEnabled()) {
    const [{ c }] = await tx
      .select({ c: sql<number>`count(*)::int` })
      .from(documentRevisions)
      .where(and(eq(documentRevisions.documentId, documentId), lt(documentRevisions.revisionNumber, cutoff)));
    if (c > 0) {
      console.log(
        JSON.stringify({ event: "document_revision_prune", documentId, deleted: c, cutoffRevision: cutoff }),
      );
    }
  }

  await tx
    .delete(documentRevisions)
    .where(and(eq(documentRevisions.documentId, documentId), lt(documentRevisions.revisionNumber, cutoff)));
}

export function extractLegacyPlanBody(description: string | null | undefined) {
  if (!description) return null;
  const match = /<plan>\s*([\s\S]*?)\s*<\/plan>/i.exec(description);
  if (!match) return null;
  const body = match[1]?.trim();
  return body ? body : null;
}

/** Trim and treat empty string as null so PATCH no-op matches stored titles. */
function normalizeStandaloneTitle(title: string | null | undefined): string | null {
  if (title == null) return null;
  const t = title.trim();
  return t.length === 0 ? null : t;
}

function mapStandaloneDocumentRow(
  row: {
    id: string;
    companyId: string;
    title: string | null;
    format: string;
    latestBody: string;
    latestRevisionId: string | null;
    latestRevisionNumber: number;
    createdByAgentId: string | null;
    createdByUserId: string | null;
    updatedByAgentId: string | null;
    updatedByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  includeBody: boolean,
) {
  return {
    id: row.id,
    companyId: row.companyId,
    title: row.title,
    format: row.format,
    ...(includeBody ? { body: row.latestBody } : {}),
    latestRevisionId: row.latestRevisionId ?? null,
    latestRevisionNumber: row.latestRevisionNumber,
    createdByAgentId: row.createdByAgentId,
    createdByUserId: row.createdByUserId,
    updatedByAgentId: row.updatedByAgentId,
    updatedByUserId: row.updatedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function fetchStandaloneCompanyDocument(db: Db, companyId: string, documentId: string) {
  const row = await db
    .select({
      id: documents.id,
      companyId: documents.companyId,
      title: documents.title,
      format: documents.format,
      latestBody: documents.latestBody,
      latestRevisionId: documents.latestRevisionId,
      latestRevisionNumber: documents.latestRevisionNumber,
      createdByAgentId: documents.createdByAgentId,
      createdByUserId: documents.createdByUserId,
      updatedByAgentId: documents.updatedByAgentId,
      updatedByUserId: documents.updatedByUserId,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .leftJoin(issueDocuments, eq(issueDocuments.documentId, documents.id))
    .where(and(eq(documents.id, documentId), eq(documents.companyId, companyId), isNull(issueDocuments.id)))
    .then((rows) => rows[0] ?? null);
  return row ? mapStandaloneDocumentRow(row, true) : null;
}

function mapIssueDocumentRow(
  row: {
    id: string;
    companyId: string;
    issueId: string;
    key: string;
    title: string | null;
    format: string;
    latestBody: string;
    latestRevisionId: string | null;
    latestRevisionNumber: number;
    createdByAgentId: string | null;
    createdByUserId: string | null;
    updatedByAgentId: string | null;
    updatedByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  includeBody: boolean,
) {
  return {
    id: row.id,
    companyId: row.companyId,
    issueId: row.issueId,
    key: row.key,
    title: row.title,
    format: row.format,
    ...(includeBody ? { body: row.latestBody } : {}),
    latestRevisionId: row.latestRevisionId ?? null,
    latestRevisionNumber: row.latestRevisionNumber,
    createdByAgentId: row.createdByAgentId,
    createdByUserId: row.createdByUserId,
    updatedByAgentId: row.updatedByAgentId,
    updatedByUserId: row.updatedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function documentService(db: Db) {
  return {
    getIssueDocumentPayload: async (issue: { id: string; description: string | null }) => {
      const [planDocument, documentSummaries] = await Promise.all([
        db
          .select({
            id: documents.id,
            companyId: documents.companyId,
            issueId: issueDocuments.issueId,
            key: issueDocuments.key,
            title: documents.title,
            format: documents.format,
            latestBody: documents.latestBody,
            latestRevisionId: documents.latestRevisionId,
            latestRevisionNumber: documents.latestRevisionNumber,
            createdByAgentId: documents.createdByAgentId,
            createdByUserId: documents.createdByUserId,
            updatedByAgentId: documents.updatedByAgentId,
            updatedByUserId: documents.updatedByUserId,
            createdAt: documents.createdAt,
            updatedAt: documents.updatedAt,
          })
          .from(issueDocuments)
          .innerJoin(documents, eq(issueDocuments.documentId, documents.id))
          .where(and(eq(issueDocuments.issueId, issue.id), eq(issueDocuments.key, "plan")))
          .then((rows) => rows[0] ?? null),
        db
          .select({
            id: documents.id,
            companyId: documents.companyId,
            issueId: issueDocuments.issueId,
            key: issueDocuments.key,
            title: documents.title,
            format: documents.format,
            latestBody: documents.latestBody,
            latestRevisionId: documents.latestRevisionId,
            latestRevisionNumber: documents.latestRevisionNumber,
            createdByAgentId: documents.createdByAgentId,
            createdByUserId: documents.createdByUserId,
            updatedByAgentId: documents.updatedByAgentId,
            updatedByUserId: documents.updatedByUserId,
            createdAt: documents.createdAt,
            updatedAt: documents.updatedAt,
          })
          .from(issueDocuments)
          .innerJoin(documents, eq(issueDocuments.documentId, documents.id))
          .where(eq(issueDocuments.issueId, issue.id))
          .orderBy(asc(issueDocuments.key), desc(documents.updatedAt)),
      ]);

      const legacyPlanBody = planDocument ? null : extractLegacyPlanBody(issue.description);

      return {
        planDocument: planDocument ? mapIssueDocumentRow(planDocument, true) : null,
        documentSummaries: documentSummaries.map((row) => mapIssueDocumentRow(row, false)),
        legacyPlanDocument: legacyPlanBody
          ? {
              key: "plan" as const,
              body: legacyPlanBody,
              source: "issue_description" as const,
            }
          : null,
      };
    },

    listIssueDocuments: async (issueId: string) => {
      const rows = await db
        .select({
          id: documents.id,
          companyId: documents.companyId,
          issueId: issueDocuments.issueId,
          key: issueDocuments.key,
          title: documents.title,
          format: documents.format,
          latestBody: documents.latestBody,
          latestRevisionId: documents.latestRevisionId,
          latestRevisionNumber: documents.latestRevisionNumber,
          createdByAgentId: documents.createdByAgentId,
          createdByUserId: documents.createdByUserId,
          updatedByAgentId: documents.updatedByAgentId,
          updatedByUserId: documents.updatedByUserId,
          createdAt: documents.createdAt,
          updatedAt: documents.updatedAt,
        })
        .from(issueDocuments)
        .innerJoin(documents, eq(issueDocuments.documentId, documents.id))
        .where(eq(issueDocuments.issueId, issueId))
        .orderBy(asc(issueDocuments.key), desc(documents.updatedAt));
      return rows.map((row) => mapIssueDocumentRow(row, true));
    },

    getIssueDocumentByKey: async (issueId: string, rawKey: string) => {
      const key = normalizeDocumentKey(rawKey);
      const row = await db
        .select({
          id: documents.id,
          companyId: documents.companyId,
          issueId: issueDocuments.issueId,
          key: issueDocuments.key,
          title: documents.title,
          format: documents.format,
          latestBody: documents.latestBody,
          latestRevisionId: documents.latestRevisionId,
          latestRevisionNumber: documents.latestRevisionNumber,
          createdByAgentId: documents.createdByAgentId,
          createdByUserId: documents.createdByUserId,
          updatedByAgentId: documents.updatedByAgentId,
          updatedByUserId: documents.updatedByUserId,
          createdAt: documents.createdAt,
          updatedAt: documents.updatedAt,
        })
        .from(issueDocuments)
        .innerJoin(documents, eq(issueDocuments.documentId, documents.id))
        .where(and(eq(issueDocuments.issueId, issueId), eq(issueDocuments.key, key)))
        .then((rows) => rows[0] ?? null);
      return row ? mapIssueDocumentRow(row, true) : null;
    },

    listIssueDocumentRevisions: async (issueId: string, rawKey: string) => {
      const key = normalizeDocumentKey(rawKey);
      return db
        .select({
          id: documentRevisions.id,
          companyId: documentRevisions.companyId,
          documentId: documentRevisions.documentId,
          issueId: issueDocuments.issueId,
          key: issueDocuments.key,
          revisionNumber: documentRevisions.revisionNumber,
          body: documentRevisions.body,
          changeSummary: documentRevisions.changeSummary,
          createdByAgentId: documentRevisions.createdByAgentId,
          createdByUserId: documentRevisions.createdByUserId,
          createdAt: documentRevisions.createdAt,
        })
        .from(issueDocuments)
        .innerJoin(documents, eq(issueDocuments.documentId, documents.id))
        .innerJoin(documentRevisions, eq(documentRevisions.documentId, documents.id))
        .where(and(eq(issueDocuments.issueId, issueId), eq(issueDocuments.key, key)))
        .orderBy(desc(documentRevisions.revisionNumber));
    },

    upsertIssueDocument: async (input: {
      issueId: string;
      key: string;
      title?: string | null;
      format: string;
      body: string;
      changeSummary?: string | null;
      baseRevisionId?: string | null;
      createdByAgentId?: string | null;
      createdByUserId?: string | null;
    }) => {
      const key = normalizeDocumentKey(input.key);
      const issue = await db
        .select({ id: issues.id, companyId: issues.companyId })
        .from(issues)
        .where(eq(issues.id, input.issueId))
        .then((rows) => rows[0] ?? null);
      if (!issue) throw notFound("Issue not found");

      try {
        return await db.transaction(async (tx) => {
          const now = new Date();
          const existing = await tx
            .select({
              id: documents.id,
              companyId: documents.companyId,
              issueId: issueDocuments.issueId,
              key: issueDocuments.key,
              title: documents.title,
              format: documents.format,
              latestBody: documents.latestBody,
              latestRevisionId: documents.latestRevisionId,
              latestRevisionNumber: documents.latestRevisionNumber,
              createdByAgentId: documents.createdByAgentId,
              createdByUserId: documents.createdByUserId,
              updatedByAgentId: documents.updatedByAgentId,
              updatedByUserId: documents.updatedByUserId,
              createdAt: documents.createdAt,
              updatedAt: documents.updatedAt,
            })
            .from(issueDocuments)
            .innerJoin(documents, eq(issueDocuments.documentId, documents.id))
            .where(and(eq(issueDocuments.issueId, issue.id), eq(issueDocuments.key, key)))
            .then((rows) => rows[0] ?? null);

          if (existing) {
            if (!input.baseRevisionId) {
              throw conflict("Document update requires baseRevisionId", {
                currentRevisionId: existing.latestRevisionId,
              });
            }
            if (input.baseRevisionId !== existing.latestRevisionId) {
              throw conflict("Document was updated by someone else", {
                currentRevisionId: existing.latestRevisionId,
              });
            }

            const nextRevisionNumber = existing.latestRevisionNumber + 1;
            const [revision] = await tx
              .insert(documentRevisions)
              .values({
                companyId: issue.companyId,
                documentId: existing.id,
                revisionNumber: nextRevisionNumber,
                body: input.body,
                changeSummary: input.changeSummary ?? null,
                createdByAgentId: input.createdByAgentId ?? null,
                createdByUserId: input.createdByUserId ?? null,
                createdAt: now,
              })
              .returning();

            await tx
              .update(documents)
              .set({
                title: input.title ?? null,
                format: input.format,
                latestBody: input.body,
                latestRevisionId: revision.id,
                latestRevisionNumber: nextRevisionNumber,
                updatedByAgentId: input.createdByAgentId ?? null,
                updatedByUserId: input.createdByUserId ?? null,
                updatedAt: now,
              })
              .where(eq(documents.id, existing.id));

            await tx
              .update(issueDocuments)
              .set({ updatedAt: now })
              .where(eq(issueDocuments.documentId, existing.id));

            await pruneDocumentRevisionsAfterAppend(tx, existing.id, documentRevisionRetainLast());

            return {
              created: false as const,
              document: {
                ...existing,
                title: input.title ?? null,
                format: input.format,
                body: input.body,
                latestRevisionId: revision.id,
                latestRevisionNumber: nextRevisionNumber,
                updatedByAgentId: input.createdByAgentId ?? null,
                updatedByUserId: input.createdByUserId ?? null,
                updatedAt: now,
              },
            };
          }

          if (input.baseRevisionId) {
            throw conflict("Document does not exist yet", { key });
          }

          const [document] = await tx
            .insert(documents)
            .values({
              companyId: issue.companyId,
              title: input.title ?? null,
              format: input.format,
              latestBody: input.body,
              latestRevisionId: null,
              latestRevisionNumber: 1,
              createdByAgentId: input.createdByAgentId ?? null,
              createdByUserId: input.createdByUserId ?? null,
              updatedByAgentId: input.createdByAgentId ?? null,
              updatedByUserId: input.createdByUserId ?? null,
              createdAt: now,
              updatedAt: now,
            })
            .returning();

          const [revision] = await tx
            .insert(documentRevisions)
            .values({
              companyId: issue.companyId,
              documentId: document.id,
              revisionNumber: 1,
              body: input.body,
              changeSummary: input.changeSummary ?? null,
              createdByAgentId: input.createdByAgentId ?? null,
              createdByUserId: input.createdByUserId ?? null,
              createdAt: now,
            })
            .returning();

          await tx
            .update(documents)
            .set({ latestRevisionId: revision.id })
            .where(eq(documents.id, document.id));

          await tx.insert(issueDocuments).values({
            companyId: issue.companyId,
            issueId: issue.id,
            documentId: document.id,
            key,
            createdAt: now,
            updatedAt: now,
          });

          return {
            created: true as const,
            document: {
              id: document.id,
              companyId: issue.companyId,
              issueId: issue.id,
              key,
              title: document.title,
              format: document.format,
              body: document.latestBody,
              latestRevisionId: revision.id,
              latestRevisionNumber: 1,
              createdByAgentId: document.createdByAgentId,
              createdByUserId: document.createdByUserId,
              updatedByAgentId: document.updatedByAgentId,
              updatedByUserId: document.updatedByUserId,
              createdAt: document.createdAt,
              updatedAt: document.updatedAt,
            },
          };
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw conflict("Document key already exists on this issue", { key });
        }
        throw error;
      }
    },

    deleteIssueDocument: async (issueId: string, rawKey: string) => {
      const key = normalizeDocumentKey(rawKey);
      return db.transaction(async (tx) => {
        const existing = await tx
          .select({
            id: documents.id,
            companyId: documents.companyId,
            issueId: issueDocuments.issueId,
            key: issueDocuments.key,
            title: documents.title,
            format: documents.format,
            latestBody: documents.latestBody,
            latestRevisionId: documents.latestRevisionId,
            latestRevisionNumber: documents.latestRevisionNumber,
            createdByAgentId: documents.createdByAgentId,
            createdByUserId: documents.createdByUserId,
            updatedByAgentId: documents.updatedByAgentId,
            updatedByUserId: documents.updatedByUserId,
            createdAt: documents.createdAt,
            updatedAt: documents.updatedAt,
          })
          .from(issueDocuments)
          .innerJoin(documents, eq(issueDocuments.documentId, documents.id))
          .where(and(eq(issueDocuments.issueId, issueId), eq(issueDocuments.key, key)))
          .then((rows) => rows[0] ?? null);

        if (!existing) return null;

        await tx.delete(issueDocuments).where(eq(issueDocuments.documentId, existing.id));
        await tx.delete(documents).where(eq(documents.id, existing.id));

        return {
          ...existing,
          body: existing.latestBody,
          latestRevisionId: existing.latestRevisionId ?? null,
        };
      });
    },

    /** Company notes not linked to any issue (`issue_documents`). */
    listStandaloneCompanyDocuments: async (companyId: string) => {
      const rows = await db
        .select({
          id: documents.id,
          companyId: documents.companyId,
          title: documents.title,
          format: documents.format,
          latestBody: documents.latestBody,
          latestRevisionId: documents.latestRevisionId,
          latestRevisionNumber: documents.latestRevisionNumber,
          createdByAgentId: documents.createdByAgentId,
          createdByUserId: documents.createdByUserId,
          updatedByAgentId: documents.updatedByAgentId,
          updatedByUserId: documents.updatedByUserId,
          createdAt: documents.createdAt,
          updatedAt: documents.updatedAt,
        })
        .from(documents)
        .leftJoin(issueDocuments, eq(issueDocuments.documentId, documents.id))
        .where(and(eq(documents.companyId, companyId), isNull(issueDocuments.id)))
        .orderBy(desc(documents.updatedAt));
      return rows.map((row) => mapStandaloneDocumentRow(row, true));
    },

    getStandaloneCompanyDocument: (companyId: string, documentId: string) =>
      fetchStandaloneCompanyDocument(db, companyId, documentId),

    createCompanyDocument: async (input: {
      companyId: string;
      title?: string | null;
      format: string;
      body: string;
      createdByAgentId?: string | null;
      createdByUserId?: string | null;
    }) => {
      return db.transaction(async (tx) => {
        const now = new Date();
        const [document] = await tx
          .insert(documents)
          .values({
            companyId: input.companyId,
            title: input.title ?? null,
            format: input.format,
            latestBody: input.body,
            latestRevisionId: null,
            latestRevisionNumber: 1,
            createdByAgentId: input.createdByAgentId ?? null,
            createdByUserId: input.createdByUserId ?? null,
            updatedByAgentId: input.createdByAgentId ?? null,
            updatedByUserId: input.createdByUserId ?? null,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        const [revision] = await tx
          .insert(documentRevisions)
          .values({
            companyId: input.companyId,
            documentId: document.id,
            revisionNumber: 1,
            body: input.body,
            changeSummary: null,
            createdByAgentId: input.createdByAgentId ?? null,
            createdByUserId: input.createdByUserId ?? null,
            createdAt: now,
          })
          .returning();

        await tx
          .update(documents)
          .set({ latestRevisionId: revision.id })
          .where(eq(documents.id, document.id));

        await replaceDocumentLinksForSource(tx, {
          companyId: input.companyId,
          sourceDocumentId: document.id,
          body: input.body,
        });

        return mapStandaloneDocumentRow(
          {
            id: document.id,
            companyId: document.companyId,
            title: document.title,
            format: document.format,
            latestBody: document.latestBody,
            latestRevisionId: revision.id,
            latestRevisionNumber: 1,
            createdByAgentId: document.createdByAgentId,
            createdByUserId: document.createdByUserId,
            updatedByAgentId: document.updatedByAgentId,
            updatedByUserId: document.updatedByUserId,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
          },
          true,
        );
      });
    },

    updateCompanyDocument: async (input: {
      companyId: string;
      documentId: string;
      title?: string | null;
      format: string;
      body: string;
      changeSummary?: string | null;
      baseRevisionId?: string | null;
      createdByAgentId?: string | null;
      createdByUserId?: string | null;
    }) => {
      return db.transaction(async (tx) => {
        const now = new Date();
        const existing = await tx
          .select({
            id: documents.id,
            companyId: documents.companyId,
            title: documents.title,
            format: documents.format,
            latestBody: documents.latestBody,
            latestRevisionId: documents.latestRevisionId,
            latestRevisionNumber: documents.latestRevisionNumber,
            createdByAgentId: documents.createdByAgentId,
            createdByUserId: documents.createdByUserId,
            updatedByAgentId: documents.updatedByAgentId,
            updatedByUserId: documents.updatedByUserId,
            createdAt: documents.createdAt,
            updatedAt: documents.updatedAt,
          })
          .from(documents)
          .leftJoin(issueDocuments, eq(issueDocuments.documentId, documents.id))
          .where(
            and(
              eq(documents.id, input.documentId),
              eq(documents.companyId, input.companyId),
              isNull(issueDocuments.id),
            ),
          )
          .then((rows) => rows[0] ?? null);

        if (!existing) {
          throw notFound("Document not found");
        }

        if (!input.baseRevisionId) {
          throw conflict("Document update requires baseRevisionId", {
            currentRevisionId: existing.latestRevisionId,
          });
        }
        if (input.baseRevisionId !== existing.latestRevisionId) {
          throw conflict("Document was updated by someone else", {
            currentRevisionId: existing.latestRevisionId,
          });
        }

        const nextFormat = input.format ?? "markdown";
        const titlesMatch =
          normalizeStandaloneTitle(input.title ?? null) === normalizeStandaloneTitle(existing.title);
        const bodyUnchanged = input.body === existing.latestBody;
        const formatUnchanged = nextFormat === existing.format;

        if (titlesMatch && bodyUnchanged && formatUnchanged) {
          return [
            mapStandaloneDocumentRow(
              {
                id: existing.id,
                companyId: existing.companyId,
                title: existing.title,
                format: existing.format,
                latestBody: existing.latestBody,
                latestRevisionId: existing.latestRevisionId,
                latestRevisionNumber: existing.latestRevisionNumber,
                createdByAgentId: existing.createdByAgentId,
                createdByUserId: existing.createdByUserId,
                updatedByAgentId: existing.updatedByAgentId,
                updatedByUserId: existing.updatedByUserId,
                createdAt: existing.createdAt,
                updatedAt: existing.updatedAt,
              },
              true,
            ),
            false,
          ] as const;
        }

        const nextRevisionNumber = existing.latestRevisionNumber + 1;
        const [revision] = await tx
          .insert(documentRevisions)
          .values({
            companyId: input.companyId,
            documentId: existing.id,
            revisionNumber: nextRevisionNumber,
            body: input.body,
            changeSummary: input.changeSummary ?? null,
            createdByAgentId: input.createdByAgentId ?? null,
            createdByUserId: input.createdByUserId ?? null,
            createdAt: now,
          })
          .returning();

        await tx
          .update(documents)
          .set({
            title: input.title ?? null,
            format: nextFormat,
            latestBody: input.body,
            latestRevisionId: revision.id,
            latestRevisionNumber: nextRevisionNumber,
            updatedByAgentId: input.createdByAgentId ?? null,
            updatedByUserId: input.createdByUserId ?? null,
            updatedAt: now,
          })
          .where(eq(documents.id, existing.id));

        await replaceDocumentLinksForSource(tx, {
          companyId: input.companyId,
          sourceDocumentId: existing.id,
          body: input.body,
        });

        await pruneDocumentRevisionsAfterAppend(tx, existing.id, documentRevisionRetainLast());

        return [
          mapStandaloneDocumentRow(
            {
              id: existing.id,
              companyId: existing.companyId,
              title: input.title ?? null,
              format: nextFormat,
              latestBody: input.body,
              latestRevisionId: revision.id,
              latestRevisionNumber: nextRevisionNumber,
              createdByAgentId: existing.createdByAgentId,
              createdByUserId: existing.createdByUserId,
              updatedByAgentId: input.createdByAgentId ?? null,
              updatedByUserId: input.createdByUserId ?? null,
              createdAt: existing.createdAt,
              updatedAt: now,
            },
            true,
          ),
          true,
        ] as const;
      });
    },

    deleteStandaloneCompanyDocument: async (companyId: string, documentId: string) => {
      return db.transaction(async (tx) => {
        const existing = await tx
          .select({ id: documents.id })
          .from(documents)
          .leftJoin(issueDocuments, eq(issueDocuments.documentId, documents.id))
          .where(and(eq(documents.id, documentId), eq(documents.companyId, companyId), isNull(issueDocuments.id)))
          .then((rows) => rows[0] ?? null);
        if (!existing) return null;
        await tx.delete(documents).where(eq(documents.id, existing.id));
        return { ok: true as const };
      });
    },

    listStandaloneCompanyDocumentRevisions: async (companyId: string, documentId: string) => {
      const doc = await db
        .select({ id: documents.id })
        .from(documents)
        .leftJoin(issueDocuments, eq(issueDocuments.documentId, documents.id))
        .where(and(eq(documents.id, documentId), eq(documents.companyId, companyId), isNull(issueDocuments.id)))
        .then((rows) => rows[0] ?? null);
      if (!doc) return null;
      return db
        .select({
          id: documentRevisions.id,
          companyId: documentRevisions.companyId,
          documentId: documentRevisions.documentId,
          revisionNumber: documentRevisions.revisionNumber,
          body: documentRevisions.body,
          changeSummary: documentRevisions.changeSummary,
          createdByAgentId: documentRevisions.createdByAgentId,
          createdByUserId: documentRevisions.createdByUserId,
          createdAt: documentRevisions.createdAt,
        })
        .from(documentRevisions)
        .where(eq(documentRevisions.documentId, documentId))
        .orderBy(desc(documentRevisions.revisionNumber));
    },

    attachStandaloneDocumentToIssue: async (input: {
      companyId: string;
      documentId: string;
      issueId: string;
      key: string;
    }) => {
      const key = normalizeDocumentKey(input.key);
      return db.transaction(async (tx) => {
        const standalone = await tx
          .select({ id: documents.id })
          .from(documents)
          .leftJoin(issueDocuments, eq(issueDocuments.documentId, documents.id))
          .where(
            and(
              eq(documents.id, input.documentId),
              eq(documents.companyId, input.companyId),
              isNull(issueDocuments.id),
            ),
          )
          .then((rows) => rows[0] ?? null);
        if (!standalone) {
          throw notFound("Standalone document not found");
        }

        const issue = await tx
          .select({ id: issues.id, companyId: issues.companyId })
          .from(issues)
          .where(eq(issues.id, input.issueId))
          .then((rows) => rows[0] ?? null);
        if (!issue || issue.companyId !== input.companyId) {
          throw notFound("Issue not found");
        }

        try {
          await tx.insert(issueDocuments).values({
            companyId: input.companyId,
            issueId: issue.id,
            documentId: standalone.id,
            key,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw conflict("Document key already exists on this issue", { key });
          }
          throw error;
        }

        return { ok: true as const, issueId: issue.id, key };
      });
    },

    listStandaloneDocumentLinks: async (
      companyId: string,
      documentId: string,
      direction: "out" | "in" | "both",
    ) => {
      const ok = await assertStandaloneCompanyDocument(db, companyId, documentId);
      if (!ok) return null;
      const out =
        direction === "in"
          ? []
          : await listOutgoingDocumentLinks(db, companyId, documentId);
      const inn =
        direction === "out"
          ? []
          : await listIncomingDocumentLinks(db, companyId, documentId);
      return { out, in: inn };
    },

    getStandaloneDocumentNeighborhood: async (
      companyId: string,
      documentId: string,
      options?: { maxIds?: number },
    ) => {
      const ok = await assertStandaloneCompanyDocument(db, companyId, documentId);
      if (!ok) return null;
      const documentIds = await getDocumentNeighborhoodIds(
        db,
        companyId,
        documentId,
        options?.maxIds ?? 50,
      );
      return { documentIds };
    },

    /**
     * Doc-scoped RAG / agent context: center note plus 1-hop linked standalone docs, with roles for provenance.
     * Mem0/Vault layers can prepend or merge this bundle when those engines exist.
     */
    getStandaloneDocumentContextPack: async (
      companyId: string,
      documentId: string,
      options?: { maxDocuments?: number; maxBodyCharsPerDocument?: number },
    ) => {
      const maxDocs = Math.min(100, Math.max(1, options?.maxDocuments ?? 25));
      const maxChars = Math.min(200_000, Math.max(500, options?.maxBodyCharsPerDocument ?? 16_000));

      const center = await fetchStandaloneCompanyDocument(db, companyId, documentId);
      if (!center) return null;

      const out = await listOutgoingDocumentLinks(db, companyId, documentId);
      const inn = await listIncomingDocumentLinks(db, companyId, documentId);

      const outTargetIds = [
        ...new Set(out.map((r) => r.targetDocumentId).filter((id): id is string => id != null)),
      ].filter((id) => id !== documentId);
      const inSourceIds = [...new Set(inn.map((r) => r.sourceDocumentId))].filter(
        (id) => id !== documentId,
      );

      const roleById = new Map<string, "outgoing_link" | "incoming_link">();
      for (const id of inSourceIds) {
        roleById.set(id, "incoming_link");
      }
      for (const id of outTargetIds) {
        roleById.set(id, "outgoing_link");
      }

      const orderedNeighborIds: string[] = [];
      const seen = new Set<string>();
      for (const id of [...outTargetIds, ...inSourceIds]) {
        if (seen.has(id)) continue;
        seen.add(id);
        orderedNeighborIds.push(id);
        if (orderedNeighborIds.length >= maxDocs - 1) break;
      }

      const truncate = (body: string): { text: string; truncated: boolean } => {
        if (body.length <= maxChars) return { text: body, truncated: false };
        return { text: `${body.slice(0, maxChars)}\n\n[…truncated]`, truncated: true };
      };

      const items: Array<{
        documentId: string;
        title: string | null;
        format: string;
        body: string;
        bodyTruncated: boolean;
        role: "center" | "outgoing_link" | "incoming_link";
      }> = [];

      const cBody = truncate(center.body ?? "");
      items.push({
        documentId: center.id,
        title: center.title,
        format: center.format,
        body: cBody.text,
        bodyTruncated: cBody.truncated,
        role: "center",
      });

      for (const nid of orderedNeighborIds) {
        if (items.length >= maxDocs) break;
        const doc = await fetchStandaloneCompanyDocument(db, companyId, nid);
        if (!doc) continue;
        const t = truncate(doc.body ?? "");
        items.push({
          documentId: doc.id,
          title: doc.title,
          format: doc.format,
          body: t.text,
          bodyTruncated: t.truncated,
          role: roleById.get(nid) ?? "incoming_link",
        });
      }

      return {
        companyId,
        centerDocumentId: documentId,
        generatedAt: new Date().toISOString(),
        items,
      };
    },
  };
}
