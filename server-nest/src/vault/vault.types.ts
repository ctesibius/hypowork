/**
 * Vault Types - Arscontexta-style shared long-term knowledge
 *
 * Provides structured knowledge storage with:
 * - Claims: Facts and assertions
 * - Skills: Capabilities and procedures
 * - 6R Logs: Reduce, Reflect, Reweave, Verify, Rethink cycle
 * - MOCs: Maps of Content for organizing domains
 */

export interface VaultEntry {
  id: string;
  companyId: string;
  type: VaultEntryType;
  title: string;
  content: string;
  domain?: string;
  tags: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdByAgentId?: string;
  updatedByAgentId?: string;
}

export type VaultEntryType =
  | "claim"      // Factual assertions
  | "skill"      // Capabilities and procedures
  | "6r_log"     // 6R methodology logs
  | "moc"        // Map of Content
  | "note"       // General notes
  | "document";  // Full documents

export interface VaultClaim extends VaultEntry {
  type: "claim";
  confidence: number;  // 0-1
  source?: string;
  evidence?: string[];
}

export interface VaultSkill extends VaultEntry {
  type: "skill";
  category: SkillCategory;
  level?: SkillLevel;
  examples?: string[];
}

export type SkillCategory =
  | "reasoning"
  | "coding"
  | "research"
  | "design"
  | "communication"
  | "operations"
  | "other";

export type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";

export interface Vault6RLog extends VaultEntry {
  type: "6r_log";
  phase: "reduce" | "reflect" | "reweave" | "verify" | "rethink";
  parentClaimId?: string;
  cycleId: string;
  outcome?: string;
}

export interface VaultMOC extends VaultEntry {
  type: "moc";
  children: string[];  // Entry IDs
  parentId?: string;
}

export interface VaultSearchResult {
  entries: VaultEntry[];
  total: number;
  facets?: {
    types: Record<VaultEntryType, number>;
    domains: Record<string, number>;
    tags: Record<string, number>;
  };
}

export interface CreateVaultEntryDto {
  type: VaultEntryType;
  title: string;
  content: string;
  domain?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateVaultEntryDto {
  title?: string;
  content?: string;
  domain?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface VaultQueryDto {
  type?: VaultEntryType;
  domain?: string;
  tags?: string[];
  query?: string;  // Full-text search
  limit?: number;
  offset?: number;
}
