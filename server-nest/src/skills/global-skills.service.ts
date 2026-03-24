import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { readdirSync, readFileSync, existsSync, statSync } from "fs";
import { dirname, extname, join } from "path";
import { createHash } from "crypto";
import { Inject } from "@nestjs/common";
import { DB } from "../db/db.module.js";
import { globalSkills, type Db } from "@paperclipai/db";

export interface GlobalSkillEntry {
  skillName: string;
  displayName: string;
  description: string;
  filePath: string;
  contentHash: string;
  isActive: boolean;
}

/**
 * GlobalSkillService — Tier 1: superadmin-managed canonical skills on disk.
 *
 * Reads from the server/skills/ directory, maintains the global_skills registry
 * for display/admin purposes, and computes content hashes for change detection.
 *
 * The filesystem is the source of truth; global_skills is the registry only.
 */
@Injectable()
export class GlobalSkillService {
  private readonly logger = new Logger(GlobalSkillService.name);

  /** Absolute path to `…/server/skills` (markdown Tier-1 skills). */
  private readonly skillsDir: string;

  constructor(@Inject(DB) private readonly db: Db) {
    this.skillsDir = GlobalSkillService.resolveSkillsDirectory();
  }

  /** Exposed for logs / diagnostics. */
  getSkillsDirectory(): string {
    return this.skillsDir;
  }

  /**
   * `pnpm --filter @hypowork/server-nest dev` uses cwd `…/server-nest`, not repo root.
   * Walk up until we find `server/package.json` (@paperclipai/server), then use `server/skills`.
   */
  private static resolveSkillsDirectory(): string {
    const envRoot = process.env.PAPERCLIP_SERVER_ROOT?.trim();
    if (envRoot) return join(envRoot, "server", "skills");

    let dir = process.cwd();
    for (let i = 0; i < 12; i++) {
      const serverPkg = join(dir, "server", "package.json");
      if (existsSync(serverPkg)) {
        return join(dir, "server", "skills");
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return join(process.cwd(), "server", "skills");
  }

  /** List all .md files in the skills directory. */
  private listSkillFiles(): string[] {
    try {
      return readdirSync(this.skillsDir, { withFileTypes: true })
        .filter((e) => e.isFile() && extname(e.name).toLowerCase() === ".md")
        .map((e) => e.name)
        .sort();
    } catch {
      this.logger.warn(`Skills directory not found: ${this.skillsDir}`);
      return [];
    }
  }

  /** Compute a short content hash for change detection. */
  private contentHash(content: string): string {
    return createHash("sha256").update(content).digest("hex").slice(0, 16);
  }

  /** Read skill content from disk. Returns null if not found. */
  readSkillFile(skillName: string): string | null {
    const normalized = skillName.trim().toLowerCase();
    const filePath = join(this.skillsDir, `${normalized}.md`);
    try {
      if (!existsSync(filePath)) return null;
      const stat = statSync(filePath);
      if (!stat.isFile() || stat.size > 2 * 1024 * 1024) return null; // 2 MB cap
      return readFileSync(filePath, "utf8");
    } catch {
      return null;
    }
  }

  /** List all global skills with their current on-disk content. */
  async listGlobalSkills(): Promise<GlobalSkillEntry[]> {
    const files = this.listSkillFiles();
    if (files.length === 0) return [];

    // Fetch registry rows
    const skillNames = files.map((f) => f.slice(0, -3).toLowerCase());
    const rows = await this.db.query.globalSkills?.findMany({
      where: (gs, { inArray }) => inArray(gs.skillName, skillNames),
    }) ?? [];

    const registry = new Map(rows.map((r) => [r.skillName, r]));

    return files.map((fileName) => {
      const skillName = fileName.slice(0, -3).toLowerCase();
      const filePath = join(this.skillsDir, fileName);
      const content = readFileSync(filePath, "utf8");
      const existing = registry.get(skillName);
      return {
        skillName,
        displayName: existing?.displayName ?? this.humanize(skillName),
        description: existing?.description ?? "",
        filePath,
        contentHash: this.contentHash(content),
        isActive: existing?.isActive ?? true,
      };
    });
  }

  /** Get a single global skill by name. */
  async getGlobalSkill(skillName: string): Promise<GlobalSkillEntry> {
    const content = this.readSkillFile(skillName);
    if (content === null) {
      throw new NotFoundException(`Global skill '${skillName}' not found in ${this.skillsDir}`);
    }

    const existing = await this.db.query.globalSkills?.findFirst({
      where: (gs, { eq }) => eq(gs.skillName, skillName),
    });

    return {
      skillName,
      displayName: existing?.displayName ?? this.humanize(skillName),
      description: existing?.description ?? "",
      filePath: join(this.skillsDir, `${skillName}.md`),
      contentHash: this.contentHash(content),
      isActive: existing?.isActive ?? true,
    };
  }

  /** Upsert a global skill registry entry (metadata only — not content). */
  async upsertRegistryEntry(skillName: string, data: {
    displayName?: string;
    description?: string;
    isActive?: boolean;
  }): Promise<void> {
    const content = this.readSkillFile(skillName);
    if (content === null) {
      throw new NotFoundException(`Skill '${skillName}' not found in ${this.skillsDir}`);
    }

    await this.db
      .insert(globalSkills)
      .values({
        skillName,
        displayName: data.displayName ?? this.humanize(skillName),
        description: data.description ?? "",
        filePath: join(this.skillsDir, `${skillName}.md`),
        contentHash: this.contentHash(content),
        isActive: data.isActive ?? true,
      })
      .onConflictDoUpdate({
        target: [globalSkills.skillName],
        set: {
          displayName: data.displayName ?? this.humanize(skillName),
          description: data.description ?? "",
          contentHash: this.contentHash(content),
          isActive: data.isActive ?? true,
          updatedAt: new Date(),
        },
      });
  }

  /** Convert snake_case or kebab-case to Title Case. */
  private humanize(name: string): string {
    return name
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
