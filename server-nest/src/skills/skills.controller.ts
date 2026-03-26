import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import type { Actor } from "../auth/actor.guard.js";
import { assertWorkspaceAccess, assertInstanceAdmin, getActorInfo } from "../auth/authz.js";
import { DB } from "../db/db.module.js";
import { ActiveSkillService } from "./active-skills.service.js";
import { GlobalSkillService } from "./global-skills.service.js";

/**
 * SkillsController — Tier 1+2 skill management for superadmin and companies.
 *
 * Tier 1 (superadmin) — paths are under `global-skills` so they do not shadow public
 * `GET /api/skills/:name` (bundle bootstrap) on AccessController.
 *   GET    /global-skills                          — list global skills (from server/skills/)
 *   GET    /global-skills/:skillName               — get a global skill entry
 *   POST   /global-skills/sync                     — sync global_skills registry with filesystem
 *
 * Tier 2 (company):
 *   GET    /companies/:companyId/skills              — list all skills for a company
 *   GET    /companies/:companyId/skills/:skillName   — resolve active content for company
 *   PATCH  /companies/:companyId/skills/:skillName  — update company skill content (fork)
 */
@Controller()
export class SkillsController {
  constructor(
    @Inject(GlobalSkillService) private readonly globalSkills: GlobalSkillService,
    @Inject(ActiveSkillService) private readonly activeSkills: ActiveSkillService,
  ) {}

  // ---------------------------------------------------------------------------
  // Tier 1 — Superadmin: Global Skills Registry
  // ---------------------------------------------------------------------------

  /** List all global skills (canonical on-disk skills). */
  @Get("global-skills")
  async listGlobalSkills(@Req() req: Request & { actor?: Actor }) {
    assertInstanceAdmin(req);
    return this.globalSkills.listGlobalSkills();
  }

  /** Get a single global skill entry. */
  @Get("global-skills/:skillName")
  async getGlobalSkill(
    @Req() req: Request & { actor?: Actor },
    @Param("skillName") skillName: string,
  ) {
    assertInstanceAdmin(req);
    return this.globalSkills.getGlobalSkill(skillName);
  }

  /** Sync the global_skills registry with whatever is on disk (server/skills/*.md). */
  @Post("global-skills/sync")
  async syncGlobalSkills(@Req() req: Request & { actor?: Actor }) {
    assertInstanceAdmin(req);
    const entries = await this.globalSkills.listGlobalSkills();
    for (const entry of entries) {
      await this.globalSkills.upsertRegistryEntry(entry.skillName, {
        displayName: entry.displayName,
        description: entry.description,
        isActive: entry.isActive,
      });
    }
    return {
      synced: entries.length,
      skills: entries.map((e) => ({ skillName: e.skillName, contentHash: e.contentHash })),
    };
  }

  // ---------------------------------------------------------------------------
  // Tier 2 — Company: Per-Company Skill Content
  // ---------------------------------------------------------------------------

  /**
   * List all active skills for a company — shows what skill content is available.
   * Returns each skill with its source (db baseline, db candidate, global file).
   */
  @Get("companies/:companyId/skills")
  async listCompanySkills(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
  ) {
    assertWorkspaceAccess(req, companyId);

    // List all global skills and resolve each for this company
    const globalEntries = await this.globalSkills.listGlobalSkills();
    const results = await Promise.allSettled(
      globalEntries.map(async (entry) => {
        const resolved = await this.activeSkills
          .resolveActiveSkill(companyId, entry.skillName)
          .catch(() => null);
        return {
          skillName: entry.skillName,
          displayName: entry.displayName,
          description: entry.description,
          source: resolved?.source ?? "unavailable",
          promptVersionId: resolved?.promptVersionId ?? null,
          isActive: entry.isActive,
        };
      }),
    );

    return results
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<unknown>).value);
  }

  /** Get the active skill content for a specific company + skill. */
  @Get("companies/:companyId/skills/:skillName")
  async getCompanySkill(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("skillName") skillName: string,
  ) {
    assertWorkspaceAccess(req, companyId);
    try {
      return await this.activeSkills.resolveActiveSkill(companyId, skillName);
    } catch {
      throw new NotFoundException(
        `Skill '${skillName}' not found for company ${companyId}`,
      );
    }
  }

  /**
   * Update (fork) a company's skill content — writes to prompt_versions.
   * Creates a new candidate version forked from the current baseline.
   */
  @Patch("companies/:companyId/skills/:skillName")
  async updateCompanySkill(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("skillName") skillName: string,
    @Body() body: {
      content: string;
      mutationType?: "structural" | "instruction" | "examples" | "constraints" | "llm_suggested";
      mutationNotes?: string;
    },
  ) {
    assertWorkspaceAccess(req, companyId);

    // Get current baseline/candidate to use as parent
    const current = await this.activeSkills
      .resolveActiveSkill(companyId, skillName)
      .catch(() => null);
    const parentVersionId = current?.promptVersionId ?? "";

    const candidateId = await this.activeSkills.createCandidate({
      companyId,
      skillName,
      parentVersionId,
      content: body.content,
      mutationType: body.mutationType,
      mutationNotes: body.mutationNotes,
    });

    return { id: candidateId, skillName, status: "candidate", parentVersionId };
  }

  /**
   * Promote a candidate to baseline for a company skill.
   * POST /companies/:companyId/skills/:skillName/promote
   */
  @Post("companies/:companyId/skills/:skillName/promote")
  async promoteCompanySkill(
    @Req() req: Request & { actor?: Actor },
    @Param("companyId") companyId: string,
    @Param("skillName") skillName: string,
    @Body() body: { candidateVersionId: string },
  ) {
    assertWorkspaceAccess(req, companyId);
    await this.activeSkills.promoteCandidate(body.candidateVersionId);
    return { ok: true, skillName, status: "baseline" };
  }
}
