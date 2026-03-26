import { BadRequestException, Controller, Get, Param, Post, Body, Req } from "@nestjs/common";
import type { Request } from "express";
import type { Actor } from "../auth/actor.guard.js";
import { assertWorkspaceAccess, getActorInfo } from "../auth/authz.js";
import { PromptLearningService } from "./prompt-learning.service.js";

@Controller("companies/:companyId")
export class PromptLearningController {
  constructor(private readonly promptLearningService: PromptLearningService) {}

  /**
   * Record a task outcome (automated/implicit feedback).
   * Called by heartbeat/agent runtime after task completion.
   */
  @Post("task-outcomes")
  async recordTaskOutcome(
    @Param("companyId") companyId: string,
    @Req() req: Request & { actor?: Actor },
    @Body() body: {
      taskId?: string;
      taskType: string;
      promptVersionId?: string;
      success: boolean;
      criteriaMet: boolean;
      errorOccurred: boolean;
      errorType?: string;
      durationMs?: number;
      budgetUsedCents?: number;
      complexityEstimated?: number;
      complexityActual?: number;
      metadata?: Record<string, unknown>;
    },
  ) {
    assertWorkspaceAccess(req, companyId);
    const info = getActorInfo(req);
    if (typeof body.taskType !== "string" || !body.taskType.trim()) {
      throw new BadRequestException("taskType is required");
    }

    const id = await this.promptLearningService.recordTaskOutcome({
      companyId,
      agentId: info.agentId ?? info.actorId,
      taskId: body.taskId,
      taskType: body.taskType.trim(),
      promptVersionId: body.promptVersionId,
      success: body.success,
      criteriaMet: body.criteriaMet,
      errorOccurred: body.errorOccurred,
      errorType: body.errorType,
      durationMs: body.durationMs,
      budgetUsedCents: body.budgetUsedCents,
      complexityEstimated: body.complexityEstimated,
      complexityActual: body.complexityActual,
      metadata: body.metadata,
    });

    return { id };
  }

  /**
   * Record a message rating (explicit human feedback).
   * Called by ChatService after user rates a response.
   */
  @Post("messages/:messageId/rate")
  async recordRating(
    @Param("companyId") companyId: string,
    @Param("messageId") messageId: string,
    @Req() req: Request & { actor?: Actor },
    @Body() body: {
      rating?: number;
      thumbsUp?: boolean;
      thumbsDown?: boolean;
      feedbackText?: string;
      aspect?: string;
      promptVersionId?: string;
    },
  ) {
    assertWorkspaceAccess(req, companyId);
    const { actorId } = getActorInfo(req);

    const id = await this.promptLearningService.recordMessageRating({
      companyId,
      messageId,
      userId: actorId,
      rating: body.rating,
      thumbsUp: body.thumbsUp,
      thumbsDown: body.thumbsDown,
      feedbackText: body.feedbackText,
      aspect: body.aspect,
      promptVersionId: body.promptVersionId,
    });

    return { id };
  }

  /**
   * Get aggregated metrics for a prompt version.
   */
  @Get("prompt-versions/:promptVersionId/metrics")
  async getPromptMetrics(
    @Param("companyId") companyId: string,
    @Req() req: Request & { actor?: Actor },
    @Param("promptVersionId") promptVersionId: string,
  ) {
    assertWorkspaceAccess(req, companyId);
    return this.promptLearningService.getPromptMetrics(companyId, promptVersionId);
  }

  /**
   * Promote a prompt version to baseline for its skill (dual-loop evolution).
   * POST /companies/:companyId/prompt-versions/:promptVersionId/promote
   */
  @Post("prompt-versions/:promptVersionId/promote")
  async promotePromptVersion(
    @Param("companyId") companyId: string,
    @Req() req: Request & { actor?: Actor },
    @Param("promptVersionId") promptVersionId: string,
  ) {
    assertWorkspaceAccess(req, companyId);
    return this.promptLearningService.promotePromptVersion(companyId, promptVersionId);
  }

  /**
   * Create a prompt candidate by mutating a parent prompt version.
   * POST /companies/:companyId/prompt-versions
   */
  @Post("prompt-versions")
  async createCandidate(
    @Param("companyId") companyId: string,
    @Req() req: Request & { actor?: Actor },
    @Body()
    body: {
      parentId: string;
      mutationType: "structural" | "instruction" | "examples" | "constraints" | "llm_suggested";
      mutatedContent: string;
      mutationNotes?: string;
    },
  ) {
    assertWorkspaceAccess(req, companyId);
    if (!body.parentId?.trim()) throw new BadRequestException("parentId is required");
    if (!body.mutatedContent?.trim()) throw new BadRequestException("mutatedContent is required");
    if (!body.mutationType) throw new BadRequestException("mutationType is required");

    return this.promptLearningService.createCandidate({
      companyId,
      parentId: body.parentId,
      mutationType: body.mutationType,
      mutatedContent: body.mutatedContent,
      mutationNotes: body.mutationNotes,
    });
  }
}
