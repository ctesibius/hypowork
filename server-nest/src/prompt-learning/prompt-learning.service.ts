import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { messageRatings, promptVersions, taskOutcomes } from "@paperclipai/db";
import { DB } from "../db/db.module.js";

/**
 * PromptLearningService - Phase 1.4.1 & 1.6.1
 *
 * Records and aggregates dual-loop feedback signals:
 * - Task outcomes (automated/implicit feedback from agent task executions)
 * - Message ratings (explicit human feedback from chat interactions)
 *
 * Produces composite scores used for prompt version evaluation.
 */
@Injectable()
export class PromptLearningService {
  private readonly log = new Logger(PromptLearningService.name);

  constructor(@Inject(DB) private readonly db: Db) {}

  // ---------------------------------------------------------------------------
  // Task Outcome Recording (automated/implicit feedback)
  // ---------------------------------------------------------------------------

  async recordTaskOutcome(input: {
    companyId: string;
    agentId: string;
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
  }): Promise<string> {
    const id = crypto.randomUUID();

    await this.db.insert(taskOutcomes).values({
      id,
      companyId: input.companyId,
      agentId: input.agentId,
      taskId: input.taskId ?? null,
      taskType: input.taskType,
      promptVersionId: input.promptVersionId ?? null,
      success: input.success,
      criteriaMet: input.criteriaMet,
      errorOccurred: input.errorOccurred,
      errorType: input.errorType ?? null,
      durationMs: input.durationMs ?? null,
      budgetUsedCents: input.budgetUsedCents ?? null,
      complexityEstimated: input.complexityEstimated ?? null,
      complexityActual: input.complexityActual ?? null,
      metadata: input.metadata ?? {},
    });

    this.log.log(
      `Recorded task outcome: taskType=${input.taskType} success=${input.success} taskId=${input.taskId}`,
    );

    return id;
  }

  /**
   * Record outcome from a learner experiment completion.
   */
  async recordExperimentOutcome(
    companyId: string,
    agentId: string,
    experimentId: string,
    promptVersionId: string | undefined,
    success: boolean,
    durationMs?: number,
    budgetUsedCents?: number,
  ): Promise<string> {
    return this.recordTaskOutcome({
      companyId,
      agentId,
      taskId: experimentId,
      taskType: "learner_experiment",
      promptVersionId,
      success,
      criteriaMet: success,
      errorOccurred: !success,
      durationMs,
      budgetUsedCents,
      metadata: { experimentId },
    });
  }

  // ---------------------------------------------------------------------------
  // Rating Recording (explicit human feedback)
  // ---------------------------------------------------------------------------

  async recordMessageRating(input: {
    companyId: string;
    messageId: string;
    userId: string;
    rating?: number;
    thumbsUp?: boolean;
    thumbsDown?: boolean;
    feedbackText?: string;
    aspect?: string;
    promptVersionId?: string;
  }): Promise<string> {
    const id = crypto.randomUUID();

    await this.db.insert(messageRatings).values({
      id,
      companyId: input.companyId,
      messageId: input.messageId,
      userId: input.userId,
      rating: input.rating ?? null,
      /** Schema has `thumbs_up` only; map explicit thumbs-down to `thumbs_up: false`. */
      thumbsUp:
        input.thumbsDown === true ? false : input.thumbsUp !== undefined ? input.thumbsUp : null,
      feedbackText: input.feedbackText ?? null,
      aspect: input.aspect ?? null,
      promptVersionId: input.promptVersionId ?? null,
      metadata: {},
    });

    this.log.log(
      `Recorded message rating: messageId=${input.messageId} rating=${input.rating ?? "thumbs"}`,
    );

    return id;
  }

  // ---------------------------------------------------------------------------
  // Metrics Aggregation
  // ---------------------------------------------------------------------------

