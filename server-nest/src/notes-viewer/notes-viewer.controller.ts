import {
  Controller,
  Get,
  Param,
  Query,
} from "@nestjs/common";
import type {
  SearchResponse,
  NoteEntry,
  ProjectMilestone,
  ExperimentHistory,
} from "./notes-viewer.types.js";
import type { SearchSource } from "./notes-viewer.types.js";
import { NotesViewerService } from "./notes-viewer.service.js";

/**
 * Notes Viewer API Controller - Phase 1.5
 *
 * Endpoints:
 * - Unified search across Mem0 + Vault + Documents
 * - All notes view
 * - Project milestones
 * - Experiment history
 */
@Controller("companies/:companyId/notes")
export class NotesViewerController {
  constructor(private readonly notesViewerService: NotesViewerService) {}

  /**
   * Unified search
   * GET /companies/:companyId/notes/search?query=...&sources=memory,vault&limit=...
   */
  @Get("search")
  async search(
    @Param("companyId") companyId: string,
    @Query("query") query: string,
    @Query("sources") sources?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ): Promise<SearchResponse> {
    const sourceList = sources
      ? (sources.split(",") as SearchSource[])
      : undefined;

    return this.notesViewerService.search(companyId, {
      query,
      sources: sourceList,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  /**
   * Get all notes
   * GET /companies/:companyId/notes?limit=...
   */
  @Get()
  async getAllNotes(
    @Param("companyId") companyId: string,
    @Query("limit") limit?: string,
  ): Promise<NoteEntry[]> {
    return this.notesViewerService.getAllNotes(
      companyId,
      limit ? parseInt(limit, 10) : 100,
    );
  }

  /**
   * Get project milestones
   * GET /companies/:companyId/notes/milestones
   */
  @Get("milestones")
  async getProjectMilestones(
    @Param("companyId") companyId: string,
  ): Promise<ProjectMilestone[]> {
    return this.notesViewerService.getProjectMilestones(companyId);
  }

  /**
   * Get experiment history
   * GET /companies/:companyId/notes/experiments?limit=...
   */
  @Get("experiments")
  async getExperimentHistory(
    @Param("companyId") companyId: string,
    @Query("limit") limit?: string,
  ): Promise<ExperimentHistory[]> {
    return this.notesViewerService.getExperimentHistory(
      companyId,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
