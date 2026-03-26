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

  private static readonly WEIGHT_HUMAN = 0.6;
  private static readonly WEIGHT_SUCCESS = 0.3;
  private static readonly WEIGHT_EFFICIENCY = 0.1;
  private static readonly MIN_SAMPLE_SIZE = 20;
  private static readonly TIME_DECAY_DAYS = 7;
  private static readonly TIME_DECAY_FACTOR = 2;

  /**
   * Composite score per phase-4.md §4.3.1 spec:
   * 0.6 * humanFeedbackScore + 0.3 * automatedSuccessRate + 0.1 * efficiencyScore
   * Human signals from the last TIME_DECAY_DAYS are weighted TIME_DECAY_FACTOR×.
   * Returns null when sample size < MIN_SAMPLE_SIZE (caller should treat as low-confidence).
   */
  computeCompositeScore(
    ratings: { rating: number | null; createdAt: Date }[],
    taskOutcomes: { success: boolean; durationMs: number | null; budgetUsedCents: number | null }[],
  ): { score: number; sampleSize: number; isLowConfidence: boolean } {
    const now = Date.now();
    const decayCutoff = new Date(now - PromptLearningService.TIME_DECAY_DAYS * 86_400_000);

    // Human feedback: time-decay weighted avg rating (1–5 → 0–1)
    let weightedRatingSum = 0;
    let totalWeight = 0;
    for (const r of ratings) {
      if (r.rating == null) continue;
      const recency = r.createdAt >= decayCutoff ? PromptLearningService.TIME_DECAY_FACTOR : 1;
      weightedRatingSum += (r.rating / 5) * recency;
      totalWeight += recency;
    }
    const humanFeedbackScore = totalWeight > 0 ? weightedRatingSum / totalWeight : 0;

    // Automated: task success rate
    const totalCount = taskOutcomes.length;
    const successCount = taskOutcomes.filter((o) => o.success).length;
    const automatedSuccessRate = totalCount > 0 ? successCount / totalCount : 0;

    // Efficiency: speed × budget
    const avgDuration = totalCount > 0
      ? taskOutcomes.reduce((s, o) => s + (o.durationMs ?? 0), 0) / totalCount : 0;
    const avgBudget = totalCount > 0
      ? taskOutcomes.reduce((s, o) => s + (o.budgetUsedCents ?? 0), 0) / totalCount : 0;
    const efficiencyScore = Math.max(0, 1 - avgDuration / 60_000) * Math.max(0, 1 - avgBudget / 10_000);

    const sampleSize = ratings.filter((r) => r.rating != null).length + totalCount;
    const score =
      PromptLearningService.WEIGHT_HUMAN * humanFeedbackScore +
      PromptLearningService.WEIGHT_SUCCESS * automatedSuccessRate +
      PromptLearningService.WEIGHT_EFFICIENCY * efficiencyScore;

    return {
      score: Math.round(score * 100) / 100,
      sampleSize,
      isLowConfidence: sampleSize < PromptLearningService.MIN_SAMPLE_SIZE,
    };
  }

  /**
   * Get aggregated metrics for a prompt version (must belong to `companyId`).
   * Includes lineage (improvementOverParent) and confidence indicator per §4.3.1 spec.
   */
  async getPromptMetrics(
    companyId: string,
    promptVersionId: string,
  ): Promise<{
    avgRating: number;
    responseCount: number;
    thumbsUpRate: number;
    automatedSuccessRate: number;
    efficiencyScore: number;
    compositeScore: number;
    improvementOverParent: number | null;
    confidence: "low" | "high";
    sampleSize: number;
    minSampleSize: number;
    weights: { human: number; success: number; efficiency: number };
    timeDecayDays: number;
  }> {
    const pv = await this.db.query.promptVersions.findFirst({
      where: (p, { eq, and }) => and(eq(p.id, promptVersionId), eq(p.companyId, companyId)),
    });
    if (!pv) {
      throw new NotFoundException("Prompt version not found");
    }

    // Fetch ratings with timestamps for time-decay weighting
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
    const taskOutcomes = await this.db.query.taskOutcomes.findMany({
      where: (to, { eq }) => eq(to.promptVersionId, promptVersionId),
    });

    const successCount = taskOutcomes.filter((o) => o.success).length;
    const automatedSuccessRate = taskOutcomes.length > 0 ? successCount / taskOutcomes.length : 0;
    const avgDuration = taskOutcomes.length > 0
      ? taskOutcomes.reduce((sum, o) => sum + (o.durationMs ?? 0), 0) / taskOutcomes.length
      : 0;
    const avgBudget = taskOutcomes.length > 0
      ? taskOutcomes.reduce((sum, o) => sum + (o.budgetUsedCents ?? 0), 0) / taskOutcomes.length
      : 0;
    const efficiencyScore = Math.max(0, 1 - avgDuration / 60_000) * Math.max(0, 1 - avgBudget / 10_000);

    const { score: compositeScore, sampleSize, isLowConfidence } = this.computeCompositeScore(ratings, taskOutcomes);

    // Fetch parent to compute improvementOverParent
    let improvementOverParent: number | null = null;
    if (pv.parentId) {
      const parent = await this.db.query.promptVersions.findFirst({
        where: (p, { eq }) => eq(p.id, pv.parentId!),
      });
      if (parent?.metrics) {
        const parentScore = parent.metrics.compositeScore ?? 0;
        improvementOverParent = Math.round((compositeScore - parentScore) * 100) / 100;
      }
    }

    return {
      avgRating: Math.round(avgRating * 100) / 100,
      responseCount,
      thumbsUpRate: Math.round(thumbsUpRate * 100) / 100,
      automatedSuccessRate: Math.round(automatedSuccessRate * 100) / 100,
      efficiencyScore: Math.round(efficiencyScore * 100) / 100,
      compositeScore: Math.round(compositeScore * 100) / 100,
      improvementOverParent,
      confidence: isLowConfidence ? "low" : "high",
      sampleSize,
      minSampleSize: PromptLearningService.MIN_SAMPLE_SIZE,
      weights: {
        human: PromptLearningService.WEIGHT_HUMAN,
        success: PromptLearningService.WEIGHT_SUCCESS,
        efficiency: PromptLearningService.WEIGHT_EFFICIENCY,
      },
      timeDecayDays: PromptLearningService.TIME_DECAY_DAYS,
    };
  }

  /**
   * Create a prompt candidate by mutating a parent prompt version.
   * The mutation is applied by the caller (e.g. LLM-assisted mutation layer) —
   * this method handles versioning, lineage, and insertion.
   *
   * Mutation types:
   * - structural  — add/remove/reorder sections
   * - instruction — reword role definitions
   * - examples    — fiddle few-shot examples
   * - constraints — tighten/loosen output format
   * - llm_suggested — caller-provided LLM-proposed change
   */
  async createCandidate(params: {
    companyId: string;
    parentId: string;
    mutationType: "structural" | "instruction" | "examples" | "constraints" | "llm_suggested";
    mutatedContent: string;
    mutationNotes?: string;
  }): Promise<{ id: string; version: number; skillName: string }> {
    const parent = await this.db.query.promptVersions.findFirst({
      where: (p, { eq, and }) => and(eq(p.id, params.parentId), eq(p.companyId, params.companyId)),
    });
    if (!parent) {
      throw new NotFoundException("Parent prompt version not found");
    }

    const id = crypto.randomUUID();
    await this.db.insert(promptVersions).values({
      id,
      companyId: params.companyId,
      skillName: parent.skillName,
      version: parent.version + 1,
      content: params.mutatedContent,
      parentId: params.parentId,
      status: "candidate",
      mutationType: params.mutationType,
      mutationNotes: params.mutationNotes ?? null,
      metrics: {
        avgRating: 0,
        responseCount: 0,
        thumbsUpRate: 0,
        improvementOverParent: 0,
        automatedSuccessRate: 0,
        efficiencyScore: 0,
        compositeScore: 0,
      },
    });

    this.log.log(
      `Created prompt candidate ${id} (v${parent.version + 1}) for skill ${parent.skillName}, parent=${params.parentId}`,
    );
    return { id, version: parent.version + 1, skillName: parent.skillName };
  }

  /**
   * Promote a candidate prompt version to baseline for its skill.
   * Demotes the current baseline for the same company + skill to `candidate`.
   * Computes and stores improvementOverParent from the parent row's metrics.
   */
  async promotePromptVersion(companyId: string, promptVersionId: string): Promise<{ ok: true; skillName: string; improvementOverParent: number | null }> {
    const row = await this.db.query.promptVersions.findFirst({
      where: (p, { eq, and }) => and(eq(p.id, promptVersionId), eq(p.companyId, companyId)),
    });
    if (!row) {
      throw new NotFoundException("Prompt version not found");
    }

    // Compute improvementOverParent from parent's metrics (capture outside transaction scope)
    let improvementOverParent: number | null = null;
    if (row.parentId) {
      const parent = await this.db.query.promptVersions.findFirst({
        where: (p, { eq }) => eq(p.id, row.parentId!),
      });
      if (parent?.metrics?.compositeScore != null) {
        const currentMetrics = await this.getPromptMetrics(companyId, promptVersionId);
        improvementOverParent = Math.round((currentMetrics.compositeScore - parent.metrics.compositeScore) * 100) / 100;
      }
    }

    // Capture latest composite score after metrics are refreshed (for persistence below)
    const currentMetrics = await this.getPromptMetrics(companyId, promptVersionId);

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
        .set({
          status: "baseline",
          evaluatedAt: new Date(),
          metrics: {
            avgRating: row.metrics?.avgRating ?? 0,
            responseCount: row.metrics?.responseCount ?? 0,
            thumbsUpRate: row.metrics?.thumbsUpRate ?? 0,
            improvementOverParent: improvementOverParent ?? 0,
            automatedSuccessRate: row.metrics?.automatedSuccessRate ?? 0,
            efficiencyScore: row.metrics?.efficiencyScore ?? 0,
            compositeScore: currentMetrics.compositeScore,
          },
        })
        .where(eq(promptVersions.id, promptVersionId));
    });

    return { ok: true, skillName: row.skillName, improvementOverParent };
  }
}
