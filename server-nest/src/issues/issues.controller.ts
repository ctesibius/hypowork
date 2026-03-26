import { Controller, Delete, Get, Inject, Param, Patch, Post, Put, Req, Res } from "@nestjs/common";
import multer from "multer";
import type { Request, Response } from "express";
import type { Actor } from "../auth/actor.guard.js";
import {
  addIssueCommentSchema,
  checkoutIssueSchema,
  createIssueAttachmentMetadataSchema,
  createIssueLabelSchema,
  createIssueSchema,
  createIssueWorkProductSchema,
  issueDocumentKeySchema,
  linkIssueApprovalSchema,
  updateIssueSchema,
  updateIssueWorkProductSchema,
  upsertIssueDocumentSchema,
} from "@paperclipai/shared";
import { assertWorkspaceAccess, getActorInfo } from "../auth/authz.js";
import type { Db } from "@paperclipai/db";
import { agentService as expressAgentService } from "@paperclipai/server/services/agents";
import { documentService as expressDocumentService } from "@paperclipai/server/services/documents";
import { executionWorkspaceService as expressExecutionWorkspaceService } from "@paperclipai/server/services/execution-workspaces";
import { issueApprovalService as expressIssueApprovalService } from "@paperclipai/server/services/issue-approvals";
import { issueService as expressIssueService } from "@paperclipai/server/services/issues";
import { goalService as expressGoalService } from "@paperclipai/server/services/goals";
import { projectService as expressProjectService } from "@paperclipai/server/services/projects";
import { workProductService as expressWorkProductService } from "@paperclipai/server/services/work-products";
import { heartbeatService as expressHeartbeatService } from "@paperclipai/server/services/heartbeat";
import { logActivity } from "@paperclipai/server/services/activity-log";
import { loadConfig } from "@paperclipai/server/config";
import { createStorageServiceFromConfig, type StorageService } from "@paperclipai/server/storage";
import { isAllowedContentType, MAX_ATTACHMENT_BYTES } from "@paperclipai/server/attachment-types";
import { DB } from "../db/db.module.js";

@Controller()
export class IssuesController {
  private readonly svc;
  private readonly heartbeat;
  private readonly projects;
  private readonly goals;
  private readonly documents;
  private readonly workProducts;
  private readonly issueApprovals;
  private readonly executionWorkspaces;
  private readonly agents;
  private readonly storage: StorageService;
  private readonly attachmentUpload;

