import { Controller, Get, Inject, Param, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import type { Actor } from "../auth/actor.guard.js";
import { assertCompanyAccess } from "../auth/authz.js";
import type { Db } from "@paperclipai/db";
import { costService as expressCostService } from "@paperclipai/server/services/costs";
import { financeService as expressFinanceService } from "@paperclipai/server/services/finance";
import { heartbeatService as expressHeartbeatService } from "@paperclipai/server/services/heartbeat";
import { DB } from "../db/db.module.js";

@Controller()
export class CostsController {
  private readonly costs;
  private readonly finance;

  constructor(@Inject(DB) private readonly db: Db) {
    const heartbeat = expressHeartbeatService(db);
    const budgetHooks = {
      cancelWorkForScope: heartbeat.cancelBudgetScopeWork,
    };
    this.costs = expressCostService(db, budgetHooks);
    this.finance = expressFinanceService(db);
  }

  private parseDateRange(query: Record<string, unknown>) {
    const fromRaw = query.from as string | undefined;
    const toRaw = query.to as string | undefined;
    const from = fromRaw ? new Date(fromRaw) : undefined;
    const to = toRaw ? new Date(toRaw) : undefined;
    return (from || to) ? { from, to } : undefined;
  }

  // GET endpoints only - mutations require additional work

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
