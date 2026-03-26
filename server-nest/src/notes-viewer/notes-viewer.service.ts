import { Inject, Injectable, Logger } from "@nestjs/common";
import { MemoryService } from "../memory/memory.service.js";
import { VaultService } from "../vault/vault.service.js";
import { LearnerService } from "../learner/learner.service.js";
import { DB } from "../db/db.module.js";
import type { Db } from "@paperclipai/db";
import {
  SearchRequest,
  SearchResponse,
  SearchResult,
  SearchSource,
  NoteEntry,
  ProjectMilestone,
  ExperimentHistory,
} from "./notes-viewer.types.js";

/**
 * NotesViewerService - Phase 1.5
 *
 * Provides unified search across Mem0 + Vault + Documents:
 * - Live search with facets
 * - Linked views of notes/claims/docs
 * - Project milestones and experiment history
 */
@Injectable()
export class NotesViewerService {
  private readonly logger = new Logger(NotesViewerService.name);

  constructor(
    private readonly memoryService: MemoryService,
    private readonly vaultService: VaultService,
    private readonly learnerService: LearnerService,
    @Inject(DB) private readonly db: Db,
  ) {}

  /**
   * Unified search across all knowledge sources
   */
  async search(companyId: string, request: SearchRequest): Promise<SearchResponse> {
    const { query, sources = ["memory", "vault", "documents"], limit = 50, offset = 0 } = request;

    const results: SearchResult[] = [];
    const bySource: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byDomain: Record<string, number> = {};

    // Search Mem0 memories
    if (sources.includes("memory")) {
      const memoryResults = await this.memoryService.searchMemories({
        companyId,
        query,
        limit: limit * 2, // Over-fetch to allow filtering
      });

      for (const result of memoryResults.results) {
        const searchResult: SearchResult = {
          id: result.id,
          source: "memory",
          type: result.metadata?.category as string || "memory",
          title: `Memory: ${result.memory.slice(0, 50)}...`,
          excerpt: result.memory.slice(0, 200),
          url: `/memory/${result.id}`,
          score: result.score ?? 0,
          metadata: result.metadata,
        };
        results.push(searchResult);
        bySource["memory"] = (bySource["memory"] || 0) + 1;
        byType[searchResult.type] = (byType[searchResult.type] || 0) + 1;
      }
    }

    // Search Vault entries
    if (sources.includes("vault")) {
      try {
        const vaultResults = await this.vaultService.searchWithMemory(
          companyId,
          query,
          undefined,
          limit * 2,
        );

        for (const entry of vaultResults.vaultEntries) {
          const searchResult: SearchResult = {
            id: entry.id,
            source: "vault",
            type: entry.type,
            title: entry.title,
            excerpt: entry.content.slice(0, 200),
            url: `/vault/${entry.id}`,
            score: 0.9, // Vault results don't have scores in current impl
            metadata: { entryType: entry.type },
          };
          results.push(searchResult);
          bySource["vault"] = (bySource["vault"] || 0) + 1;
          byType[entry.type] = (byType[entry.type] || 0) + 1;
          if (entry.domain) {
            byDomain[entry.domain] = (byDomain[entry.domain] || 0) + 1;
          }
        }
      } catch (error) {
        this.logger.warn(`Vault search failed: ${error}`);
      }
    }

    // TODO: Search documents (when documents API is integrated)
    if (sources.includes("documents")) {
      // Document search would go here
      // For now, skip as it requires documents API integration
    }

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    const total = results.length;

    // Apply pagination
    const paginatedResults = results.slice(offset, offset + limit);

    return {
      results: paginatedResults,
      total,
      facets: {
        bySource: bySource as Record<SearchSource, number>,
        byType,
        byDomain,
      },
      query,
    };
  }

  /**
   * Get all notes for a company (unified view)
   */
  async getAllNotes(companyId: string, limit: number = 100): Promise<NoteEntry[]> {
    const notes: NoteEntry[] = [];

    // Get all memories
    const memories = await this.memoryService.getAllMemories({ companyId, limit });
    for (const memory of memories.results) {
      notes.push({
        id: memory.id,
        source: "memory",
        type: memory.metadata?.category as string || "memory",
        title: memory.memory.slice(0, 50),
        content: memory.memory,
        tags: memory.metadata?.tags as string[] || [],
        createdAt: memory.createdAt || "",
        updatedAt: memory.updatedAt || "",
        url: `/memory/${memory.id}`,
      });
    }

    // Get all vault entries
    try {
      const vaultResult = await this.vaultService.query(companyId, { limit });
      for (const entry of vaultResult.entries) {
        notes.push({
          id: entry.id,
          source: "vault",
          type: entry.type,
          title: entry.title,
          content: entry.content,
          tags: entry.tags,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
          url: `/vault/${entry.id}`,
        });
      }
    } catch (error) {
      this.logger.warn(`Vault query failed: ${error}`);
    }

    // Sort by updated time
    notes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return notes.slice(0, limit);
  }

  /**
   * Get project milestones from recently completed/closed issues with target dates.
   * Completes the Phase 1.5 NotesViewer integration.
   */
  async getProjectMilestones(companyId: string): Promise<ProjectMilestone[]> {
    try {
      const rows = await this.db.query.issues.findMany({
        where: (i, { eq, and, isNotNull }) =>
          and(
            eq(i.companyId, companyId),
            eq(i.status, "done"),
            isNotNull(i.projectId),
          ),
        orderBy: (i, { desc }) => [desc(i.updatedAt)],
        limit: 50,
      });

      return rows
        .filter((r) => r.updatedAt)
        .map((row): ProjectMilestone => ({
          id: row.id,
          title: row.title,
          description: row.description ?? "",
          status: "completed",
          dueDate: row.updatedAt ? row.updatedAt.toISOString() : undefined,
          linkedNotes: [],
        }));
    } catch (error) {
      this.logger.warn(`getProjectMilestones failed: ${error}`);
      return [];
    }
  }

  /**
   * Get experiment history from LearnerService.
   * Completes the Phase 1.5 NotesViewer integration.
   */
  async getExperimentHistory(companyId: string, limit: number = 20): Promise<ExperimentHistory[]> {
    try {
      const experiments = await this.learnerService.listExperiments(companyId, limit);
      return experiments.map((exp): ExperimentHistory => ({
        id: exp.id,
        title: exp.mission.slice(0, 80),
        metric: exp.finalMetric ?? 0,
        status: exp.kept ? "kept" : exp.status === "running" ? "running" : "discarded",
        createdAt: exp.createdAt,
        notes: exp.artifactPath ? `artifact: ${exp.artifactPath}` : undefined,
      }));
    } catch (error) {
      this.logger.warn(`getExperimentHistory failed: ${error}`);
      return [];
    }
  }
}
