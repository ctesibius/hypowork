/**
 * Prompt learning (dual-loop) — aligns with Nest `PromptLearningController`.
 */

import { api } from "./client";

const base = (companyId: string) => `/workspaces/${companyId}`;

export type TaskOutcomePayload = {
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
};

export type MessageRatingPayload = {
  rating?: number;
  thumbsUp?: boolean;
  thumbsDown?: boolean;
  feedbackText?: string;
  aspect?: string;
  promptVersionId?: string;
};

export type PromptMetrics = {
  avgRating: number;
  responseCount: number;
  thumbsUpRate: number;
  automatedSuccessRate: number;
  efficiencyScore: number;
  compositeScore: number;
};

export const promptLearningApi = {
  recordTaskOutcome(companyId: string, body: TaskOutcomePayload) {
    return api.post<{ id: string }>(`${base(companyId)}/task-outcomes`, body);
  },

  recordMessageRating(companyId: string, messageId: string, body: MessageRatingPayload) {
    return api.post<{ id: string }>(`${base(companyId)}/messages/${encodeURIComponent(messageId)}/rate`, body);
  },

  getPromptMetrics(companyId: string, promptVersionId: string) {
    return api.get<PromptMetrics>(
      `${base(companyId)}/prompt-versions/${encodeURIComponent(promptVersionId)}/metrics`,
    );
  },

  promotePromptVersion(companyId: string, promptVersionId: string) {
    return api.post<{ ok: true; skillName: string }>(
      `${base(companyId)}/prompt-versions/${encodeURIComponent(promptVersionId)}/promote`,
      {},
    );
  },
};
