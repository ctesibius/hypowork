import { Injectable, Logger } from "@nestjs/common";
import { MemoryService } from "../memory/memory.service.js";
import { VaultService } from "../vault/vault.service.js";
import { PromptLearningService } from "../prompt-learning/prompt-learning.service.js";
import {
  LearnerExperiment,
  LearnerIteration,
  LearnerConfig,
  MetricResult,
  ExperimentStatus,
  CreateExperimentDto,
} from "./learner.types.js";

/**
 * LearnerService - Phase 1.4: Autoresearch-style loop
 *
 * Implements the metric → edit → run → keep/discard cycle:
 * - Learner/Researcher agent reads mission from issue
 * - Edits a single artifact
 * - Runs eval with budget (e.g., 5-min)
 * - Parses metric
 * - Keeps or discards based on result
 * - Reports summaries as issue comments or new issues
 */
@Injectable()
export class LearnerService {
  private readonly logger = new Logger(LearnerService.name);

  // In-memory store for experiments (persisted via DB in production)
  private experiments: Map<string, LearnerExperiment[]> = new Map();

  // Default configuration
  private readonly defaultConfig: LearnerConfig = {
    maxIterations: 10,
    maxBudgetMinutes: 5,
    metricThresholds: {
      accuracy: 0.8,
      performance: 0.7,
      quality: 0.75,
    },
    keepThreshold: 0.6,
  };

  constructor(
    private readonly memoryService: MemoryService,
    private readonly vaultService: VaultService,
    private readonly promptLearningService: PromptLearningService,
  ) {}

  /**
   * Create a new learning experiment
   */
  async createExperiment(dto: CreateExperimentDto): Promise<LearnerExperiment> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const experiment: LearnerExperiment = {
      id,
      companyId: dto.companyId,
      agentId: dto.agentId,
      issueId: dto.issueId,
      mission: dto.mission,
      artifactPath: dto.artifactPath,
      status: "pending",
      iterations: [],
      createdAt: now,
      updatedAt: now,
      kept: false,
    };

    const experiments = this.experiments.get(dto.companyId) ?? [];
    experiments.push(experiment);
    this.experiments.set(dto.companyId, experiments);

    this.logger.log(`Created learner experiment ${id} for issue ${dto.issueId}`);

    // Index the mission in memory for context
    await this.memoryService.addMemory({
      companyId: dto.companyId,
      content: `Learner mission: ${dto.mission}`,
      agentId: dto.agentId,
      category: "learner_mission",
    });

