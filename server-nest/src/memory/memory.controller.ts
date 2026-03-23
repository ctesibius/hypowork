import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { MemoryService } from "./memory.service.js";
import type {
  MemorySearchResponse,
  MemoryAddResponse,
  AddMemoryDto,
  UpdateMemoryDto,
} from "./memory.types.js";

/**
 * Memory API Controller
 *
 * Provides REST endpoints for:
 * - Searching memories (company-wide or agent-scoped)
 * - Adding memories
 * - Updating memories
 * - Deleting memories
 * - Getting agent context for wake events
 */
@Controller("companies/:companyId/memory")
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  /**
   * Search memories
   * GET /companies/:companyId/memory/search?query=...&agentId=...&limit=...
   */
  @Get("search")
  async searchMemories(
    @Param("companyId") companyId: string,
    @Query("query") query: string,
    @Query("agentId") agentId?: string,
    @Query("userId") userId?: string,
    @Query("limit") limit?: string,
    /** Optional substring filter applied after vector search (Phase 1.3 keyword pass). */
    @Query("keyword") keyword?: string,
  ): Promise<MemorySearchResponse> {
    if (!query) {
      return { results: [] };
    }

    return this.memoryService.searchMemories({
      companyId,
      query,
      agentId,
      userId,
      limit: limit ? parseInt(limit, 10) : undefined,
      keyword,
    });
  }

  /**
   * Get all memories for a company
   * GET /companies/:companyId/memory?agentId=...&limit=...
   */
  @Get()
  async getAllMemories(
    @Param("companyId") companyId: string,
    @Query("agentId") agentId?: string,
    @Query("userId") userId?: string,
    @Query("limit") limit?: string,
  ): Promise<MemorySearchResponse> {
    return this.memoryService.getAllMemories({
      companyId,
      agentId,
      userId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * Add a memory entry
   * POST /companies/:companyId/memory
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async addMemory(
    @Param("companyId") companyId: string,
    @Body() body: AddMemoryDto & { agentId?: string; userId?: string; category?: string; tags?: string[] },
  ): Promise<MemoryAddResponse> {
    return this.memoryService.addMemory({
      companyId,
      content: body.content,
      agentId: body.agentId,
      userId: body.userId,
      category: body.category,
      tags: body.tags,
    });
  }

  /**
   * Update a memory entry
   * PATCH /companies/:companyId/memory/:memoryId
   */
  @Patch(":memoryId")
  async updateMemory(
    @Param("companyId") companyId: string,
    @Param("memoryId") memoryId: string,
    @Body() body: UpdateMemoryDto,
  ): Promise<MemoryAddResponse> {
    return this.memoryService.updateMemory({
      companyId,
      memoryId,
      content: body.content,
    });
  }

  /**
   * Delete a memory entry
   * DELETE /companies/:companyId/memory/:memoryId
   */
  @Delete(":memoryId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMemory(
    @Param("companyId") companyId: string,
    @Param("memoryId") memoryId: string,
  ): Promise<void> {
    await this.memoryService.deleteMemory({ companyId, memoryId });
  }

  /**
   * Get memory context for an agent (for wake context)
   * GET /companies/:companyId/memory/agent-context?agentId=...&query=...&limit=...
   */
  @Get("agent-context")
  async getAgentContext(
    @Param("companyId") companyId: string,
    @Query("agentId") agentId: string,
    @Query("query") query?: string,
    @Query("limit") limit?: string,
  ): Promise<{ context: string }> {
    const context = await this.memoryService.getAgentContext({
      companyId,
      agentId,
      query,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { context };
  }

  /**
   * Add memories from agent session
   * POST /companies/:companyId/memory/from-session
   */
  @Post("from-session")
  @HttpCode(HttpStatus.CREATED)
  async addFromSession(
    @Param("companyId") companyId: string,
    @Body()
    body: {
      agentId: string;
      sessionId: string;
      messages: Array<{ role: string; content: string }>;
    },
  ): Promise<MemoryAddResponse> {
    return this.memoryService.addFromAgentSession({
      companyId,
      agentId: body.agentId,
      sessionId: body.sessionId,
      messages: body.messages,
    });
  }
}
