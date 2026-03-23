/**
 * Learner Types - Phase 1.4: Autoresearch-style loop
 *
 * Implements metric → edit → run → keep/discard cycle:
 * - Learner/Researcher agent reads mission
 * - Edits a single artifact
 * - Runs eval with budget (e.g., 5-min)
 * - Parses metric
 * - Keeps or discards based on result
 */

export interface LearnerExperiment {
  id: string;
  companyId: string;
  agentId: string;
  issueId: string;
  mission: string;
  artifactPath: string;
  status: ExperimentStatus;
  iterations: LearnerIteration[];
  createdAt: string;
  updatedAt: string;
  finalMetric?: number;
  kept: boolean;
}

export type ExperimentStatus =
  | "pending"      // Not yet started
  | "running"      // Currently running
  | "completed"    // Finished (kept or discarded)
  | "failed"       // Error occurred
  | "timeout";     // Ran out of budget

export interface LearnerIteration {
  iterationNumber: number;
  artifactContent: string;
  metricResult?: MetricResult;
  keep: boolean;
  notes?: string;
  createdAt: string;
}

export interface MetricResult {
  name: string;
  value: number;
  threshold: number;
  passed: boolean;
  details?: string;
}

export interface LearnerConfig {
  maxIterations: number;
  maxBudgetMinutes: number;
  metricThresholds: Record<string, number>;
  keepThreshold: number;  // Minimum metric to keep
}

export interface CreateExperimentDto {
  companyId: string;
  agentId: string;
  issueId: string;
  mission: string;
  artifactPath: string;
}

export interface RunIterationDto {
  artifactContent: string;
}
