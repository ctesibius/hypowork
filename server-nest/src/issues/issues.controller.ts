import { Controller, Delete, Get, Inject, Param, Patch, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import type { Actor } from "../auth/actor.guard.js";
import {
  addIssueCommentSchema,
  checkoutIssueSchema,
  createIssueLabelSchema,
  createIssueSchema,
  updateIssueSchema,
} from "@paperclipai/shared";
import { assertCompanyAccess, getActorInfo } from "../auth/authz.js";
import type { Db } from "@paperclipai/db";
import { issueService as expressIssueService } from "@paperclipai/server/services/issues";
import { heartbeatService as expressHeartbeatService } from "@paperclipai/server/services/heartbeat";
import { logActivity } from "@paperclipai/server/services/activity-log";
import { DB } from "../db/db.module.js";

@Controller()
export class IssuesController {
  private readonly svc;
  private readonly heartbeat;

  constructor(@Inject(DB) private readonly db: Db) {
    this.svc = expressIssueService(db);
    this.heartbeat = expressHeartbeatService(db);
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

  // Common malformed path when companyId is empty in "/api/companies/{companyId}/issues".
  @Get("issues")
  issues(@Res() res: Response) {
    return res.status(400).json({
      error: "Missing companyId in path. Use /api/companies/{companyId}/issues.",
    });
  }

  @Get("companies/:companyId/issues")
  async listCompanyIssues(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Res() res: Response,
  ) {
    assertCompanyAccess(req, companyId);

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
    assertCompanyAccess(req, companyId);
    return this.svc.listLabels(companyId);
  }

  @Post("companies/:companyId/labels")
  async createCompanyLabel(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Res() res: Response,
  ) {
    assertCompanyAccess(req, companyId);
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
    assertCompanyAccess(req, existing.companyId);
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
    assertCompanyAccess(req, issue.companyId);
    return res.json(issue);
  }

  @Post("companies/:companyId/issues")
  async createIssue(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Res() res: Response,
  ) {
    assertCompanyAccess(req, companyId);
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
    assertCompanyAccess(req, existing.companyId);
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
    assertCompanyAccess(req, existing.companyId);
    const issue = await this.svc.remove(id);
    if (!issue) return res.status(404).json({ error: "Issue not found" });
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
    assertCompanyAccess(req, issue.companyId);
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
    assertCompanyAccess(req, existing.companyId);
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
    assertCompanyAccess(req, issue.companyId);
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

  @Post("issues/:id/comments")
  async addIssueComment(
    @Req() req: Request & { actor?: Actor },
    @Param("id") rawId: string,
    @Res() res: Response,
  ) {
    const id = await this.normalizeIssueIdentifier(rawId);
    const issue = await this.svc.getById(id);
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    assertCompanyAccess(req, issue.companyId);
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

