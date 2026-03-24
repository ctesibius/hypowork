import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { and, eq, or, desc } from "drizzle-orm";
import { Inject } from "@nestjs/common";
import { DB } from "../db/db.module.js";
import type { Db } from "@paperclipai/db";
import { promptVersions } from "@paperclipai/db";
import { GlobalSkillService } from "./global-skills.service.js";

export interface ActiveSkillResult {
  skillName: string;
  content: string;
  source: "company_baseline" | "company_candidate" | "global_file";
  promptVersionId: string | null;
}

/**
 * ActiveSkillService — Tier 1+2: DB-first skill resolution with filesystem fallback.
 *
 * Resolution order:
 *  1. prompt_versions WHERE company_id = X AND skill_name = Y AND status IN (baseline, candidate)
 *     → ordered by createdAt DESC, first match wins
 *  2. GlobalSkillService.readSkillFile() — falls back to filesystem Tier 1
 *
 * Deployment:
 *  After any prompt_version change, writes the active content to the workspace
 *  instructions file so adapters (pi-local, claude-local, etc.) pick it up transparently.
 *
 * Company onboarding:
 *  seedCompanySkills() must be called once per new company to fork Tier 1 → Tier 2.
 */
@Injectable()
export class ActiveSkillService {
  private readonly log = new Logger(ActiveSkillService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(GlobalSkillService) private readonly globalSkills: GlobalSkillService,
  ) {}

  // ---------------------------------------------------------------------------
  // Resolution
  // ---------------------------------------------------------------------------

  /**
   * Resolve the active skill content for a company + skill name.
   * Returns source metadata so callers know where the content came from.
   */
  async resolveActiveSkill(
    companyId: string,
    skillName: string,
  ): Promise<ActiveSkillResult> {
    // 1. Company-specific DB row
    const dbRow = await this.db.query.promptVersions?.findFirst({
      where: (pv, { and, eq, or }) =>
        and(
          eq(pv.companyId, companyId),
          eq(pv.skillName, skillName),
          or(
            eq(pv.status, "baseline"),
            eq(pv.status, "candidate"),
          ),
        ),
      orderBy: [desc(promptVersions.createdAt)],
    });

    if (dbRow) {
      this.log.debug(
        `Resolved ${skillName} for company ${companyId}: DB (${dbRow.status})`,
      );
      return {
        skillName,
        content: dbRow.content,
        source: dbRow.status === "baseline" ? "company_baseline" : "company_candidate",
        promptVersionId: dbRow.id,
      };
    }

    // 2. Fallback to Tier 1 filesystem
    const fileContent = this.globalSkills.readSkillFile(skillName);
    if (fileContent !== null) {
      this.log.debug(`Resolved ${skillName} for company ${companyId}: global file`);
      return {
        skillName,
        content: fileContent,
        source: "global_file",
        promptVersionId: null,
      };
    }

    throw new NotFoundException(
      `Skill '${skillName}' not found in company ${companyId} prompt_versions or global skills`,
    );
  }

  /**
   * Shortcut: just get the content string. Falls back to empty string gracefully.
   */
  async getSkillContent(companyId: string, skillName: string): Promise<string> {
    try {
      return (await this.resolveActiveSkill(companyId, skillName)).content;
    } catch {
      return "";
    }
  }

  // ---------------------------------------------------------------------------
  // Onboarding — fork Tier 1 → Tier 2 for a new company
  // ---------------------------------------------------------------------------

  /**
   * Seed all global skills into prompt_versions for a newly onboarded company.
   * Called once per company on account creation.
   *
   * Each skill gets a status=baseline row with content forked from the global file.
   * parent_id is null (root of company's lineage chain).
   */
  async seedCompanySkills(companyId: string): Promise<{ seeded: number; skipped: number }> {
    const globalEntries = await this.globalSkills.listGlobalSkills();
    let seeded = 0;
    let skipped = 0;

    if (globalEntries.length === 0) {
      this.log.warn(
        `No global skills to seed (no .md under ${this.globalSkills.getSkillsDirectory()}). Add files or set PAPERCLIP_SERVER_ROOT.`,
      );
    }

    for (const entry of globalEntries) {
      if (!entry.isActive) { skipped++; continue; }

      // Check if company already has a row for this skill
      const existing = await this.db.query.promptVersions?.findFirst({
        where: (pv, { and, eq }) =>
          and(eq(pv.companyId, companyId), eq(pv.skillName, entry.skillName)),
      });

      if (existing) { skipped++; continue; }

      const content = this.globalSkills.readSkillFile(entry.skillName);
      if (!content) { skipped++; continue; }

      await this.db.insert(promptVersions).values({
        companyId,
        skillName: entry.skillName,
        version: 1,
        content,
        status: "baseline",
        parentId: null,
        mutationType: null,
        mutationNotes: `Forked from global skill at onboarding: ${entry.filePath}`,
      });

      seeded++;
    }

    this.log.log(
      `Seeded ${seeded} global skills for company ${companyId}; ${skipped} skipped (already exist or inactive)`,
    );
    return { seeded, skipped };
  }