  /**
   * Composite score = weighted human (ratings) + automated (task outcomes) signals.
   * Formula: 0.3 * success_rate + 0.7 * efficiency_score (Phase 1 simplified)
   */
  computeCompositeScore(outcomes: {
    successCount: number;
    totalCount: number;
    avgRating?: number;
    avgDurationMs?: number;
    avgBudgetCents?: number;
  }): number {
    const successRate = outcomes.totalCount > 0 ? outcomes.successCount / outcomes.totalCount : 0;
    const ratingScore = outcomes.avgRating !== undefined ? outcomes.avgRating / 5 : 0.5;
    const efficiencyScore = outcomes.avgDurationMs && outcomes.avgBudgetCents
      ? Math.max(0, 1 - outcomes.avgDurationMs / 60000) * Math.max(0, 1 - outcomes.avgBudgetCents / 10000)
      : 0.5;

    return 0.3 * ratingScore + 0.7 * successRate * efficiencyScore;
  }

  /**
   * Get aggregated metrics for a prompt version.
   */
  async getPromptMetrics(promptVersionId: string): Promise<{
    avgRating: number;
    responseCount: number;
    thumbsUpRate: number;
    automatedSuccessRate: number;
    efficiencyScore: number;
    compositeScore: number;
  }> {
    // Fetch ratings for this prompt version
    const ratings = await this.db.query.messageRatings.findMany({
      where: (mr, { eq }) => eq(mr.promptVersionId, promptVersionId),
    });

    const responseCount = ratings.length;
    const avgRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + (r.rating ?? 3), 0) / ratings.length
      : 0;
    const thumbsUpCount = ratings.filter((r) => r.thumbsUp === true).length;
    const thumbsUpRate = ratings.length > 0 ? thumbsUpCount / ratings.length : 0;

    // Fetch task outcomes for this prompt version
    const outcomes = await this.db.query.taskOutcomes.findMany({
      where: (to, { eq }) => eq(to.promptVersionId, promptVersionId),
    });

    const successCount = outcomes.filter((o) => o.success).length;
    const automatedSuccessRate = outcomes.length > 0 ? successCount / outcomes.length : 0;
    const avgDuration = outcomes.length > 0
      ? outcomes.reduce((sum, o) => sum + (o.durationMs ?? 0), 0) / outcomes.length
      : 0;
    const avgBudget = outcomes.length > 0
      ? outcomes.reduce((sum, o) => sum + (o.budgetUsedCents ?? 0), 0) / outcomes.length
      : 0;
    const efficiencyScore = Math.max(0, 1 - avgDuration / 60000) * Math.max(0, 1 - avgBudget / 10000);

    const compositeScore = this.computeCompositeScore({
      successCount,
      totalCount: outcomes.length,
      avgRating,
      avgDurationMs: avgDuration,
      avgBudgetCents: avgBudget,
    });

    return {
      avgRating: Math.round(avgRating * 100) / 100,
      responseCount,
      thumbsUpRate: Math.round(thumbsUpRate * 100) / 100,
      automatedSuccessRate: Math.round(automatedSuccessRate * 100) / 100,
      efficiencyScore: Math.round(efficiencyScore * 100) / 100,
      compositeScore: Math.round(compositeScore * 100) / 100,
    };
  }

  /**
   * Promote a candidate prompt version to baseline for its skill (Phase 1 / 4 bridge).
   * Demotes the current baseline for the same company + skill to `candidate`.
   */
  async promotePromptVersion(companyId: string, promptVersionId: string): Promise<{ ok: true; skillName: string }> {
    const row = await this.db.query.promptVersions.findFirst({
      where: (p, { eq, and }) => and(eq(p.id, promptVersionId), eq(p.companyId, companyId)),
    });
    if (!row) {
      throw new NotFoundException("Prompt version not found");
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(promptVersions)
        .set({ status: "candidate" })
        .where(
          and(
            eq(promptVersions.companyId, companyId),
            eq(promptVersions.skillName, row.skillName),
            eq(promptVersions.status, "baseline"),
          ),
        );

      await tx
        .update(promptVersions)
        .set({ status: "baseline", evaluatedAt: new Date() })
        .where(eq(promptVersions.id, promptVersionId));
    });

    return { ok: true, skillName: row.skillName };
  }
}
