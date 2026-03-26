import { Controller, Get, Post, Inject, Param, Req, Res, Body, Query } from "@nestjs/common";
import type { Request, Response } from "express";
import type { Actor } from "../auth/actor.guard.js";
import { assertBoard, assertWorkspaceAccess, getActorInfo } from "../auth/authz.js";
import type { Db } from "@paperclipai/db";
import { approvalService as expressApprovalService } from "@paperclipai/server/services/approvals";
import { issueApprovalService as expressIssueApprovalService } from "@paperclipai/server/services/issue-approvals";
import { secretService as expressSecretService } from "@paperclipai/server/services/secrets";
import { heartbeatService as expressHeartbeatService } from "@paperclipai/server/services/heartbeat";
import { logActivity } from "@paperclipai/server/services/activity-log";
import { DB } from "../db/db.module.js";

@Controller()
export class ApprovalsController {
  private readonly svc;
  private readonly issueApprovalsSvc;
  private readonly secretsSvc;
  private readonly heartbeat;
  private readonly strictSecretsMode;

  constructor(@Inject(DB) private readonly db: Db) {
    this.svc = expressApprovalService(db);
    this.issueApprovalsSvc = expressIssueApprovalService(db);
    this.secretsSvc = expressSecretService(db);
    this.heartbeat = expressHeartbeatService(db);
    this.strictSecretsMode = process.env.PAPERCLIP_SECRETS_STRICT_MODE === "true";
  }

  @Get("companies/:companyId/approvals")
  async listApprovals(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Query("status") status?: string,
  ) {
    assertWorkspaceAccess(req, companyId);
    return this.svc.list(companyId, status);
  }

  @Get("approvals/:id")
  async getApproval(
    @Req() req: Request & { actor?: Actor },
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const approval = await this.svc.getById(id);
    if (!approval) {
      return res.status(404).json({ error: "Approval not found" });
    }
    assertWorkspaceAccess(req, approval.companyId);
    return res.json(approval);
  }

  @Post("companies/:companyId/approvals")
  async createApproval(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Body() body: {
      type: string;
      payload: Record<string, unknown>;
      issueIds?: string[];
      requestedByAgentId?: string;
    },
    @Res() res: Response,
  ) {
    assertWorkspaceAccess(req, companyId);
    const actorInfo = getActorInfo(req);
    const rawIssueIds = body.issueIds;
    const issueIds = Array.isArray(rawIssueIds)
      ? rawIssueIds.filter((value: unknown): value is string => typeof value === "string")
      : [];
    const { issueIds: _issueIds, ...approvalInput } = body;
    const normalizedPayload =
      approvalInput.type === "hire_agent"
        ? await this.secretsSvc.normalizeHireApprovalPayloadForPersistence(
            companyId,
            approvalInput.payload,
            { strictMode: this.strictSecretsMode },
          )
        : approvalInput.payload;
    const approval = await this.svc.create(companyId, {
      ...approvalInput,
      payload: normalizedPayload,
      requestedByUserId: actorInfo.actorType === "user" ? actorInfo.actorId : null,
      requestedByAgentId:
        body.requestedByAgentId ?? (actorInfo.actorType === "agent" ? actorInfo.agentId : null),
      status: "pending",
      decisionNote: null,
      decidedByUserId: null,
      decidedAt: null,
      updatedAt: new Date(),
    });
    if (issueIds.length > 0) {
      await this.issueApprovalsSvc.linkManyForApproval(approval.id, issueIds, {
        agentId: actorInfo.agentId,
        userId: actorInfo.actorType === "user" ? actorInfo.actorId : null,
      });
    }
    await logActivity(this.db, {
      companyId,
      actorType: actorInfo.actorType,
      actorId: actorInfo.actorId,
      agentId: actorInfo.agentId,
      action: "approval.created",
      entityType: "approval",
      entityId: approval.id,
      details: { type: approval.type, issueIds },
    });
    return res.status(201).json(approval);
  }

  @Get("approvals/:id/issues")
  async getApprovalIssues(
    @Req() req: Request & { actor?: Actor },
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const approval = await this.svc.getById(id);
    if (!approval) {
      return res.status(404).json({ error: "Approval not found" });
    }
    assertWorkspaceAccess(req, approval.companyId);
    const issues = await this.issueApprovalsSvc.listIssuesForApproval(id);
    return res.json(issues);
  }

