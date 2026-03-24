import { Injectable, Logger } from "@nestjs/common";
import { MemoryService } from "../memory/memory.service.js";
import {
  VaultEntry,
  VaultEntryType,
  VaultSearchResult,
  CreateVaultEntryDto,
  UpdateVaultEntryDto,
  VaultQueryDto,
  VaultClaim,
  VaultSkill,
  Vault6RLog,
  VaultMOC,
} from "./vault.types.js";

/**
 * VaultService - Arscontexta-style shared long-term knowledge
 *
 * Provides structured knowledge storage with:
 * - Claims: Facts and assertions (with confidence, source, evidence)
 * - Skills: Capabilities and procedures (with category, level)
 * - 6R Logs: Reduce, Reflect, Reweave, Verify, Rethink cycle
 * - MOCs: Maps of Content for organizing domains
 *
 * Integrates with MemoryService for semantic search and
 * provides structured access to company knowledge base.
 */
@Injectable()
export class VaultService {
  private readonly logger = new Logger(VaultService.name);

  // In-memory store for MVP (persisted via company documents)
  private entries: Map<string, VaultEntry[]> = new Map();

  constructor(private readonly memoryService: MemoryService) {}

  /**
   * Create a new vault entry
   */
  async create(
    companyId: string,
    dto: CreateVaultEntryDto,
    agentId?: string,
  ): Promise<VaultEntry> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const entry: VaultEntry = {
      id,
      companyId,
      type: dto.type,
      title: dto.title,
      content: dto.content,
      domain: dto.domain,
      tags: dto.tags ?? [],
      metadata: dto.metadata,
      createdAt: now,
      updatedAt: now,
      createdByAgentId: agentId,
      updatedByAgentId: agentId,
    };

    const entries = this.entries.get(companyId) ?? [];
    entries.push(entry);
    this.entries.set(companyId, entries);

    // Also add to memory for semantic search
    try {
      await this.memoryService.addMemory({
        companyId,
        content: `${dto.title}: ${dto.content}`,
        agentId,
        category: `vault_${dto.type}`,
        tags: [...dto.tags ?? [], `domain:${dto.domain}`],
      });
    } catch (error) {
      this.logger.warn(`Failed to index vault entry in memory: ${error}`);
    }

