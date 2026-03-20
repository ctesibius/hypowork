import { Controller, Get, Inject, Param, Req } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import type { Request } from "express";
import type { Actor } from "../auth/actor.guard.js";
import { assertCompanyAccess } from "../auth/authz.js";
import type { Db } from "@paperclipai/db";
import { joinRequests } from "@paperclipai/db";
import { sidebarBadgeService as expressSidebarBadgeService } from "@paperclipai/server/services/sidebar-badges";
import { accessService as expressAccessService } from "@paperclipai/server/services/access";
import { dashboardService as expressDashboardService } from "@paperclipai/server/services/dashboard";
import { DB } from "../db/db.module.js";

@Controller()
export class SidebarBadgesController {
  private readonly svc;
  private readonly access;
  private readonly dashboard;

  constructor(@Inject(DB) private readonly db: Db) {
    this.svc = expressSidebarBadgeService(db);
    this.access = expressAccessService(db);
    this.dashboard = expressDashboardService(db);
  }

  @Get("companies/:companyId/sidebar-badges")
  async getSidebarBadges(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
  ) {
    assertCompanyAccess(req, companyId);
    const actor = req.actor as Actor;

    let canApproveJoins = false;
    if (actor.type === "board") {
      canApproveJoins =
        actor.source === "local_implicit" ||
        Boolean(actor.isInstanceAdmin) ||
        (await this.access.canUser(companyId, actor.userId, "joins:approve"));
    } else if (actor.type === "agent" && actor.agentId) {
      canApproveJoins = await this.access.hasPermission(companyId, "agent", actor.agentId, "joins:approve");
    }

    const joinRequestCount = canApproveJoins
      ? await this.db
        .select({ count: sql<number>`count(*)` })
        .from(joinRequests)
        .where(and(eq(joinRequests.companyId, companyId), eq(joinRequests.status, "pending_approval")))
        .then((rows) => Number(rows[0]?.count ?? 0))
      : 0;

    const badges = await this.svc.get(companyId, {
      joinRequests: joinRequestCount,
    });
    const summary = await this.dashboard.summary(companyId);
    const hasFailedRuns = badges.failedRuns > 0;
    const alertsCount =
      (summary.agents.error > 0 && !hasFailedRuns ? 1 : 0) +
      (summary.costs.monthBudgetCents > 0 && summary.costs.monthUtilizationPercent >= 80 ? 1 : 0);
    badges.inbox = badges.failedRuns + alertsCount + joinRequestCount + badges.approvals;

    return badges;
  }
}
