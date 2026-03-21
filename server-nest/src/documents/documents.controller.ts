import {
  Controller,
  Delete,
  Get,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import type { Actor } from "../auth/actor.guard.js";
import { assertCompanyAccess, getActorInfo } from "../auth/authz.js";
import type { Db } from "@paperclipai/db";
import { documentService } from "@paperclipai/server/services/documents";
import { logActivity } from "@paperclipai/server/services/activity-log";
import { DB } from "../db/db.module.js";
import { CompanyDocumentPatchThrottleGuard } from "./company-document-patch-throttle.guard.js";

const documentPatchMetricsEnabled = () => process.env.DOCUMENT_PATCH_METRICS === "1";

@Controller()
export class DocumentsController {
  private readonly svc;
  private readonly log = new Logger(DocumentsController.name);

  constructor(@Inject(DB) private readonly db: Db) {
    this.svc = documentService(db);
  }

  @Get("companies/:companyId/documents")
  async listCompanyDocuments(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
  ) {
    assertCompanyAccess(req, companyId);
    return this.svc.listStandaloneCompanyDocuments(companyId);
  }

  @Get("companies/:companyId/documents/:documentId")
  async getCompanyDocument(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("documentId") documentId: string,
  ) {
    assertCompanyAccess(req, companyId);
    const doc = await this.svc.getStandaloneCompanyDocument(companyId, documentId);
    if (!doc) {
      return (req as Request & { _res?: Response })._res?.status(404).json({ error: "Document not found" });
    }
    return doc;
  }

  @Get("companies/:companyId/documents/:documentId/links")
  async getCompanyDocumentLinks(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("documentId") documentId: string,
    @Query("direction") directionQuery?: string,
  ) {
    assertCompanyAccess(req, companyId);
    const direction =
      directionQuery === "out" || directionQuery === "in" ? directionQuery : "both";
    const data = await this.svc.listStandaloneDocumentLinks(companyId, documentId, direction);
    if (!data) {
      throw new NotFoundException("Document not found");
    }
    return data;
  }

  @Get("companies/:companyId/documents/:documentId/neighborhood")
  async getCompanyDocumentNeighborhood(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("documentId") documentId: string,
    @Query("max") maxQuery?: string,
  ) {
    assertCompanyAccess(req, companyId);
    const parsed = maxQuery !== undefined ? Number.parseInt(maxQuery, 10) : NaN;
    const maxIds = Number.isFinite(parsed) ? Math.min(100, Math.max(1, parsed)) : 50;
    const data = await this.svc.getStandaloneDocumentNeighborhood(companyId, documentId, {
      maxIds,
    });
    if (!data) {
      throw new NotFoundException("Document not found");
    }
    return data;
  }

  @Get("companies/:companyId/documents/:documentId/context-pack")
  async getCompanyDocumentContextPack(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("documentId") documentId: string,
    @Query("maxDocuments") maxDocumentsQuery?: string,
    @Query("maxBodyCharsPerDocument") maxBodyCharsQuery?: string,
  ) {
    assertCompanyAccess(req, companyId);
    const parsedDocs =
      maxDocumentsQuery !== undefined ? Number.parseInt(maxDocumentsQuery, 10) : NaN;
    const parsedChars =
      maxBodyCharsQuery !== undefined ? Number.parseInt(maxBodyCharsQuery, 10) : NaN;
    const data = await this.svc.getStandaloneDocumentContextPack(companyId, documentId, {
      maxDocuments: Number.isFinite(parsedDocs) ? parsedDocs : undefined,
      maxBodyCharsPerDocument: Number.isFinite(parsedChars) ? parsedChars : undefined,
    });
    if (!data) {
      throw new NotFoundException("Document not found");
    }
    return data;
  }

  @Post("companies/:companyId/documents")
  async createCompanyDocument(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Res() res: Response,
  ) {
    assertCompanyAccess(req, companyId);
    const actor = getActorInfo(req);
    const body = req.body as {
      title?: string | null;
      format?: string;
      body: string;
    };

    const document = await this.svc.createCompanyDocument({
      companyId,
      title: body.title ?? null,
      format: body.format ?? "markdown",
      body: body.body ?? "",
      createdByAgentId: actor.agentId ?? null,
      createdByUserId: actor.actorType === "user" ? actor.actorId : null,
    });

    await logActivity(this.db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "document.created",
      entityType: "document",
      entityId: document.id,
      details: { title: document.title },
    });

    return res.status(201).json(document);
  }

  @Patch("companies/:companyId/documents/:documentId")
  @UseGuards(CompanyDocumentPatchThrottleGuard)
  async updateCompanyDocument(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("documentId") documentId: string,
    @Res() res: Response,
  ) {
    assertCompanyAccess(req, companyId);
    const actor = getActorInfo(req);
    const body = req.body as {
      title?: string | null;
      format?: string;
      body: string;
      changeSummary?: string | null;
      baseRevisionId?: string | null;
    };

    try {
      const [document, persisted] = await this.svc.updateCompanyDocument({
        companyId,
        documentId,
        title: body.title ?? null,
        format: body.format ?? "markdown",
        body: body.body ?? "",
        changeSummary: body.changeSummary ?? null,
        baseRevisionId: body.baseRevisionId ?? null,
        createdByAgentId: actor.agentId ?? null,
        createdByUserId: actor.actorType === "user" ? actor.actorId : null,
      });

      if (persisted) {
        await logActivity(this.db, {
          companyId,
          actorType: actor.actorType,
          actorId: actor.actorId,
          agentId: actor.agentId,
          runId: actor.runId,
          action: "document.updated",
          entityType: "document",
          entityId: document.id,
          details: { title: document.title },
        });
      }

      if (documentPatchMetricsEnabled()) {
        const bodyStr = body.body ?? "";
        this.log.log(
          `document.patch companyId=${companyId} documentId=${documentId} persisted=${persisted} bodyBytes=${bodyStr.length}`,
        );
      }

      return res.json(document);
    } catch (error) {
      if (error instanceof Error && error.message === "Document not found") {
        return res.status(404).json({ error: "Document not found" });
      }
      if (error instanceof Error && error.message.includes("baseRevisionId")) {
        return res.status(409).json({ error: error.message });
      }
      throw error;
    }
  }

  @Delete("companies/:companyId/documents/:documentId")
  async deleteCompanyDocument(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("documentId") documentId: string,
    @Res() res: Response,
  ) {
    assertCompanyAccess(req, companyId);
    const actor = getActorInfo(req);

    const result = await this.svc.deleteStandaloneCompanyDocument(companyId, documentId);
    if (!result) {
      return res.status(404).json({ error: "Document not found" });
    }

    await logActivity(this.db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "document.deleted",
      entityType: "document",
      entityId: documentId,
      details: {},
    });

    return res.json(result);
  }

  @Get("companies/:companyId/documents/:documentId/revisions")
  async listDocumentRevisions(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("documentId") documentId: string,
    @Res() res: Response,
  ) {
    assertCompanyAccess(req, companyId);
    const revisions = await this.svc.listStandaloneCompanyDocumentRevisions(companyId, documentId);
    if (!revisions) {
      return res.status(404).json({ error: "Document not found" });
    }
    return revisions;
  }

  // Issue document endpoints (for MVP, link notes to issues)

  @Get("issues/:issueId/documents")
  async listIssueDocuments(
    @Req() req: Request & { actor?: Actor },
    @Param("issueId") issueId: string,
  ) {
    const docs = await this.svc.listIssueDocuments(issueId);
    return docs;
  }

  @Get("issues/:issueId/documents/:key")
  async getIssueDocument(
    @Req() req: Request & { actor?: Actor },
    @Param("issueId") issueId: string,
    @Param("key") key: string,
    @Res() res: Response,
  ) {
    const doc = await this.svc.getIssueDocumentByKey(issueId, key);
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }
    return doc;
  }

  @Put("issues/:issueId/documents/:key")
  async upsertIssueDocument(
    @Req() req: Request & { actor?: Actor },
    @Param("issueId") issueId: string,
    @Param("key") key: string,
    @Res() res: Response,
  ) {
    const actor = getActorInfo(req);
    const body = req.body as {
      title?: string | null;
      format?: string;
      body: string;
      changeSummary?: string | null;
      baseRevisionId?: string | null;
    };

    try {
      const result = await this.svc.upsertIssueDocument({
        issueId,
        key,
        title: body.title ?? null,
        format: body.format ?? "markdown",
        body: body.body ?? "",
        changeSummary: body.changeSummary ?? null,
        baseRevisionId: body.baseRevisionId ?? null,
        createdByAgentId: actor.agentId ?? null,
        createdByUserId: actor.actorType === "user" ? actor.actorId : null,
      });

      await logActivity(this.db, {
        companyId: "",
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: result.created ? "document.created" : "document.updated",
        entityType: "document",
        entityId: result.document.id,
        details: { issueId, key },
      });

      return res.status(result.created ? 201 : 200).json(result.document);
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      if (error instanceof Error && (error.message.includes("baseRevisionId") || error.message.includes("updated by someone else"))) {
        return res.status(409).json({ error: error.message });
      }
      throw error;
    }
  }

  @Get("issues/:issueId/documents/:key/revisions")
  async listIssueDocumentRevisions(
    @Req() req: Request & { actor?: Actor },
    @Param("issueId") issueId: string,
    @Param("key") key: string,
  ) {
    const revisions = await this.svc.listIssueDocumentRevisions(issueId, key);
    return revisions;
  }

  @Delete("issues/:issueId/documents/:key")
  async deleteIssueDocument(
    @Req() req: Request & { actor?: Actor },
    @Param("issueId") issueId: string,
    @Param("key") key: string,
    @Res() res: Response,
  ) {
    const actor = getActorInfo(req);
    const result = await this.svc.deleteIssueDocument(issueId, key);
    if (!result) {
      return res.status(404).json({ error: "Document not found" });
    }

    await logActivity(this.db, {
      companyId: "",
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "document.deleted",
      entityType: "document",
      entityId: result.id,
      details: { issueId, key },
    });

    return res.json(result);
  }

  // Attach standalone document to issue
  @Post("companies/:companyId/documents/:documentId/link-issue")
  async attachDocumentToIssue(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("documentId") documentId: string,
    @Res() res: Response,
  ) {
    assertCompanyAccess(req, companyId);
    const actor = getActorInfo(req);
    const body = req.body as {
      issueId: string;
      key: string;
    };

    try {
      const result = await this.svc.attachStandaloneDocumentToIssue({
        companyId,
        documentId,
        issueId: body.issueId,
        key: body.key,
      });

      await logActivity(this.db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "document.attached",
        entityType: "document",
        entityId: documentId,
        details: { issueId: body.issueId, key: body.key },
      });

      return res.json(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      if (error instanceof Error && error.message.includes("already exists")) {
        return res.status(409).json({ error: error.message });
      }
      throw error;
    }
  }
}