    this.logger.log(`Created vault entry ${id} for company ${companyId}`);
    return entry;
  }

  /**
   * Update an existing vault entry
   */
  async update(
    companyId: string,
    entryId: string,
    dto: UpdateVaultEntryDto,
    agentId?: string,
  ): Promise<VaultEntry | null> {
    const entries = this.entries.get(companyId) ?? [];
    const idx = entries.findIndex((e) => e.id === entryId);

    if (idx === -1) {
      return null;
    }

    const updated: VaultEntry = {
      ...entries[idx],
      ...dto,
      updatedAt: new Date().toISOString(),
      updatedByAgentId: agentId,
    };

    entries[idx] = updated;
    this.entries.set(companyId, entries);

    this.logger.log(`Updated vault entry ${entryId}`);
    return updated;
  }

  /**
   * Delete a vault entry
   */
  async delete(companyId: string, entryId: string): Promise<boolean> {
    const entries = this.entries.get(companyId) ?? [];
    const filtered = entries.filter((e) => e.id !== entryId);

    if (filtered.length === entries.length) {
      return false;
    }

    this.entries.set(companyId, filtered);
    this.logger.log(`Deleted vault entry ${entryId}`);
    return true;
  }

  /**
   * Get a single vault entry
   */
  async get(companyId: string, entryId: string): Promise<VaultEntry | null> {
    const entries = this.entries.get(companyId) ?? [];
    return entries.find((e) => e.id === entryId) ?? null;
  }

  /**
   * Query vault entries with filters
   */
  async query(
    companyId: string,
    dto: VaultQueryDto,
  ): Promise<VaultSearchResult> {
    let entries = this.entries.get(companyId) ?? [];

    // Apply filters
    if (dto.type) {
      entries = entries.filter((e) => e.type === dto.type);
    }

    if (dto.domain) {
      entries = entries.filter((e) => e.domain === dto.domain);
    }

    if (dto.tags && dto.tags.length > 0) {
      entries = entries.filter((e) =>
        dto.tags!.some((tag) => e.tags.includes(tag)),
      );
    }

    // Full-text search (simple keyword match)
    if (dto.query) {
      const queryLower = dto.query.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.title.toLowerCase().includes(queryLower) ||
          e.content.toLowerCase().includes(queryLower),
      );
    }

    // Calculate facets
    const facets = {
      types: {} as Record<VaultEntryType, number>,
      domains: {} as Record<string, number>,
      tags: {} as Record<string, number>,
    };

    for (const entry of entries) {
      facets.types[entry.type] = (facets.types[entry.type] || 0) + 1;
      if (entry.domain) {
        facets.domains[entry.domain] = (facets.domains[entry.domain] || 0) + 1;
      }
      for (const tag of entry.tags) {
        facets.tags[tag] = (facets.tags[tag] || 0) + 1;
      }
    }

    const total = entries.length;

    // Apply pagination
    const offset = dto.offset ?? 0;
    const limit = dto.limit ?? 50;
    entries = entries.slice(offset, offset + limit);

    return {
      entries,
      total,
      facets,
    };
  }

  /**
   * Search vault using semantic memory
   */
  async searchWithMemory(
    companyId: string,
    query: string,
    agentId?: string,
    limit: number = 10,
  ): Promise<{ vaultEntries: VaultEntry[]; memoryContext: string }> {
    // Search memory
    const memoryResult = await this.memoryService.searchMemories({
      companyId,
      query,
      agentId,
      limit,
    });

    // Get vault entries from memory results
    const entries = this.entries.get(companyId) ?? [];
    const vaultIds = new Set(
      memoryResult.results
        .map((r) => {
          // Try to extract entry ID from metadata
          return r.metadata?.vaultEntryId as string | undefined;
        })
        .filter(Boolean),
    );

    const vaultEntries = entries.filter((e) => vaultIds.has(e.id));

    // Build memory context
    const memoryContext = memoryResult.results
      .map((r) => r.memory)
      .join("\n");

    return { vaultEntries, memoryContext };
  }

  /**
   * Create a claim entry
   */
  async createClaim(
    companyId: string,
    dto: CreateVaultEntryDto & {
      confidence: number;
      source?: string;
      evidence?: string[];
    },
    agentId?: string,
  ): Promise<VaultClaim> {
    const entry = await this.create(companyId, dto, agentId);
    return {
      ...entry,
      type: "claim",
      confidence: dto.confidence,
      source: dto.source,
      evidence: dto.evidence,
    } as VaultClaim;
  }

  /**
   * Create a skill entry
   */
  async createSkill(
    companyId: string,
    dto: CreateVaultEntryDto & {
      category: string;
      level?: string;
      examples?: string[];
    },
    agentId?: string,
  ): Promise<VaultSkill> {
    const entry = await this.create(companyId, dto, agentId);
    return {
      ...entry,
      type: "skill",
      category: dto.category as any,
      level: dto.level as any,
      examples: dto.examples,
    } as VaultSkill;
  }

  /**
   * Create a 6R log entry
   */
  async create6RLog(
    companyId: string,
    dto: CreateVaultEntryDto & {
      phase: "reduce" | "reflect" | "reweave" | "verify" | "rethink";
      parentClaimId?: string;
      cycleId: string;
      outcome?: string;
    },
    agentId?: string,
  ): Promise<Vault6RLog> {
    const entry = await this.create(companyId, dto, agentId);
    return {
      ...entry,
      type: "6r_log",
      phase: dto.phase,
      parentClaimId: dto.parentClaimId,
      cycleId: dto.cycleId,
      outcome: dto.outcome,
    } as Vault6RLog;
  }

  /**
   * Create a MOC (Map of Content)
   */
  async createMOC(
    companyId: string,
    dto: CreateVaultEntryDto & {
      children?: string[];
      parentId?: string;
    },
    agentId?: string,
  ): Promise<VaultMOC> {
    const entry = await this.create(companyId, { ...dto, type: "moc" }, agentId);
    return {
      ...entry,
      type: "moc",
      children: dto.children ?? [],
      parentId: dto.parentId,
    } as VaultMOC;
  }

  /**
   * Get all claims for a domain
   */
  async getClaims(companyId: string, domain?: string): Promise<VaultClaim[]> {
    const result = await this.query(companyId, {
      type: "claim",
      domain,
      limit: 100,
    });
    return result.entries as VaultClaim[];
  }

  /**
   * Get all skills
   */
  async getSkills(companyId: string, category?: string): Promise<VaultSkill[]> {
    const result = await this.query(companyId, {
      type: "skill",
      domain: category,
      limit: 100,
    });
    return result.entries as VaultSkill[];
  }

  /**
   * Run 6R cycle on a claim
   */
  async run6RCycle(
    companyId: string,
    claimId: string,
    phases: Array<"reduce" | "reflect" | "reweave" | "verify" | "rethink">,
    agentId?: string,
  ): Promise<Vault6RLog[]> {
    const claim = await this.get(companyId, claimId);
    if (!claim) {
      throw new Error(`Claim ${claimId} not found`);
    }

    const cycleId = crypto.randomUUID();
    const logs: Vault6RLog[] = [];

    for (const phase of phases) {
      const log = await this.create6RLog(
        companyId,
        {
          type: "6r_log",
          title: `${claim.title} - ${phase}`,
          content: `6R ${phase} analysis of claim: ${claim.content}`,
          phase,
          parentClaimId: claimId,
          cycleId,
        },
        agentId,
      );
      logs.push(log);
    }

    return logs;
  }

  /**
   * Sync canvas topology (nodes + edges) as a Vault note for agents and chat.
   * Idempotent: creates or replaces a note keyed by `canvas-documentId`.
   */
  async syncCanvasTopology(
    companyId: string,
    documentId: string,
    graphJson: string,
    agentId?: string,
  ): Promise<VaultEntry> {
    const domain = "canvas";
    const noteTag = `canvas:${documentId}`;
    const existing = this.entries.get(companyId)?.find(
      (e) => e.type === "note" && e.tags.includes(noteTag),
    );

    let nodeCount = 0;
    let edgeCount = 0;
    try {
      const parsed = JSON.parse(graphJson);
      nodeCount = Array.isArray(parsed.nodes) ? parsed.nodes.length : 0;
      edgeCount = Array.isArray(parsed.edges) ? parsed.edges.length : 0;
    } catch {}

    const title = `Canvas topology — ${documentId.slice(0, 8)}`;
    const content = `Canvas document: ${documentId}\nNodes: ${nodeCount}\nEdges: ${edgeCount}\n\nGraph JSON:\n${graphJson}`;

    if (existing) {
      return this.update(companyId, existing.id, { title, content, tags: [noteTag, "canvas_topology"] }, agentId) as Promise<VaultEntry>;
    }
    return this.create(companyId, {
      type: "note",
      title,
      content,
      domain,
      tags: [noteTag, "canvas_topology"],
    }, agentId);
  }
}
