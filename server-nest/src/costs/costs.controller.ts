import { Controller, Get, Inject, Param, Patch, Post, Query, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import type { Actor } from "../auth/actor.guard.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "../auth/authz.js";
import type { Db } from "@paperclipai/db";
import { createCostEventSchema, updateBudgetSchema } from "@paperclipai/shared";
import { agentService as expressAgentService } from "@paperclipai/server/services/agents";
import { companyService as expressCompanyService } from "@paperclipai/server/services/companies";
import { costService as expressCostService } from "@paperclipai/server/services/costs";
import { financeService as expressFinanceService } from "@paperclipai/server/services/finance";
import { heartbeatService as expressHeartbeatService } from "@paperclipai/server/services/heartbeat";
import { logActivity } from "@paperclipai/server/services/activity-log";
import { DB } from "../db/db.module.js";

@Controller()
export class CostsController {
  private readonly costs;
  private readonly finance;
  private readonly companies;
  private readonly agents;

  constructor(@Inject(DB) private readonly db: Db) {
    const heartbeat = expressHeartbeatService(db);
    const budgetHooks = {
      cancelWorkForScope: heartbeat.cancelBudgetScopeWork,
    };
    this.costs = expressCostService(db, budgetHooks);
    this.finance = expressFinanceService(db);
    this.companies = expressCompanyService(db);
    this.agents = expressAgentService(db);
  }

  private parseDateRange(query: Record<string, unknown>) {
    const fromRaw = query.from as string | undefined;
    const toRaw = query.to as string | undefined;
    const from = fromRaw ? new Date(fromRaw) : undefined;
    const to = toRaw ? new Date(toRaw) : undefined;
    return (from || to) ? { from, to } : undefined;
  }

  @Post("companies/:companyId/cost-events")
  async postCostEvent(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Res() res: Response,
  ) {
    assertCompanyAccess(req, companyId);
    const body = createCostEventSchema.parse(req.body ?? {});
    if (req.actor?.type === "agent" && req.actor.agentId !== body.agentId) {
      return res.status(403).json({ error: "Agent can only report its own costs" });
    }
    const event = await this.costs.createEvent(companyId, {
      ...body,
      occurredAt: new Date(body.occurredAt),
    });
    const actor = getActorInfo(req);
    await logActivity(this.db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "cost.reported",
      entityType: "cost_event",
      entityId: event.id,
      details: { costCents: event.costCents, model: event.model },
    });
    return res.status(201).json(event);
  }

  @Patch("companies/:companyId/budgets")
  async patchCompanyBudget(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Res() res: Response,
  ) {
    assertBoard(req);
    const body = updateBudgetSchema.parse(req.body ?? {});
    const company = await this.companies.update(companyId, { budgetMonthlyCents: body.budgetMonthlyCents });
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    await logActivity(this.db, {
      companyId,
      actorType: "user",
      actorId: req.actor?.type === "board" ? req.actor.userId ?? "board" : "board",
      action: "company.budget_updated",
      entityType: "company",
      entityId: companyId,
      details: { budgetMonthlyCents: body.budgetMonthlyCents },
    });
    return res.json(company);
  }

  @Patch("agents/:agentId/budgets")
  async patchAgentBudget(
    @Req() req: Request & { actor?: Actor },
    @Param("agentId") agentId: string,
    @Res() res: Response,
  ) {
    const agent = await this.agents.getById(agentId);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }
    if (req.actor?.type === "agent" && req.actor.agentId !== agentId) {
      return res.status(403).json({ error: "Agent can only change its own budget" });
    }
    const body = updateBudgetSchema.parse(req.body ?? {});
    const updated = await this.agents.update(agentId, { budgetMonthlyCents: body.budgetMonthlyCents });
    if (!updated) {
      return res.status(404).json({ error: "Agent not found" });
    }
    const actor = getActorInfo(req);
    await logActivity(this.db, {
      companyId: updated.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "agent.budget_updated",
      entityType: "agent",
      entityId: updated.id,
      details: { budgetMonthlyCents: updated.budgetMonthlyCents },
    });
    return res.json(updated);
  }

  @Get("companies/:companyId/costs/summary")
  async getCostsSummary(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Query() query: Record<string, unknown>,
  ) {
    assertCompanyAccess(req, companyId);
    const range = this.parseDateRange(query);
    return this.costs.summary(companyId, range);
  }

  @Get("companies/:companyId/costs/by-agent")
  async getCostsByAgent(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Query() query: Record<string, unknown>,
  ) {
    assertCompanyAccess(req, companyId);
    const range = this.parseDateRange(query);
    return this.costs.byAgent(companyId, range);
  }

  @Get("companies/:companyId/costs/by-agent-model")
  async getCostsByAgentModel(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Query() query: Record<string, unknown>,
  ) {
    assertCompanyAccess(req, companyId);
    const range = this.parseDateRange(query);
    return this.costs.byAgentModel(companyId, range);
  }

  @Get("companies/:companyId/costs/by-provider")
  async getCostsByProvider(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Query() query: Record<string, unknown>,
  ) {
    assertCompanyAccess(req, companyId);
    const range = this.parseDateRange(query);
    return this.costs.byProvider(companyId, range);
  }

  @Get("companies/:companyId/costs/by-biller")
  async getCostsByBiller(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Query() query: Record<string, unknown>,
  ) {
    assertCompanyAccess(req, companyId);
    const range = this.parseDateRange(query);
    return this.costs.byBiller(companyId, range);
  }

  @Get("companies/:companyId/costs/finance-summary")
  async getFinanceSummary(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Query() query: Record<string, unknown>,
  ) {
    assertCompanyAccess(req, companyId);
    const range = this.parseDateRange(query);
    return this.finance.summary(companyId, range);
  }

  @Get("companies/:companyId/costs/finance-by-biller")
  async getFinanceByBiller(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Query() query: Record<string, unknown>,
  ) {
    assertCompanyAccess(req, companyId);
    const range = this.parseDateRange(query);
    return this.finance.byBiller(companyId, range);
  }

  @Get("companies/:companyId/costs/finance-by-kind")
  async getFinanceByKind(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Query() query: Record<string, unknown>,
  ) {
    assertCompanyAccess(req, companyId);
    const range = this.parseDateRange(query);
    return this.finance.byKind(companyId, range);
  }

  @Get("companies/:companyId/costs/finance-events")
  async getFinanceEvents(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Query() query: Record<string, unknown>,
  ) {
    assertCompanyAccess(req, companyId);
    const range = this.parseDateRange(query);
    const limit = query.limit ? Number(query.limit) : 100;
    return this.finance.list(companyId, range, limit);
  }

  @Get("companies/:companyId/costs/window-spend")
  async getWindowSpend(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
  ) {
    assertCompanyAccess(req, companyId);
    return this.costs.windowSpend(companyId);
  }

  // TODO: quota-windows, budgets/overview, budgets/policies - require more work

  @Get("companies/:companyId/costs/by-project")
  async getCostsByProject(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Query() query: Record<string, unknown>,
  ) {
    assertCompanyAccess(req, companyId);
    const range = this.parseDateRange(query);
    return this.costs.byProject(companyId, range);
  }
}
