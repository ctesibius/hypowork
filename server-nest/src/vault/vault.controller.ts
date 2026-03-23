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
import type {
  VaultEntry,
  VaultSearchResult,
  CreateVaultEntryDto,
  UpdateVaultEntryDto,
  VaultQueryDto,
} from "./vault.types.js";
import { VaultService } from "./vault.service.js";

/**
 * Vault API Controller
 *
 * Provides REST endpoints for:
 * - Creating claims, skills, 6R logs, MOCs
 * - Querying vault entries
 * - Semantic search with memory integration
 */
@Controller("companies/:companyId/vault")
export class VaultController {
  constructor(private readonly vaultService: VaultService) {}

  /**
   * Query vault entries
   * GET /companies/:companyId/vault?type=...&domain=...&tags=...&query=...&limit=...
   */
  @Get()
  async query(
    @Param("companyId") companyId: string,
    @Query() query: VaultQueryDto,
  ): Promise<VaultSearchResult> {
    return this.vaultService.query(companyId, query);
  }

  /**
   * Get a single vault entry
   * GET /companies/:companyId/vault/:entryId
   */
  @Get(":entryId")
  async get(
    @Param("companyId") companyId: string,
    @Param("entryId") entryId: string,
  ): Promise<VaultEntry | null> {
    return this.vaultService.get(companyId, entryId);
  }

  /**
   * Create a vault entry
   * POST /companies/:companyId/vault
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param("companyId") companyId: string,
    @Body() body: CreateVaultEntryDto & { agentId?: string },
  ): Promise<VaultEntry> {
    const { agentId, ...dto } = body;
    return this.vaultService.create(companyId, dto, agentId);
  }

  /**
   * Update a vault entry
   * PATCH /companies/:companyId/vault/:entryId
   */
  @Patch(":entryId")
  async update(
    @Param("companyId") companyId: string,
    @Param("entryId") entryId: string,
    @Body() body: UpdateVaultEntryDto & { agentId?: string },
  ): Promise<VaultEntry | null> {
    const { agentId, ...dto } = body;
    return this.vaultService.update(companyId, entryId, dto, agentId);
  }

  /**
   * Delete a vault entry
   * DELETE /companies/:companyId/vault/:entryId
   */
  @Delete(":entryId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param("companyId") companyId: string,
    @Param("entryId") entryId: string,
  ): Promise<void> {
    await this.vaultService.delete(companyId, entryId);
  }

  /**
   * Search vault with memory integration
   * GET /companies/:companyId/vault/search?query=...&agentId=...&limit=...
   */
  @Get("search/memory")
  async searchWithMemory(
    @Param("companyId") companyId: string,
    @Query("query") query: string,
    @Query("agentId") agentId?: string,
    @Query("limit") limit?: string,
  ): Promise<{ vaultEntries: VaultEntry[]; memoryContext: string }> {
    return this.vaultService.searchWithMemory(
      companyId,
      query,
      agentId,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  /**
   * Create a claim
   * POST /companies/:companyId/vault/claims
   */
  @Post("claims")
  @HttpCode(HttpStatus.CREATED)
  async createClaim(
    @Param("companyId") companyId: string,
    @Body()
    body: CreateVaultEntryDto & {
      confidence: number;
      source?: string;
      evidence?: string[];
      agentId?: string;
    },
  ): Promise<VaultEntry> {
    const { agentId, ...dto } = body;
    return this.vaultService.createClaim(companyId, dto, agentId);
  }

  /**
   * Get all claims
   * GET /companies/:companyId/vault/claims?domain=...
   */
  @Get("claims")
  async getClaims(
    @Param("companyId") companyId: string,
    @Query("domain") domain?: string,
  ) {
    return this.vaultService.getClaims(companyId, domain);
  }

  /**
   * Create a skill
   * POST /companies/:companyId/vault/skills
   */
  @Post("skills")
  @HttpCode(HttpStatus.CREATED)
  async createSkill(
    @Param("companyId") companyId: string,
    @Body()
    body: CreateVaultEntryDto & {
      category: string;
      level?: string;
      examples?: string[];
      agentId?: string;
    },
  ): Promise<VaultEntry> {
    const { agentId, ...dto } = body;
    return this.vaultService.createSkill(companyId, dto, agentId);
  }

  /**
   * Get all skills
   * GET /companies/:companyId/vault/skills?category=...
   */
  @Get("skills")
  async getSkills(
    @Param("companyId") companyId: string,
    @Query("category") category?: string,
  ) {
    return this.vaultService.getSkills(companyId, category);
  }

  /**
   * Run 6R cycle on a claim
   * POST /companies/:companyId/vault/claims/:claimId/6r
   */
  @Post("claims/:claimId/6r")
  @HttpCode(HttpStatus.CREATED)
  async run6RCycle(
    @Param("companyId") companyId: string,
    @Param("claimId") claimId: string,
    @Body()
    body: {
      phases: Array<"reduce" | "reflect" | "reweave" | "verify" | "rethink">;
      agentId?: string;
    },
  ) {
    const { phases, agentId } = body;
    return this.vaultService.run6RCycle(companyId, claimId, phases, agentId);
  }

  /**
   * Create a MOC
   * POST /companies/:companyId/vault/mocs
   */
  @Post("mocs")
  @HttpCode(HttpStatus.CREATED)
  async createMOC(
    @Param("companyId") companyId: string,
    @Body()
    body: CreateVaultEntryDto & {
      children?: string[];
      parentId?: string;
      agentId?: string;
    },
  ): Promise<VaultEntry> {
    const { agentId, ...dto } = body;
    return this.vaultService.createMOC(companyId, dto, agentId);
  }
}
