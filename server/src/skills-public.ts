/**
 * Public skill HTTP helpers shared by Nest (primary) and legacy Express access routes.
 * Tier: repo bundle skills under skills/<name>/SKILL.md (not server/skills/*.md Tier-1 prompts).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePaperclipSkillsDirEnvValue } from "@paperclipai/adapter-utils/server-utils";

const BUNDLE_SKILL_WHITELIST = new Set([
  "paperclip",
  "paperclip-create-agent",
  "paperclip-create-plugin",
  "para-memory-files",
]);

export interface AvailableSkillEntry {
  name: string;
  description: string;
  isPaperclipManaged: boolean;
}

/** Paths returned by GET /api/skills/index for agent onboarding manifests. */
export function getBootstrapSkillIndexEntries(): { name: string; path: string }[] {
  return [
    { name: "paperclip", path: "/api/skills/paperclip" },
    { name: "para-memory-files", path: "/api/skills/para-memory-files" },
    { name: "paperclip-create-agent", path: "/api/skills/paperclip-create-agent" },
  ];
}

/** Sync resolve: matches adapter-utils order (env → package-relative → monorepo skills/). */
export function resolvePaperclipSkillsRootSync(): string | null {
  const fromEnv = process.env.PAPERCLIP_SKILLS_DIR?.trim();
  if (fromEnv) {
    try {
      const resolved = resolvePaperclipSkillsDirEnvValue(fromEnv, process.cwd());
      if (fs.statSync(resolved).isDirectory()) return resolved;
    } catch {
      /* skip */
    }
  }
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(moduleDir, "../../skills"),
    path.resolve(process.cwd(), "skills"),
    path.resolve(moduleDir, "../../../skills"),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isDirectory()) return candidate;
    } catch {
      /* skip */
    }
  }
  return null;
}

/** Whitelisted bundle SKILL.md content for GET /api/skills/:name (agent bootstrap). */
export function readPaperclipBundleSkillMarkdown(skillName: string): string | null {
  const normalized = skillName.trim().toLowerCase();
  if (!BUNDLE_SKILL_WHITELIST.has(normalized)) return null;
  const root = resolvePaperclipSkillsRootSync();
  if (!root) return null;
  const skillPath = path.join(root, normalized, "SKILL.md");
  try {
    return fs.readFileSync(skillPath, "utf8");
  } catch {
    return null;
  }
}

function parseSkillFrontmatter(markdown: string): { description: string } {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { description: "" };
  const yaml = match[1];
  const descMatch = yaml.match(
    /^description:\s*(?:>\s*\n((?:\s{2,}[^\n]*\n?)+)|[|]\s*\n((?:\s{2,}[^\n]*\n?)+)|["']?(.*?)["']?\s*$)/m,
  );
  if (!descMatch) return { description: "" };
  const raw = descMatch[1] ?? descMatch[2] ?? descMatch[3] ?? "";
  return {
    description: raw
      .split("\n")
      .map((l: string) => l.trim())
      .filter(Boolean)
      .join(" ")
      .trim(),
  };
}

/**
 * GET /api/skills/available — Claude ~/.claude/skills plus repo-managed markers.
 * Same behavior as legacy Express accessRoutes.
 */
export function listSkillsAvailable(): AvailableSkillEntry[] {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  const claudeSkillsDir = path.join(homeDir, ".claude", "skills");
  const paperclipSkillsDir = resolvePaperclipSkillsRootSync();

  const paperclipSkillNames = new Set<string>();
  if (paperclipSkillsDir) {
    try {
      for (const entry of fs.readdirSync(paperclipSkillsDir, { withFileTypes: true })) {
        if (entry.isDirectory()) paperclipSkillNames.add(entry.name);
      }
    } catch {
      /* skip */
    }
  }

  const skills: AvailableSkillEntry[] = [];

  try {
    const entries = fs.readdirSync(claudeSkillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      if (entry.name.startsWith(".")) continue;
      const skillMdPath = path.join(claudeSkillsDir, entry.name, "SKILL.md");
      let description = "";
      try {
        const md = fs.readFileSync(skillMdPath, "utf8");
        description = parseSkillFrontmatter(md).description;
      } catch {
        /* no SKILL.md */
      }
      skills.push({
        name: entry.name,
        description,
        isPaperclipManaged: paperclipSkillNames.has(entry.name),
      });
    }
  } catch {
    /* ~/.claude/skills missing */
  }

  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}