  // ---------------------------------------------------------------------------
  // Deployment — write active skill to workspace file
  // ---------------------------------------------------------------------------

  /**
   * Write the active skill content to the workspace instructions file.
   * Called after any prompt_version change (baseline promotion, candidate creation).
   *
   * @param companyId       — company context
   * @param skillName       — e.g. 'nestjs-expert'
   * @param instructionsFilePath — workspace-relative or absolute path from agent config
   * @param cwd             — workspace root for resolving relative paths
   */
  async deployToWorkspace(
    companyId: string,
    skillName: string,
    instructionsFilePath: string,
    cwd: string,
  ): Promise<void> {
    const { content } = await this.resolveActiveSkill(companyId, skillName);
    const { writeFileSync } = await import("fs");

    // Resolve relative paths against workspace cwd
    const { isAbsolute, resolve } = await import("path");
    const filePath = isAbsolute(instructionsFilePath)
      ? instructionsFilePath
      : resolve(cwd, instructionsFilePath);

    try {
      writeFileSync(filePath, content, "utf8");
      this.log.log(
        `Deployed skill '${skillName}' for company ${companyId} → ${filePath}`,
      );
    } catch (err) {
      this.log.error(
        `Failed to write skill '${skillName}' to ${filePath}: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Mutation helpers (for LearnerService)
  // ---------------------------------------------------------------------------

  /** Create a candidate mutation forked from a parent version. */
  async createCandidate(params: {
    companyId: string;
    skillName: string;
    parentVersionId: string;
    content: string;
    mutationType?: "structural" | "instruction" | "examples" | "constraints" | "llm_suggested";
    mutationNotes?: string;
  }): Promise<string> {
    const id = crypto.randomUUID();

    // Fetch parent to get version number
    const parent = await this.db.query.promptVersions?.findFirst({
      where: (pv, { eq }) => eq(pv.id, params.parentVersionId),
    });
    const nextVersion = parent ? parent.version + 1 : 1;

    await this.db.insert(promptVersions).values({
      id,
      companyId: params.companyId,
      skillName: params.skillName,
      version: nextVersion,
      content: params.content,
      status: "candidate",
      parentId: params.parentVersionId,
      mutationType: params.mutationType ?? null,
      mutationNotes: params.mutationNotes ?? null,
    });

    this.log.log(
      `Created candidate ${id} (v${nextVersion}) for skill '${params.skillName}' company ${params.companyId}`,
    );
    return id;
  }

  /** Promote a candidate to baseline for its company + skill. */
  async promoteCandidate(candidateVersionId: string): Promise<void> {
    const candidate = await this.db.query.promptVersions?.findFirst({
      where: (pv, { eq }) => eq(pv.id, candidateVersionId),
    });
    if (!candidate) throw new NotFoundException("Candidate version not found");

    // Demote current baseline to 'candidate' — it stays in history
    await this.db
      .update(promptVersions)
      .set({ status: "candidate", evaluatedAt: new Date() })
      .where(
        and(
          eq(promptVersions.companyId, candidate.companyId),
          eq(promptVersions.skillName, candidate.skillName),
          eq(promptVersions.status, "baseline"),
        ),
      );

    // Promote candidate to 'baseline'
    await this.db
      .update(promptVersions)
      .set({ status: "baseline", evaluatedAt: new Date() })
      .where(eq(promptVersions.id, candidateVersionId));

    this.log.log(
      `Promoted candidate ${candidateVersionId} to baseline for '${candidate.skillName}' company ${candidate.companyId}`,
    );
  }
}
