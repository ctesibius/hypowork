import { Controller, Get, Inject, Param, Post, Query, Req, Res } from "@nestjs/common";
import { z } from "zod";
import type { Request, Response } from "express";
import type { Actor } from "../auth/actor.guard.js";
import { assertBoard, assertWorkspaceAccess } from "../auth/authz.js";
import type { Db } from "@paperclipai/db";
import { activityService as expressActivityService } from "@paperclipai/server/services/activity";
import { issueService as expressIssueService } from "@paperclipai/server/services/issues";
import { sanitizeRecord } from "@paperclipai/server/redaction";
import { DB } from "../db/db.module.js";

const createActivitySchema = z.object({
  actorType: z.enum(["agent", "user", "system"]).optional().default("system"),
  actorId: z.string().min(1),
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  agentId: z.string().uuid().optional().nullable(),
  details: z.record(z.unknown()).optional().nullable(),
});

@Controller()
export class ActivityController {
  private readonly svc;
  private readonly issueSvc;

  constructor(@Inject(DB) private readonly db: Db) {
    this.svc = expressActivityService(db);
    this.issueSvc = expressIssueService(db);
  }

  private async resolveIssueByRef(rawId: string) {
    if (/^[A-Z]+-\d+$/i.test(rawId)) {
      return this.issueSvc.getByIdentifier(rawId);
    }
    return this.issueSvc.getById(rawId);
  }

  @Get("companies/:companyId/activity")
  async listActivity(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Query("agentId") agentId?: string,
    @Query("entityType") entityType?: string,
    @Query("entityId") entityId?: string,
  ) {
    assertWorkspaceAccess(req, companyId);
    const filters = {
      companyId,
      agentId,
      entityType,
      entityId,
    };
    return this.svc.list(filters);
  }

  @Post("companies/:companyId/activity")
  async createActivity(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Res() res: Response,
  ) {
    assertBoard(req);
    const parsed = createActivitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    const event = await this.svc.create({
      companyId,
      ...parsed.data,
      details: parsed.data.details ? sanitizeRecord(parsed.data.details) : null,
    });
    return res.status(201).json(event);
  }

  @Get("issues/:id/activity")
  async getIssueActivity(
    @Req() req: Request & { actor?: Actor },
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const issue = await this.resolveIssueByRef(id);
    if (!issue) {
      return res.status(404).json({ error: "Issue not found" });
    }
    assertWorkspaceAccess(req, issue.companyId);
    const result = await this.svc.forIssue(issue.id);
    return res.json(result);
  }

  @Get("issues/:id/runs")
  async getIssueRuns(
    @Req() req: Request & { actor?: Actor },
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const issue = await this.resolveIssueByRef(id);
    if (!issue) {
      return res.status(404).json({ error: "Issue not found" });
    }
    assertWorkspaceAccess(req, issue.companyId);
    const result = await this.svc.runsForIssue(issue.companyId, issue.id);
    return res.json(result);
  }

  @Get("heartbeat-runs/:runId/issues")
  async getRunIssues(
    @Param("runId") runId: string,
  ) {
    return this.svc.issuesForRun(runId);
  }
}
