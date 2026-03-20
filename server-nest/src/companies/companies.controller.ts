import { Controller, Delete, ForbiddenException, Get, Inject, Param, Patch, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import type { Actor } from "../auth/actor.guard.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "../auth/authz.js";
import type { Db } from "@paperclipai/db";
import { accessService as expressAccessService } from "@paperclipai/server/services/access";
import { budgetService as expressBudgetService } from "@paperclipai/server/services/budgets";
import { companyPortabilityService as expressCompanyPortabilityService } from "@paperclipai/server/services/company-portability";
import { companyService as expressCompanyService } from "@paperclipai/server/services/companies";
import { logActivity } from "@paperclipai/server/services/activity-log";
import { DB } from "../db/db.module.js";

@Controller("companies")
export class CompaniesController {
  private readonly svc;
  private readonly portability;
  private readonly access;
  private readonly budgets;

  constructor(@Inject(DB) private readonly db: Db) {
    this.svc = expressCompanyService(db);
    this.portability = expressCompanyPortabilityService(db);
    this.access = expressAccessService(db);
    this.budgets = expressBudgetService(db);
  }

  @Get()
  async list(@Req() req: Request & { actor?: Actor }) {
    assertBoard(req);
    const actor = req.actor as Actor;
    const result = await this.svc.list();

    if (actor.type !== "board") return result; // defensive; assertBoard should prevent this

    if (actor.source === "local_implicit" || actor.isInstanceAdmin) return result;

    const allowed = new Set(actor.companyIds ?? []);
    return result.filter((company: any) => allowed.has(company.id));
  }

  @Get("stats")
  async stats(@Req() req: Request & { actor?: Actor }) {
    assertBoard(req);
    const actor = req.actor as Actor;
    if (actor.type !== "board") return {};

    const stats = await this.svc.stats();
    if (actor.source === "local_implicit" || actor.isInstanceAdmin) return stats;

    const allowed = new Set(actor.companyIds ?? []);
    return Object.fromEntries(
      Object.entries(stats).filter(([companyId]) => allowed.has(companyId)),
    );
  }

  // Common malformed path when companyId is empty in "/api/companies/{companyId}/issues".
  @Get("issues")
  issues(@Res() res: Response) {
    return res.status(400).json({
      error: "Missing companyId in path. Use /api/companies/{companyId}/issues.",
    });
  }

  @Get(":companyId")
  async getById(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Res() res: Response,
  ) {
    assertBoard(req);
    assertCompanyAccess(req, companyId);

    const company = await this.svc.getById(companyId);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    return res.json(company);
  }

  @Post(":companyId/export")
  async exportCompany(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Res() res: Response,
  ) {
    assertCompanyAccess(req, companyId);
    const result = await this.portability.exportBundle(companyId, req.body as any);
    return res.json(result);
  }

  @Post("import/preview")
  async previewImport(
    @Req() req: Request & { actor?: Actor },
    @Res() res: Response,
  ) {
    const body = req.body as any;
    if (body?.target?.mode === "existing_company") {
      assertCompanyAccess(req, body.target.companyId);
    } else {
      assertBoard(req);
    }
    const preview = await this.portability.previewImport(body);
    return res.json(preview);
  }

  @Post("import")
  async importCompany(
    @Req() req: Request & { actor?: Actor },
    @Res() res: Response,
  ) {
    const body = req.body as any;
    if (body?.target?.mode === "existing_company") {
      assertCompanyAccess(req, body.target.companyId);
    } else {
      assertBoard(req);
    }
    const actor = getActorInfo(req);
    const boardUserId = req.actor?.type === "board" ? req.actor.userId : null;
    const result = await this.portability.importBundle(body, boardUserId);
    await logActivity(this.db, {
      companyId: result.company.id,
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "company.imported",
      entityType: "company",
      entityId: result.company.id,
      agentId: actor.agentId,
      runId: actor.runId,
      details: {
        include: body?.include ?? null,
        agentCount: result.agents.length,
        warningCount: result.warnings.length,
        companyAction: result.company.action,
      },
    });
    return res.json(result);
  }

  @Post()
  async createCompany(
    @Req() req: Request & { actor?: Actor },
    @Res() res: Response,
  ) {
    assertBoard(req);
    const actor = req.actor as Extract<Actor, { type: "board" }>;
    if (!(actor.source === "local_implicit" || actor.isInstanceAdmin)) {
      throw new ForbiddenException("Instance admin required");
    }
    const company = await this.svc.create(req.body as any);
    await this.access.ensureMembership(company.id, "user", actor.userId ?? "local-board", "owner", "active");
    await logActivity(this.db, {
      companyId: company.id,
      actorType: "user",
      actorId: actor.userId ?? "board",
      action: "company.created",
      entityType: "company",
      entityId: company.id,
      details: { name: company.name },
    });
    if (company.budgetMonthlyCents > 0) {
      await this.budgets.upsertPolicy(
        company.id,
        {
          scopeType: "company",
          scopeId: company.id,
          amount: company.budgetMonthlyCents,
          windowKind: "calendar_month_utc",
        },
        actor.userId ?? "board",
      );
    }
    return res.status(201).json(company);
  }

  @Patch(":companyId")
  async updateCompany(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Res() res: Response,
  ) {
    assertBoard(req);
    assertCompanyAccess(req, companyId);
    const company = await this.svc.update(companyId, req.body as any);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    const actor = req.actor as Extract<Actor, { type: "board" }>;
    await logActivity(this.db, {
      companyId,
      actorType: "user",
      actorId: actor.userId ?? "board",
      action: "company.updated",
      entityType: "company",
      entityId: companyId,
      details: req.body as any,
    });
    return res.json(company);
  }

  @Post(":companyId/archive")
  async archiveCompany(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Res() res: Response,
  ) {
    assertBoard(req);
    assertCompanyAccess(req, companyId);
    const company = await this.svc.archive(companyId);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    const actor = req.actor as Extract<Actor, { type: "board" }>;
    await logActivity(this.db, {
      companyId,
      actorType: "user",
      actorId: actor.userId ?? "board",
      action: "company.archived",
      entityType: "company",
      entityId: companyId,
    });
    return res.json(company);
  }

  @Delete(":companyId")
  async deleteCompany(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Res() res: Response,
  ) {
    assertBoard(req);
    assertCompanyAccess(req, companyId);
    const company = await this.svc.remove(companyId);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    return res.json({ ok: true });
  }
}

