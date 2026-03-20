import { Controller, Get, Inject, Param, Req } from "@nestjs/common";
import type { Request } from "express";
import type { Actor } from "../auth/actor.guard.js";
import { assertCompanyAccess } from "../auth/authz.js";
import type { Db } from "@paperclipai/db";
import { dashboardService as expressDashboardService } from "@paperclipai/server/services/dashboard";
import { DB } from "../db/db.module.js";

@Controller()
export class DashboardController {
  private readonly svc;

  constructor(@Inject(DB) private readonly db: Db) {
    this.svc = expressDashboardService(db);
  }

  @Get("companies/:companyId/dashboard")
  async getDashboard(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
  ) {
    assertCompanyAccess(req, companyId);
    return this.svc.summary(companyId);
  }
}