  constructor(@Inject(DB) private readonly db: Db) {
    this.svc = expressIssueService(db);
    this.heartbeat = expressHeartbeatService(db);
    this.projects = expressProjectService(db);
    this.goals = expressGoalService(db);
    this.documents = expressDocumentService(db);
    this.workProducts = expressWorkProductService(db);
    this.issueApprovals = expressIssueApprovalService(db);
    this.executionWorkspaces = expressExecutionWorkspaceService(db);
    this.agents = expressAgentService(db);
    this.storage = createStorageServiceFromConfig(loadConfig());
    this.attachmentUpload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 },
    });
  }

  private withContentPath<T extends { id: string }>(attachment: T) {
    return {
      ...attachment,
      contentPath: `/api/attachments/${attachment.id}/content`,
    };
  }

  private async runAttachmentUpload(req: Request, res: Response) {
    await new Promise<void>((resolve, reject) => {
      this.attachmentUpload.single("file")(req, res, (err: unknown) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  @Get("issues/:id/attachments")
  async listIssueAttachments(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    const issueId = await this.normalizeIssueIdentifier(rawId);
    const issue = await this.svc.getById(issueId);
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    assertWorkspaceAccess(req, issue.companyId);
    const attachments = await this.svc.listAttachments(issueId);
    return res.json(attachments.map((a) => this.withContentPath(a)));
  }

  @Post("companies/:companyId/issues/:issueId/attachments")
  async uploadIssueAttachment(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("issueId") rawIssueId: string,
    @Res() res: Response,
  ) {
    assertWorkspaceAccess(req, companyId);
    const issueId = await this.normalizeIssueIdentifier(rawIssueId);
    const issue = await this.svc.getById(issueId);
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    if (issue.companyId !== companyId) {
      return res.status(422).json({ error: "Issue does not belong to company" });
    }

    try {
      await this.runAttachmentUpload(req, res);
    } catch (err: unknown) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(422).json({ error: `Attachment exceeds ${MAX_ATTACHMENT_BYTES} bytes` });
        }
        return res.status(400).json({ error: err.message });
      }
      throw err;
    }

    const file = (req as Request & { file?: { mimetype: string; buffer: Buffer; originalname: string } }).file;
    if (!file) {
      return res.status(400).json({ error: "Missing file field 'file'" });
    }
    const contentType = (file.mimetype || "").toLowerCase();
    if (!isAllowedContentType(contentType)) {
      return res.status(422).json({ error: `Unsupported attachment type: ${contentType || "unknown"}` });
    }
    if (file.buffer.length <= 0) {
      return res.status(422).json({ error: "Attachment is empty" });
    }

    const parsedMeta = createIssueAttachmentMetadataSchema.safeParse(req.body ?? {});
    if (!parsedMeta.success) {
      return res.status(400).json({ error: "Invalid attachment metadata", details: parsedMeta.error.issues });
    }

    const actor = getActorInfo(req);
    const stored = await this.storage.putFile({
      companyId,
      namespace: `issues/${issueId}`,
      originalFilename: file.originalname || null,
      contentType,
      body: file.buffer,
    });

    const attachment = await this.svc.createAttachment({
      issueId,
      issueCommentId: parsedMeta.data.issueCommentId ?? null,
      provider: stored.provider,
      objectKey: stored.objectKey,
      contentType: stored.contentType,
      byteSize: stored.byteSize,
      sha256: stored.sha256,
      originalFilename: stored.originalFilename,
      createdByAgentId: actor.agentId,
      createdByUserId: actor.actorType === "user" ? actor.actorId : null,
    });

    await logActivity(this.db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.attachment_added",
      entityType: "issue",
      entityId: issueId,
      details: {
        attachmentId: attachment.id,
        originalFilename: attachment.originalFilename,
        contentType: attachment.contentType,
        byteSize: attachment.byteSize,
      },
    });

    return res.status(201).json(this.withContentPath(attachment));
  }

  @Get("attachments/:attachmentId/content")
  async getAttachmentContent(
    @Req() req: Request & { actor?: Actor },
    @Param("attachmentId") attachmentId: string,
    @Res() res: Response,
  ) {
    const attachment = await this.svc.getAttachmentById(attachmentId);
    if (!attachment) return res.status(404).json({ error: "Attachment not found" });
    assertWorkspaceAccess(req, attachment.companyId);

    const object = await this.storage.getObject(attachment.companyId, attachment.objectKey);
    res.setHeader("Content-Type", attachment.contentType || object.contentType || "application/octet-stream");
    res.setHeader("Content-Length", String(attachment.byteSize || object.contentLength || 0));
    res.setHeader("Cache-Control", "private, max-age=60");
    const filename = attachment.originalFilename ?? "attachment";
    res.setHeader("Content-Disposition", `inline; filename="${filename.replaceAll('"', "")}"`);

    object.stream.on("error", () => {
      if (!res.headersSent) {
        res.status(500).end();
      }
    });
    object.stream.pipe(res);
  }

  @Delete("attachments/:attachmentId")
  async deleteAttachment(
    @Req() req: Request & { actor?: Actor },
    @Param("attachmentId") attachmentId: string,
    @Res() res: Response,
  ) {
    const attachment = await this.svc.getAttachmentById(attachmentId);
    if (!attachment) return res.status(404).json({ error: "Attachment not found" });
    assertWorkspaceAccess(req, attachment.companyId);

    try {
      await this.storage.deleteObject(attachment.companyId, attachment.objectKey);
    } catch (err) {
      console.warn("storage delete failed while removing attachment", { err, attachmentId });
    }

    const removed = await this.svc.removeAttachment(attachmentId);
    if (!removed) return res.status(404).json({ error: "Attachment not found" });

    const actor = getActorInfo(req);
    await logActivity(this.db, {
      companyId: removed.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.attachment_removed",
      entityType: "issue",
      entityId: removed.issueId,
      details: { attachmentId: removed.id },
    });

    return res.json({ ok: true });
  }

  private async assertCanManageIssueApprovalLinks(
    req: Request & { actor?: Actor },
    res: Response,
    companyId: string,
  ): Promise<boolean> {
    assertWorkspaceAccess(req, companyId);
    if (req.actor?.type === "board") return true;
    if (req.actor?.type !== "agent" || !req.actor.agentId) {
      res.status(403).json({ error: "Agent authentication required" });
      return false;
    }
    const actorAgent = await this.agents.getById(req.actor.agentId);
    if (!actorAgent || actorAgent.companyId !== companyId) {
      res.status(403).json({ error: "Forbidden" });
      return false;
    }
    if (actorAgent.role === "ceo" || Boolean(actorAgent.permissions?.canCreateAgents)) return true;
    res.status(403).json({ error: "Missing permission to link approvals" });
    return false;
  }

  /** Matches Express `normalizeIssueIdentifier` in `server/src/routes/issues.ts` (`router.param("id")`). */
  private async normalizeIssueIdentifier(rawId: string): Promise<string> {
    const raw = rawId.trim();
    if (/^[A-Z]+-\d+$/i.test(raw)) {
      const issue = await this.svc.getByIdentifier(raw);
      if (issue) return issue.id;
    }
    return raw;
  }

  // Common malformed path when workspaceId is empty in "/api/workspaces/{workspaceId}/issues".
  @Get("issues")
  issues(@Res() res: Response) {
    return res.status(400).json({
      error: "Missing workspaceId in path. Use /api/workspaces/{workspaceId}/issues.",
    });
  }

  @Get("companies/:companyId/issues")
  async listCompanyIssues(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Res() res: Response,
  ) {
    assertWorkspaceAccess(req, companyId);

    const query = req.query as Record<string, unknown>;
    const assigneeAgentId = typeof query.assigneeAgentId === "string" ? query.assigneeAgentId : undefined;
    const assigneeUserFilterRaw = typeof query.assigneeUserId === "string" ? query.assigneeUserId : undefined;
    const touchedByUserFilterRaw = typeof query.touchedByUserId === "string" ? query.touchedByUserId : undefined;
    const unreadForUserFilterRaw = typeof query.unreadForUserId === "string" ? query.unreadForUserId : undefined;

    const assigneeUserId =
      assigneeUserFilterRaw === "me" && req.actor?.type === "board"
        ? req.actor.userId
        : assigneeUserFilterRaw;
    const touchedByUserId =
      touchedByUserFilterRaw === "me" && req.actor?.type === "board"
        ? req.actor.userId
        : touchedByUserFilterRaw;
    const unreadForUserId =
      unreadForUserFilterRaw === "me" && req.actor?.type === "board"
        ? req.actor.userId
        : unreadForUserFilterRaw;

    if (assigneeUserFilterRaw === "me" && (!assigneeUserId || req.actor?.type !== "board")) {
      return res.status(403).json({ error: "assigneeUserId=me requires board authentication" });
    }
    if (touchedByUserFilterRaw === "me" && (!touchedByUserId || req.actor?.type !== "board")) {
      return res.status(403).json({ error: "touchedByUserId=me requires board authentication" });
    }
    if (unreadForUserFilterRaw === "me" && (!unreadForUserId || req.actor?.type !== "board")) {
      return res.status(403).json({ error: "unreadForUserId=me requires board authentication" });
    }

    const result = await this.svc.list(companyId, {
      status: typeof query.status === "string" ? query.status : undefined,
      assigneeAgentId,
      assigneeUserId,
      touchedByUserId,
      unreadForUserId,
      projectId: typeof query.projectId === "string" ? query.projectId : undefined,
      parentId: typeof query.parentId === "string" ? query.parentId : undefined,
      labelId: typeof query.labelId === "string" ? query.labelId : undefined,
      q: typeof query.q === "string" ? query.q : undefined,
    });

    return res.json(result);
  }

  @Get("companies/:companyId/labels")
  async listCompanyLabels(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
  ) {
    assertWorkspaceAccess(req, companyId);
    return this.svc.listLabels(companyId);
  }

  @Post("companies/:companyId/labels")
  async createCompanyLabel(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Res() res: Response,
  ) {
    assertWorkspaceAccess(req, companyId);
    const body = createIssueLabelSchema.parse(req.body ?? {});
    const label = await this.svc.createLabel(companyId, body);
    const actor = getActorInfo(req);
    await logActivity(this.db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "label.created",
      entityType: "label",
      entityId: label.id,
      details: { name: label.name, color: label.color },
    });
    return res.status(201).json(label);
  }

  @Delete("labels/:labelId")
  async deleteLabel(
    @Req() req: Request & { actor?: Actor },
    @Param("labelId") labelId: string,
    @Res() res: Response,
  ) {
    const existing = await this.svc.getLabelById(labelId);
    if (!existing) return res.status(404).json({ error: "Label not found" });
    assertWorkspaceAccess(req, existing.companyId);
    const removed = await this.svc.deleteLabel(labelId);
    if (!removed) return res.status(404).json({ error: "Label not found" });
    const actor = getActorInfo(req);
    await logActivity(this.db, {
      companyId: removed.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "label.deleted",
      entityType: "label",
      entityId: removed.id,
      details: { name: removed.name, color: removed.color },
    });
    return res.json(removed);
  }

  @Get("issues/:id")
  async getIssue(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    const id = await this.normalizeIssueIdentifier(rawId);
    const issue = await this.svc.getById(id);
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    assertWorkspaceAccess(req, issue.companyId);
    const [ancestors, project, goal, mentionedProjectIds, documentPayload] = await Promise.all([
      this.svc.getAncestors(issue.id),
      issue.projectId ? this.projects.getById(issue.projectId) : null,
      issue.goalId
        ? this.goals.getById(issue.goalId)
        : !issue.projectId
          ? this.goals.getDefaultCompanyGoal(issue.companyId)
          : null,
      this.svc.findMentionedProjectIds(issue.id),
      this.documents.getIssueDocumentPayload(issue),
    ]);
    const mentionedProjects =
      mentionedProjectIds.length > 0
        ? await this.projects.listByIds(issue.companyId, mentionedProjectIds)
        : [];
    const currentExecutionWorkspace = issue.executionWorkspaceId
      ? await this.executionWorkspaces.getById(issue.executionWorkspaceId)
      : null;
    const workProducts = await this.workProducts.listForIssue(issue.id);
    return res.json({
      ...issue,
      goalId: goal?.id ?? issue.goalId,
      ancestors,
      ...documentPayload,
      project: project ?? null,
      goal: goal ?? null,
      mentionedProjects,
      currentExecutionWorkspace,
      workProducts,
    });
  }

  @Get("issues/:id/heartbeat-context")
  async getIssueHeartbeatContext(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    const id = await this.normalizeIssueIdentifier(rawId);
    const issue = await this.svc.getById(id);
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    assertWorkspaceAccess(req, issue.companyId);

    const wakeCommentId =
      typeof req.query.wakeCommentId === "string" && req.query.wakeCommentId.trim().length > 0
        ? req.query.wakeCommentId.trim()
        : null;

    const [ancestors, project, goal, commentCursor, wakeComment] = await Promise.all([
      this.svc.getAncestors(issue.id),
      issue.projectId ? this.projects.getById(issue.projectId) : null,
      issue.goalId
        ? this.goals.getById(issue.goalId)
        : !issue.projectId
          ? this.goals.getDefaultCompanyGoal(issue.companyId)
          : null,
      this.svc.getCommentCursor(issue.id),
      wakeCommentId ? this.svc.getComment(wakeCommentId) : null,
    ]);

    return res.json({
      issue: {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description,
        status: issue.status,
        priority: issue.priority,
        projectId: issue.projectId,
        goalId: goal?.id ?? issue.goalId,
        parentId: issue.parentId,
        assigneeAgentId: issue.assigneeAgentId,
        assigneeUserId: issue.assigneeUserId,
        updatedAt: issue.updatedAt,
      },
      ancestors: ancestors.map((ancestor) => ({
        id: ancestor.id,
        identifier: ancestor.identifier,
        title: ancestor.title,
        status: ancestor.status,
        priority: ancestor.priority,
      })),
      project: project
        ? {
            id: project.id,
            name: project.name,
            status: project.status,
            targetDate: project.targetDate,
          }
        : null,
      goal: goal
        ? {
            id: goal.id,
            title: goal.title,
            status: goal.status,
            level: goal.level,
            parentId: goal.parentId,
          }
        : null,
      commentCursor,
      wakeComment:
        wakeComment && wakeComment.issueId === issue.id
          ? wakeComment
          : null,
    });
  }

  @Get("issues/:id/work-products")
  async listWorkProducts(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    const id = await this.normalizeIssueIdentifier(rawId);
    const issue = await this.svc.getById(id);
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    assertWorkspaceAccess(req, issue.companyId);
    const workProducts = await this.workProducts.listForIssue(issue.id);
    return res.json(workProducts);
  }

  @Get("issues/:id/documents")
  async listIssueDocuments(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    const id = await this.normalizeIssueIdentifier(rawId);
    const issue = await this.svc.getById(id);
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    assertWorkspaceAccess(req, issue.companyId);
    const docs = await this.documents.listIssueDocuments(issue.id);
    return res.json(docs);
  }

  @Get("issues/:id/documents/:key")
  async getIssueDocument(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Param("key") keyParam: string,
    @Res() res: Response,
  ) {
    const id = await this.normalizeIssueIdentifier(rawId);
    const issue = await this.svc.getById(id);
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    assertWorkspaceAccess(req, issue.companyId);
    const keyParsed = issueDocumentKeySchema.safeParse(String(keyParam ?? "").trim().toLowerCase());
    if (!keyParsed.success) {
      return res.status(400).json({ error: "Invalid document key", details: keyParsed.error.issues });
    }
    const doc = await this.documents.getIssueDocumentByKey(issue.id, keyParsed.data);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    return res.json(doc);
  }

  @Put("issues/:id/documents/:key")
  async upsertIssueDocument(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Param("key") keyParam: string,
    @Res() res: Response,
  ) {
    const id = await this.normalizeIssueIdentifier(rawId);
    const issue = await this.svc.getById(id);
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    assertWorkspaceAccess(req, issue.companyId);
    const keyParsed = issueDocumentKeySchema.safeParse(String(keyParam ?? "").trim().toLowerCase());
    if (!keyParsed.success) {
      return res.status(400).json({ error: "Invalid document key", details: keyParsed.error.issues });
    }
    const body = upsertIssueDocumentSchema.parse(req.body ?? {});
    const actor = getActorInfo(req);
    const result = await this.documents.upsertIssueDocument({
      issueId: issue.id,
      key: keyParsed.data,
      title: body.title ?? null,
      format: body.format,
      body: body.body,
      changeSummary: body.changeSummary ?? null,
      baseRevisionId: body.baseRevisionId ?? null,
      createdByAgentId: actor.agentId ?? null,
      createdByUserId: actor.actorType === "user" ? actor.actorId : null,
    });
    const doc = result.document;
    await logActivity(this.db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: result.created ? "issue.document_created" : "issue.document_updated",
      entityType: "issue",
      entityId: issue.id,
      details: {
        key: doc.key,
        documentId: doc.id,
        title: doc.title,
        format: doc.format,
        revisionNumber: doc.latestRevisionNumber,
      },
    });
    return res.status(result.created ? 201 : 200).json(doc);
  }

  @Get("issues/:id/documents/:key/revisions")
  async listIssueDocumentRevisions(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Param("key") keyParam: string,
    @Res() res: Response,
  ) {
    const id = await this.normalizeIssueIdentifier(rawId);
    const issue = await this.svc.getById(id);
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    assertWorkspaceAccess(req, issue.companyId);
    const keyParsed = issueDocumentKeySchema.safeParse(String(keyParam ?? "").trim().toLowerCase());
    if (!keyParsed.success) {
      return res.status(400).json({ error: "Invalid document key", details: keyParsed.error.issues });
    }
    const revisions = await this.documents.listIssueDocumentRevisions(issue.id, keyParsed.data);
    return res.json(revisions);
  }

  @Delete("issues/:id/documents/:key")
  async deleteIssueDocument(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Param("key") keyParam: string,
    @Res() res: Response,
  ) {
    const id = await this.normalizeIssueIdentifier(rawId);
    const issue = await this.svc.getById(id);
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    assertWorkspaceAccess(req, issue.companyId);
    if (req.actor?.type !== "board") {
      return res.status(403).json({ error: "Board authentication required" });
    }
    const keyParsed = issueDocumentKeySchema.safeParse(String(keyParam ?? "").trim().toLowerCase());
    if (!keyParsed.success) {
      return res.status(400).json({ error: "Invalid document key", details: keyParsed.error.issues });
    }
    const removed = await this.documents.deleteIssueDocument(issue.id, keyParsed.data);
    if (!removed) return res.status(404).json({ error: "Document not found" });
    const actor = getActorInfo(req);
    await logActivity(this.db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.document_deleted",
      entityType: "issue",
      entityId: issue.id,
      details: {
        key: removed.key,
        documentId: removed.id,
        title: removed.title,
      },
    });
    return res.json({ ok: true });
  }

  @Post("issues/:id/work-products")
  async createWorkProduct(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    const id = await this.normalizeIssueIdentifier(rawId);
    const issue = await this.svc.getById(id);
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    assertWorkspaceAccess(req, issue.companyId);
    const body = createIssueWorkProductSchema.parse(req.body ?? {});
    const product = await this.workProducts.createForIssue(issue.id, issue.companyId, {
      ...body,
      projectId: body.projectId ?? issue.projectId ?? null,
    });
    if (!product) return res.status(422).json({ error: "Invalid work product payload" });
    const actor = getActorInfo(req);
    await logActivity(this.db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.work_product_created",
      entityType: "issue",
      entityId: issue.id,
      details: { workProductId: product.id, type: product.type, provider: product.provider },
    });
    return res.status(201).json(product);
  }

  @Patch("work-products/:id")
  async updateWorkProduct(
    @Req() req: Request & { actor?: Actor },
    @Param("id") workProductId: string,
    @Res() res: Response,
  ) {
    const existing = await this.workProducts.getById(workProductId);
    if (!existing) return res.status(404).json({ error: "Work product not found" });
    assertWorkspaceAccess(req, existing.companyId);
    const body = updateIssueWorkProductSchema.parse(req.body ?? {});
    const product = await this.workProducts.update(workProductId, body);
    if (!product) return res.status(404).json({ error: "Work product not found" });
    const actor = getActorInfo(req);
    await logActivity(this.db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.work_product_updated",
      entityType: "issue",
      entityId: existing.issueId,
      details: { workProductId: product.id, changedKeys: Object.keys(body).sort() },
    });
    return res.json(product);
  }

  @Delete("work-products/:id")
  async deleteWorkProduct(
    @Req() req: Request & { actor?: Actor },
    @Param("id") workProductId: string,
    @Res() res: Response,
  ) {
    const existing = await this.workProducts.getById(workProductId);
    if (!existing) return res.status(404).json({ error: "Work product not found" });
    assertWorkspaceAccess(req, existing.companyId);
    const removed = await this.workProducts.remove(workProductId);
    if (!removed) return res.status(404).json({ error: "Work product not found" });
    const actor = getActorInfo(req);
    await logActivity(this.db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.work_product_deleted",
      entityType: "issue",
      entityId: existing.issueId,
      details: { workProductId: removed.id, type: removed.type },
    });
    return res.json(removed);
  }

  @Post("issues/:id/read")
  async markIssueRead(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    const id = await this.normalizeIssueIdentifier(rawId);
    const issue = await this.svc.getById(id);
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    assertWorkspaceAccess(req, issue.companyId);
    if (req.actor?.type !== "board") {
      return res.status(403).json({ error: "Board authentication required" });
    }
    if (!req.actor.userId) {
      return res.status(403).json({ error: "Board user context required" });
    }
    const readState = await this.svc.markRead(issue.companyId, issue.id, req.actor.userId, new Date());
    const actor = getActorInfo(req);
    await logActivity(this.db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.read_marked",
      entityType: "issue",
      entityId: issue.id,
      details: { userId: req.actor.userId, lastReadAt: readState.lastReadAt },
    });
    return res.json(readState);
  }

  @Get("issues/:id/approvals")
  async listIssueApprovals(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    const id = await this.normalizeIssueIdentifier(rawId);
    const issue = await this.svc.getById(id);
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    assertWorkspaceAccess(req, issue.companyId);
    const approvals = await this.issueApprovals.listApprovalsForIssue(id);
    return res.json(approvals);
  }

  @Post("issues/:id/approvals")
  async linkIssueApproval(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    const id = await this.normalizeIssueIdentifier(rawId);
    const issue = await this.svc.getById(id);
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    if (!(await this.assertCanManageIssueApprovalLinks(req, res, issue.companyId))) return;
    const body = linkIssueApprovalSchema.parse(req.body ?? {});
    const actor = getActorInfo(req);
    await this.issueApprovals.link(id, body.approvalId, {
      agentId: actor.agentId,
      userId: actor.actorType === "user" ? actor.actorId : null,
    });
    await logActivity(this.db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.approval_linked",
      entityType: "issue",
      entityId: issue.id,
      details: { approvalId: body.approvalId },
    });
    const approvals = await this.issueApprovals.listApprovalsForIssue(id);
    return res.status(201).json(approvals);
  }

  @Delete("issues/:id/approvals/:approvalId")
  async unlinkIssueApproval(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Param("approvalId") approvalId: string,
    @Res() res: Response,
  ) {
    const id = await this.normalizeIssueIdentifier(rawId);
    const issue = await this.svc.getById(id);
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    if (!(await this.assertCanManageIssueApprovalLinks(req, res, issue.companyId))) return;
    await this.issueApprovals.unlink(id, approvalId);
    const actor = getActorInfo(req);
    await logActivity(this.db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.approval_unlinked",
      entityType: "issue",
      entityId: issue.id,
      details: { approvalId },
    });
    return res.json({ ok: true });
  }

  @Post("companies/:companyId/issues")
  async createIssue(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Res() res: Response,
  ) {
    assertWorkspaceAccess(req, companyId);
    const body = createIssueSchema.parse(req.body ?? {});
    const actor = getActorInfo(req);
    const issue = await this.svc.create(companyId, {
      ...body,
      createdByAgentId: actor.agentId,
      createdByUserId: actor.actorType === "user" ? actor.actorId : null,
    });
    await logActivity(this.db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.created",
      entityType: "issue",
      entityId: issue.id,
      details: { title: issue.title, identifier: issue.identifier },
    });
    return res.status(201).json(issue);
  }

  @Patch("issues/:id")
  async updateIssue(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    const id = await this.normalizeIssueIdentifier(rawId);
    const existing = await this.svc.getById(id);
    if (!existing) return res.status(404).json({ error: "Issue not found" });
    assertWorkspaceAccess(req, existing.companyId);
    const body = updateIssueSchema.parse(req.body ?? {});
    const { comment: commentBody, hiddenAt: hiddenAtRaw, ...updateFields } = body as Record<string, unknown>;
    if (hiddenAtRaw !== undefined) {
      updateFields.hiddenAt = hiddenAtRaw ? new Date(String(hiddenAtRaw)) : null;
    }
    const issue = await this.svc.update(id, updateFields);
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    const actor = getActorInfo(req);
    await logActivity(this.db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.updated",
      entityType: "issue",
      entityId: issue.id,
      details: { ...updateFields, identifier: issue.identifier, ...(commentBody ? { source: "comment" } : {}) },
    });
    let comment = null;
    if (typeof commentBody === "string" && commentBody.length > 0) {
      comment = await this.svc.addComment(id, commentBody, {
        agentId: actor.agentId ?? undefined,
        userId: actor.actorType === "user" ? actor.actorId : undefined,
      });
      await logActivity(this.db, {
        companyId: issue.companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "issue.comment_added",
        entityType: "issue",
        entityId: issue.id,
        details: { commentId: comment.id, bodySnippet: comment.body.slice(0, 120) },
      });
    }
    return res.json({ ...issue, comment });
  }

  @Delete("issues/:id")
  async deleteIssue(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    const id = await this.normalizeIssueIdentifier(rawId);
    const existing = await this.svc.getById(id);
    if (!existing) return res.status(404).json({ error: "Issue not found" });
    assertWorkspaceAccess(req, existing.companyId);
    const attachments = await this.svc.listAttachments(id);
    const issue = await this.svc.remove(id);
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    for (const attachment of attachments) {
      try {
        await this.storage.deleteObject(attachment.companyId, attachment.objectKey);
      } catch (err) {
        console.warn("failed to delete attachment object during issue delete", { err, issueId: id, attachmentId: attachment.id });
      }
    }
    const actor = getActorInfo(req);
    await logActivity(this.db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.deleted",
      entityType: "issue",
      entityId: issue.id,
    });
    return res.json(issue);
  }

  @Post("issues/:id/checkout")
  async checkoutIssue(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    const id = await this.normalizeIssueIdentifier(rawId);
    const issue = await this.svc.getById(id);
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    assertWorkspaceAccess(req, issue.companyId);
    const body = checkoutIssueSchema.parse(req.body ?? {});
    if (req.actor?.type === "agent" && req.actor.agentId !== body.agentId) {
      return res.status(403).json({ error: "Agent can only checkout as itself" });
    }
    const checkoutRunId = req.actor?.type === "agent" ? req.actor.runId ?? null : null;
    const updated = await this.svc.checkout(id, body.agentId, body.expectedStatuses, checkoutRunId);
    const actor = getActorInfo(req);
    await logActivity(this.db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.checked_out",
      entityType: "issue",
      entityId: issue.id,
      details: { agentId: body.agentId },
    });
    return res.json(updated);
  }

  @Post("issues/:id/release")
  async releaseIssue(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    const id = await this.normalizeIssueIdentifier(rawId);
    const existing = await this.svc.getById(id);
    if (!existing) return res.status(404).json({ error: "Issue not found" });
    assertWorkspaceAccess(req, existing.companyId);
    const released = await this.svc.release(
      id,
      req.actor?.type === "agent" ? req.actor.agentId : undefined,
      req.actor?.type === "agent" ? req.actor.runId ?? null : null,
    );
    if (!released) return res.status(404).json({ error: "Issue not found" });
    const actor = getActorInfo(req);
    await logActivity(this.db, {
      companyId: released.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.released",
      entityType: "issue",
      entityId: released.id,
    });
    return res.json(released);
  }

  @Get("issues/:id/comments")
  async listIssueComments(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    const id = await this.normalizeIssueIdentifier(rawId);
    const issue = await this.svc.getById(id);
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    assertWorkspaceAccess(req, issue.companyId);
    const afterCommentId =
      typeof req.query.after === "string" && req.query.after.trim().length > 0
        ? req.query.after.trim()
        : typeof req.query.afterCommentId === "string" && req.query.afterCommentId.trim().length > 0
          ? req.query.afterCommentId.trim()
          : null;
    const order =
      typeof req.query.order === "string" && req.query.order.trim().toLowerCase() === "asc"
        ? "asc"
        : "desc";
    const limitRaw =
      typeof req.query.limit === "string" && req.query.limit.trim().length > 0
        ? Number(req.query.limit)
        : null;
    const limit = limitRaw && Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 500) : null;
    const comments = await this.svc.listComments(id, { afterCommentId, order, limit });
    return res.json(comments);
  }

  @Get("issues/:id/comments/:commentId")
  async getIssueComment(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Param("commentId") commentId: string,
    @Res() res: Response,
  ) {
    const id = await this.normalizeIssueIdentifier(rawId);
    const issue = await this.svc.getById(id);
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    assertWorkspaceAccess(req, issue.companyId);
    const comment = await this.svc.getComment(commentId);
    if (!comment || comment.issueId !== id) {
      return res.status(404).json({ error: "Comment not found" });
    }
    return res.json(comment);
  }

  @Post("issues/:id/comments")
  async addIssueComment(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    const id = await this.normalizeIssueIdentifier(rawId);
    const issue = await this.svc.getById(id);
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    assertWorkspaceAccess(req, issue.companyId);
    const body = addIssueCommentSchema.parse(req.body ?? {});
    const actor = getActorInfo(req);
    const comment = await this.svc.addComment(id, body.body, {
      agentId: actor.agentId ?? undefined,
      userId: actor.actorType === "user" ? actor.actorId : undefined,
    });
    await logActivity(this.db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.comment_added",
      entityType: "issue",
      entityId: issue.id,
      details: { commentId: comment.id, bodySnippet: comment.body.slice(0, 120) },
    });
    if (issue.assigneeAgentId) {
      void this.heartbeat.wakeup(issue.assigneeAgentId, {
        source: "automation",
        triggerDetail: "system",
        reason: "issue_commented",
        payload: { issueId: issue.id, commentId: comment.id, mutation: "comment" },
        requestedByActorType: actor.actorType,
        requestedByActorId: actor.actorId,
        contextSnapshot: { issueId: issue.id, commentId: comment.id, source: "issue.comment" },
      }).catch(() => {});
    }
    return res.status(201).json(comment);
  }
}