  @Post("approvals/:id/approve")
  async approve(
    @Req() req: Request & { actor?: Actor },
    @Param("id") id: string,
    @Body() body: { decidedByUserId?: string; decisionNote?: string },
    @Res() res: Response,
  ) {
    assertBoard(req);
    const actor = req.actor as Extract<Actor, { type: "board" }>;
    const { approval, applied } = await this.svc.approve(id, body.decidedByUserId ?? "board", body.decisionNote);
    if (applied) {
      const linkedIssues = await this.issueApprovalsSvc.listIssuesForApproval(approval.id);
      const linkedIssueIds = linkedIssues.map((issue) => issue.id);
      const primaryIssueId = linkedIssueIds[0] ?? null;

      await logActivity(this.db, {
        companyId: approval.companyId,
        actorType: "user",
        actorId: actor.userId ?? "board",
        action: "approval.approved",
        entityType: "approval",
        entityId: approval.id,
        details: {
          type: approval.type,
          requestedByAgentId: approval.requestedByAgentId,
          linkedIssueIds,
        },
      });

      if (approval.requestedByAgentId) {
        try {
          const wakeRun = await this.heartbeat.wakeup(approval.requestedByAgentId, {
            source: "automation",
            triggerDetail: "system",
            reason: "approval_approved",
            payload: {
              approvalId: approval.id,
              approvalStatus: approval.status,
              issueId: primaryIssueId,
              issueIds: linkedIssueIds,
            },
            requestedByActorType: "user",
            requestedByActorId: actor.userId ?? "board",
            contextSnapshot: {
              source: "approval.approved",
              approvalId: approval.id,
              approvalStatus: approval.status,
              issueId: primaryIssueId,
              issueIds: linkedIssueIds,
              taskId: primaryIssueId,
              wakeReason: "approval_approved",
            },
          });
          await logActivity(this.db, {
            companyId: approval.companyId,
            actorType: "user",
            actorId: actor.userId ?? "board",
            action: "approval.requester_wakeup_queued",
            entityType: "approval",
            entityId: approval.id,
            details: {
              requesterAgentId: approval.requestedByAgentId,
              wakeRunId: wakeRun?.id ?? null,
              linkedIssueIds,
            },
          });
        } catch (err) {
          await logActivity(this.db, {
            companyId: approval.companyId,
            actorType: "user",
            actorId: actor.userId ?? "board",
            action: "approval.requester_wakeup_failed",
            entityType: "approval",
            entityId: approval.id,
            details: {
              requesterAgentId: approval.requestedByAgentId,
              linkedIssueIds,
              error: err instanceof Error ? err.message : String(err),
            },
          });
        }
      }
    }
    return res.json(approval);
  }

  @Post("approvals/:id/reject")
  async reject(
    @Req() req: Request & { actor?: Actor },
    @Param("id") id: string,
    @Body() body: { decidedByUserId?: string; decisionNote?: string },
    @Res() res: Response,
  ) {
    assertBoard(req);
    const actor = req.actor as Extract<Actor, { type: "board" }>;
    const { approval, applied } = await this.svc.reject(id, body.decidedByUserId ?? "board", body.decisionNote);
    if (applied) {
      await logActivity(this.db, {
        companyId: approval.companyId,
        actorType: "user",
        actorId: actor.userId ?? "board",
        action: "approval.rejected",
        entityType: "approval",
        entityId: approval.id,
        details: { type: approval.type },
      });
    }
    return res.json(approval);
  }

  @Post("approvals/:id/request-revision")
  async requestRevision(
    @Req() req: Request & { actor?: Actor },
    @Param("id") id: string,
    @Body() body: { decidedByUserId?: string; decisionNote?: string },
    @Res() res: Response,
  ) {
    assertBoard(req);
    const actor = req.actor as Extract<Actor, { type: "board" }>;
    const approval = await this.svc.requestRevision(id, body.decidedByUserId ?? "board", body.decisionNote);
    await logActivity(this.db, {
      companyId: approval.companyId,
      actorType: "user",
      actorId: actor.userId ?? "board",
      action: "approval.revision_requested",
      entityType: "approval",
      entityId: approval.id,
      details: { type: approval.type },
    });
    return res.json(approval);
  }

  @Post("approvals/:id/resubmit")
  async resubmit(
    @Req() req: Request & { actor?: Actor },
    @Param("id") id: string,
    @Body() body: { payload?: Record<string, unknown> },
    @Res() res: Response,
  ) {
    const existing = await this.svc.getById(id);
    if (!existing) {
      return res.status(404).json({ error: "Approval not found" });
    }
    assertWorkspaceAccess(req, existing.companyId);
    const actor = req.actor as Actor;
    if (actor.type === "agent" && actor.agentId !== existing.requestedByAgentId) {
      return res.status(403).json({ error: "Only requesting agent can resubmit this approval" });
    }
    const normalizedPayload = body.payload
      ? existing.type === "hire_agent"
        ? await this.secretsSvc.normalizeHireApprovalPayloadForPersistence(
            existing.companyId,
            body.payload,
            { strictMode: this.strictSecretsMode },
          )
        : body.payload
      : undefined;
    const approval = await this.svc.resubmit(id, normalizedPayload);
    const actorInfo = getActorInfo(req);
    await logActivity(this.db, {
      companyId: approval.companyId,
      actorType: actorInfo.actorType,
      actorId: actorInfo.actorId,
      agentId: actorInfo.agentId,
      action: "approval.resubmitted",
      entityType: "approval",
      entityId: approval.id,
      details: { type: approval.type },
    });
    return res.json(approval);
  }

  @Get("approvals/:id/comments")
  async listComments(
    @Req() req: Request & { actor?: Actor },
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const approval = await this.svc.getById(id);
    if (!approval) {
      return res.status(404).json({ error: "Approval not found" });
    }
    assertWorkspaceAccess(req, approval.companyId);
    const comments = await this.svc.listComments(id);
    return res.json(comments);
  }

  @Post("approvals/:id/comments")
  async addComment(
    @Req() req: Request & { actor?: Actor },
    @Param("id") id: string,
    @Body() body: { body: string },
    @Res() res: Response,
  ) {
    const approval = await this.svc.getById(id);
    if (!approval) {
      return res.status(404).json({ error: "Approval not found" });
    }
    assertWorkspaceAccess(req, approval.companyId);
    const actorInfo = getActorInfo(req);
    const comment = await this.svc.addComment(id, body.body, {
      agentId: actorInfo.agentId ?? undefined,
      userId: actorInfo.actorType === "user" ? actorInfo.actorId : undefined,
    });
    await logActivity(this.db, {
      companyId: approval.companyId,
      actorType: actorInfo.actorType,
      actorId: actorInfo.actorId,
      agentId: actorInfo.agentId,
      action: "approval.comment_added",
      entityType: "approval",
      entityId: approval.id,
      details: { commentId: comment.id },
    });
    return res.status(201).json(comment);
  }
}