    return experiment;
  }

  /**
   * Run an iteration of the learning loop
   */
  async runIteration(
    companyId: string,
    experimentId: string,
    artifactContent: string,
  ): Promise<LearnerIteration> {
    const experiments = this.experiments.get(companyId) ?? [];
    const exp = experiments.find((e) => e.id === experimentId);

    if (!exp) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    if (exp.status === "completed" || exp.status === "failed") {
      throw new Error(`Experiment ${experimentId} is already ${exp.status}`);
    }

    const iterationNumber = exp.iterations.length + 1;
    const now = new Date().toISOString();

    // Update experiment status
    exp.status = "running";
    exp.updatedAt = now;

    // Evaluate the artifact (simulated for MVP)
    const metricResult = await this.evaluateArtifact(artifactContent, exp.mission);

    // Decide whether to keep this iteration
    const keep = metricResult.passed && metricResult.value >= this.defaultConfig.keepThreshold;

    const iteration: LearnerIteration = {
      iterationNumber,
      artifactContent,
      metricResult,
      keep,
      createdAt: now,
    };

    exp.iterations.push(iteration);

    // Check if experiment should end
    if (!keep || iterationNumber >= this.defaultConfig.maxIterations) {
      exp.status = "completed";
      exp.finalMetric = metricResult.value;
      exp.kept = keep;

      // Record task outcome for dual-loop learning
      await this.promptLearningService.recordExperimentOutcome(
        companyId,
        exp.agentId,
        experimentId,
        undefined,
        keep,
      );

      if (keep) {
        await this.memoryService.addMemory({
          companyId,
          content: `Learner kept artifact with metric ${metricResult.value}: ${artifactContent.slice(0, 100)}...`,
          agentId: exp.agentId,
          category: "learner_best",
        });
        await this.vaultService.create(companyId, {
          type: "note",
          title: `Learner lesson · ${exp.mission.slice(0, 72)}${exp.mission.length > 72 ? "…" : ""}`,
          content: `Experiment **${experimentId}** kept (metric **${metricResult.value.toFixed(3)}**).\n\n## Mission\n${exp.mission}\n\n## Artifact excerpt\n${artifactContent.slice(0, 4000)}`,
          tags: ["learner", "lesson", `experiment:${experimentId}`, `issue:${exp.issueId}`],
        });
      }
    }

    exp.updatedAt = new Date().toISOString();

    this.logger.log(
      `Experiment ${experimentId} iteration ${iterationNumber}: metric=${metricResult.value}, keep=${keep}`,
    );

    return iteration;
  }

  /**
   * Evaluate artifact against mission
   * In production, this would run actual tests/evals
   */
  private async evaluateArtifact(
    artifactContent: string,
    mission: string,
  ): Promise<MetricResult> {
    // For MVP, simulate evaluation
    // In production, this would:
    // - Run actual code/tests
    // - Measure performance
    // - Check quality metrics

    const mockMetrics = this.generateMockMetrics(artifactContent, mission);

    const primaryMetric = mockMetrics[0];
    const threshold = this.defaultConfig.metricThresholds[primaryMetric.name] ?? 0.7;

    return {
      ...primaryMetric,
      threshold,
      passed: primaryMetric.value >= threshold,
      details: `Evaluated artifact against mission: ${mission.slice(0, 50)}...`,
    };
  }

  /**
   * Generate mock metrics for MVP
   * In production, replace with actual evaluation logic
   */
  private generateMockMetrics(
    artifactContent: string,
    mission: string,
  ): MetricResult[] {
    // Simulate metrics based on content characteristics
    const length = artifactContent.length;
    const hasStructure = /```|^#|\n\n/.test(artifactContent);
    const hasKeywords = /function|class|import|export|const|let|var/.test(artifactContent);

    // Generate a mock accuracy metric
    const accuracy = Math.min(0.99, 0.5 + Math.random() * 0.4 + (hasStructure ? 0.1 : 0) + (hasKeywords ? 0.1 : 0));

    // Generate a mock quality metric
    const quality = Math.min(0.99, 0.4 + Math.random() * 0.5 + (length > 100 ? 0.15 : 0));

    return [
      { name: "accuracy", value: accuracy, threshold: 0.7, passed: accuracy >= 0.7 },
      { name: "quality", value: quality, threshold: 0.75, passed: quality >= 0.75 },
    ];
  }

  /**
   * Get experiment by ID
   */
  async getExperiment(companyId: string, experimentId: string): Promise<LearnerExperiment | null> {
    const experiments = this.experiments.get(companyId) ?? [];
    return experiments.find((e) => e.id === experimentId) ?? null;
  }

  /**
   * List experiments for a company
   */
  async listExperiments(companyId: string, limit: number = 20): Promise<LearnerExperiment[]> {
    const experiments = this.experiments.get(companyId) ?? [];
    return experiments
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
  }

  /**
   * Generate experiment summary for board reporting
   */
  async generateSummary(companyId: string, experimentId: string): Promise<string> {
    const exp = await this.getExperiment(companyId, experimentId);
    if (!exp) {
      return "Experiment not found";
    }

    const bestIteration = exp.iterations
      .filter((i) => i.keep)
      .sort((a, b) => (b.metricResult?.value ?? 0) - (a.metricResult?.value ?? 0))[0];

    const summary = `
## Learner Experiment Summary

**Mission:** ${exp.mission}
**Iterations:** ${exp.iterations.length}
**Final Metric:** ${exp.finalMetric?.toFixed(3) ?? "N/A"}
**Status:** ${exp.kept ? "KEPT" : "DISCARDED"}

${bestIteration ? `**Best Iteration:** #${bestIteration.iterationNumber} (metric: ${bestIteration.metricResult?.value.toFixed(3)})` : "No successful iterations"}

**Iterations:**
${exp.iterations
  .map(
    (i) =>
      `- #${i.iterationNumber}: metric=${i.metricResult?.value.toFixed(3)}, keep=${i.keep}`,
  )
  .join("\n")}
`.trim();

    // Store summary in vault
    await this.vaultService.create(companyId, {
      type: "note",
      title: `Experiment ${experimentId} Summary`,
      content: summary,
      tags: ["learner", "experiment", `issue:${exp.issueId}`],
    });

    return summary;
  }

  /**
   * Get recommended next action for agent
   */
  getNextAction(experiment: LearnerExperiment): {
    action: "continue" | "stop" | "create_followup";
    message: string;
  } {
    if (experiment.status === "completed") {
      if (experiment.kept) {
        return {
          action: "create_followup",
          message: `Experiment succeeded with metric ${experiment.finalMetric?.toFixed(3)}. Consider creating follow-up experiments or documenting the solution.`,
        };
      }
      return {
        action: "stop",
        message: "Experiment did not meet threshold. Consider revising the mission or approach.",
      };
    }

    const remainingIterations = this.defaultConfig.maxIterations - experiment.iterations.length;
    if (remainingIterations <= 0) {
      return {
        action: "stop",
        message: "Reached maximum iterations without meeting threshold.",
      };
    }

    return {
      action: "continue",
      message: `Continue with next iteration. ${remainingIterations} iterations remaining.`,
    };
  }
}
