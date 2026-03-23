import { Controller, Get, Param, Post, Body, Req } from "@nestjs/common";
import type { Request } from "express";
import type { Actor } from "../auth/actor.guard.js";
import { assertCompanyAccess, getActorInfo } from "../auth/authz.js";
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
    },
  ) {
    assertCompanyAccess(req, companyId);
    const info = getActorInfo(req);

    const id = await this.promptLearningService.recordTaskOutcome({
      companyId,
      agentId: info.agentId ?? info.actorId,
      taskId: body.taskId,
      taskType: body.taskType,
      promptVersionId: body.promptVersionId,
      success: body.success,
      criteriaMet: body.criteriaMet,
      errorOccurred: body.errorOccurred,
      errorType: body.errorType,
      durationMs: body.durationMs,
      budgetUsedCents: body.budgetUsedCents,
      complexityEstimated: body.complexityEstimated,
      complexityActual: body.complexityActual,
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
    assertCompanyAccess(req, companyId);
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
    assertCompanyAccess(req, companyId);
    return this.promptLearningService.getPromptMetrics(promptVersionId);
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
    assertCompanyAccess(req, companyId);
    return this.promptLearningService.promotePromptVersion(companyId, promptVersionId);
  }
}
