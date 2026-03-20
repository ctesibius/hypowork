import { Controller, Delete, Get, Inject, Param, Patch, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import type { Actor } from "../auth/actor.guard.js";
import { assertCompanyAccess, getActorInfo } from "../auth/authz.js";
import type { Db } from "@paperclipai/db";
import { goalService as expressGoalService } from "@paperclipai/server/services/goals";
import { logActivity } from "@paperclipai/server/services/activity-log";
import { DB } from "../db/db.module.js";

@Controller()
export class GoalsController {
  private readonly svc;

  constructor(@Inject(DB) private readonly db: Db) {
    this.svc = expressGoalService(db);
  }

  @Get("companies/:companyId/goals")
  async listCompanyGoals(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
  ) {
    assertCompanyAccess(req, companyId);
    return this.svc.list(companyId);
  }

  @Get("goals/:id")
  async getGoal(
    @Req() req: Request & { actor?: Actor },
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const goal = await this.svc.getById(id);
    if (!goal) {
      return res.status(404).json({ error: "Goal not found" });
    }
    assertCompanyAccess(req, goal.companyId);
    return res.json(goal);
  }

  @Post("companies/:companyId/goals")
  async createGoal(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Res() res: Response,
  ) {
    assertCompanyAccess(req, companyId);
    const goal = await this.svc.create(companyId, req.body as any);
    const actor = getActorInfo(req);
    await logActivity(this.db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "goal.created",
      entityType: "goal",
      entityId: goal.id,
      details: { title: goal.title },
    });
    return res.status(201).json(goal);
  }

  @Patch("goals/:id")
  async updateGoal(
    @Req() req: Request & { actor?: Actor },
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const existing = await this.svc.getById(id);
    if (!existing) {
      return res.status(404).json({ error: "Goal not found" });
    }
    assertCompanyAccess(req, existing.companyId);
    const goal = await this.svc.update(id, req.body as any);
    if (!goal) {
      return res.status(404).json({ error: "Goal not found" });
    }
    const actor = getActorInfo(req);
    await logActivity(this.db, {
      companyId: goal.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "goal.updated",
      entityType: "goal",
      entityId: goal.id,
      details: req.body as any,
    });
    return res.json(goal);
  }

  @Delete("goals/:id")
  async deleteGoal(
    @Req() req: Request & { actor?: Actor },
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const existing = await this.svc.getById(id);
    if (!existing) {
      return res.status(404).json({ error: "Goal not found" });
    }
    assertCompanyAccess(req, existing.companyId);
    const goal = await this.svc.remove(id);
    if (!goal) {
      return res.status(404).json({ error: "Goal not found" });
    }
    const actor = getActorInfo(req);
    await logActivity(this.db, {
      companyId: goal.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "goal.deleted",
      entityType: "goal",
      entityId: goal.id,
    });
    return res.json(goal);
  }
}

