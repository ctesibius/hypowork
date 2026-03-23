import {
  Controller,
  Get,
  Inject,
  BadRequestException,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import type { Actor } from "../auth/actor.guard.js";
import { assertCompanyAccess, getActorInfo } from "../auth/authz.js";
import { DB } from "../db/db.module.js";
import type { Db } from "@paperclipai/db";
import { canvasElements, canvasViewports } from "@paperclipai/db";
import { and, eq, inArray } from "drizzle-orm";
import { documentService } from "@paperclipai/server/services/documents";
import { getDocumentModeMigrationWarnings } from "./document-mode.service.js";

@Controller()
export class DocumentModeController {
  private readonly log = new Logger(DocumentModeController.name);

  constructor(@Inject(DB) private readonly db: Db) {
    this.svc = documentService(db);
  }

  private readonly svc;

  /**
   * Switch a document between prose and canvas views.
   * Persists `kind` and may normalize `latestBody` (e.g. prose → sticky note graph, canvas → extracted markdown).
   */
  @Post("companies/:companyId/documents/:documentId/switch")
  async switchDocumentMode(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("documentId") documentId: string,
  ) {
    assertCompanyAccess(req, companyId);
    const actor = getActorInfo(req);
    const body = req.body as { targetMode?: string };

    const targetMode = body.targetMode;
    if (targetMode !== "prose" && targetMode !== "canvas") {
      throw new BadRequestException("targetMode must be 'prose' or 'canvas'");
    }

    const existing = await this.svc.getStandaloneCompanyDocument(companyId, documentId);
    if (!existing) {
      throw new NotFoundException("Document not found");
    }

    await this.svc.updateDocumentKind(companyId, documentId, targetMode);

    const warnings = getDocumentModeMigrationWarnings();

    this.log.log(
      `View switch document ${documentId} → ${targetMode} by ${actor.actorType}:${actor.actorId}`,
    );

    return {
      documentId,
      mode: targetMode,
      migrated: false,
      migrationWarnings: warnings,
    };
  }

  /**
   * Get canvas elements for a document (private canvas items).
   */
  @Get("companies/:companyId/documents/:documentId/canvas-elements")
  async getCanvasElements(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("documentId") documentId: string,
  ) {
    assertCompanyAccess(req, companyId);

    const elements = await this.db.query.canvasElements.findMany({
      where: (ce, { and, eq }) =>
        and(eq(ce.documentId, documentId), eq(ce.companyId, companyId)),
      orderBy: (ce, { asc }) => [asc(ce.zIndex)],
    });

    return { elements };
  }

  /**
   * Get canvas viewport for a document.
   */
  @Get("companies/:companyId/documents/:documentId/canvas-viewport")
  async getCanvasViewport(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("documentId") documentId: string,
  ) {
    assertCompanyAccess(req, companyId);

    const viewport = await this.db.query.canvasViewports.findFirst({
      where: (cv, { and, eq, isNull }) =>
        and(
          eq(cv.documentId, documentId),
          eq(cv.companyId, companyId),
          isNull(cv.userId),
        ),
    });

    return (
      viewport ?? { documentId, companyId, panX: 0, panY: 0, zoom: 100, userId: null, updatedAt: new Date().toISOString() }
    );
  }

  /**
   * Make Standalone: extract selected canvas elements → new document.
   */
  @Post("companies/:companyId/documents/:documentId/make-standalone")
  async makeStandalone(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("documentId") documentId: string,
    @Res() res: Response,
  ) {
    assertCompanyAccess(req, companyId);
    const actor = getActorInfo(req);
    const body = req.body as { elementIds: string[]; title?: string };

    if (!body.elementIds?.length) {
      return res.status(400).json({ error: "elementIds required" });
    }

    const elements = await this.db.query.canvasElements.findMany({
      where: (ce, { and, eq, inArray }) =>
        and(eq(ce.documentId, documentId), eq(ce.companyId, companyId), inArray(ce.id, body.elementIds)),
    });

    if (!elements.length) {
      throw new NotFoundException("No matching canvas elements found");
    }

    const extractedParts = elements
      .filter((e) => e.type === "text" || e.type === "note")
      .map((e) => {
        const p = e.payload as { content?: string } | null | undefined;
        return typeof p?.content === "string" ? p.content : "";
      })
      .filter(Boolean);

    const newTitle = body.title ?? "Extracted from canvas";

    const newDoc = await this.svc.createCompanyDocument({
      companyId,
      title: newTitle,
      format: "markdown",
      body: extractedParts.join("\n\n"),
      kind: "prose",
      createdByAgentId: actor.agentId ?? null,
      createdByUserId: actor.actorType === "user" ? actor.actorId : null,
    });

    await this.db
      .update(canvasElements)
      .set({ sourceDocumentId: newDoc.id, updatedAt: new Date() })
      .where(inArray(canvasElements.id, body.elementIds));

    this.log.log(`Make standalone: created document ${newDoc.id} from ${elements.length} elements`);

    return res.status(201).json({
      newDocumentId: newDoc.id,
      newDocumentTitle: newDoc.title ?? newTitle,
      elementsMoved: elements.length,
    });
  }

  /**
   * Save canvas viewport for a document.
   */
  @Patch("companies/:companyId/documents/:documentId/canvas-viewport")
  async saveCanvasViewport(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("documentId") documentId: string,
    @Res() res: Response,
  ) {
    assertCompanyAccess(req, companyId);
    const body = req.body as { panX?: number; panY?: number; zoom?: number };

    const existing = await this.db.query.canvasViewports.findFirst({
      where: (cv, { and, eq, isNull }) =>
        and(eq(cv.documentId, documentId), eq(cv.companyId, companyId), isNull(cv.userId)),
    });

    if (existing) {
      await this.db
        .update(canvasViewports)
        .set({ panX: body.panX ?? 0, panY: body.panY ?? 0, zoom: body.zoom ?? 100, updatedAt: new Date() })
        .where(eq(canvasViewports.id, existing.id));
    } else {
      await this.db.insert(canvasViewports).values({
        companyId,
        documentId,
        panX: body.panX ?? 0,
        panY: body.panY ?? 0,
        zoom: body.zoom ?? 100,
        userId: null,
      });
    }

    return res.json({ ok: true });
  }

  /**
   * Add a canvas element to a document.
   * Agents can call this to create nodes on a canvas document.
   */
  @Post("companies/:companyId/documents/:documentId/canvas-elements")
  async addCanvasElement(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("documentId") documentId: string,
    @Res() res: Response,
  ) {
    assertCompanyAccess(req, companyId);
    const actor = getActorInfo(req);
    const body = req.body as {
      type: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      zIndex?: number;
      payload?: Record<string, unknown>;
      isPrivate?: boolean;
    };

    const element = await this.db.insert(canvasElements).values({
      companyId,
      documentId,
      type: body.type ?? "text",
      x: body.x ?? 0,
      y: body.y ?? 0,
      width: body.width ?? null,
      height: body.height ?? null,
      zIndex: body.zIndex ?? 0,
      rotation: 0,
      payload: body.payload ?? {},
      isPrivate: body.isPrivate ?? true,
      selected: false,
      createdByAgentId: actor.agentId ?? null,
    }).returning();

    return res.status(201).json(element[0]);
  }

  /**
   * Update a canvas element (move, resize, change properties).
   */
  @Patch("companies/:companyId/documents/:documentId/canvas-elements/:elementId")
  async updateCanvasElement(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("documentId") documentId: string,
    @Param("elementId") elementId: string,
    @Res() res: Response,
  ) {
    assertCompanyAccess(req, companyId);
    const body = req.body as {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      zIndex?: number;
      rotation?: number;
      payload?: Record<string, unknown>;
      selected?: boolean;
    };

    const existing = await this.db.query.canvasElements.findFirst({
      where: (ce, { and, eq }) =>
        and(eq(ce.id, elementId), eq(ce.documentId, documentId)),
    });

    if (!existing) {
      throw new NotFoundException("Canvas element not found");
    }

    const [updated] = await this.db
      .update(canvasElements)
      .set({
        x: body.x ?? existing.x,
        y: body.y ?? existing.y,
        width: body.width ?? existing.width,
        height: body.height ?? existing.height,
        zIndex: body.zIndex ?? existing.zIndex,
        rotation: body.rotation ?? existing.rotation,
        payload: body.payload ?? existing.payload,
        selected: body.selected ?? existing.selected,
        updatedAt: new Date(),
      })
      .where(and(eq(canvasElements.id, elementId), eq(canvasElements.companyId, companyId)))
      .returning();

    return res.json(updated);
  }

  /**
   * Connect two canvas elements with an edge.
   */
  @Post("companies/:companyId/documents/:documentId/canvas-edges")
  async addCanvasEdge(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("documentId") documentId: string,
    @Res() res: Response,
  ) {
    assertCompanyAccess(req, companyId);
    const actor = getActorInfo(req);
    const body = req.body as {
      sourceElementId: string;
      targetElementId: string;
      sourceAnchor?: string;
      targetAnchor?: string;
      connectorType?: string;
    };

    // Create a connector element
    const connector = await this.db.insert(canvasElements).values({
      companyId,
      documentId,
      type: "connector",
      x: 0,
      y: 0,
      zIndex: 0,
      rotation: 0,
      payload: {
        sourceId: body.sourceElementId,
        targetId: body.targetElementId,
        sourceAnchor: body.sourceAnchor ?? "right",
        targetAnchor: body.targetAnchor ?? "left",
        connectorType: body.connectorType ?? "smoothstep",
      },
      isPrivate: true,
      selected: false,
      createdByAgentId: actor.agentId ?? null,
    }).returning();

    return res.status(201).json(connector[0]);
  }
}
