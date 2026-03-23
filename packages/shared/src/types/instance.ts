import type { AgentAdapterType } from "../constants.js";

/** Chat LLM section returned from GET /instance/settings/experimental (redacted, no plain secrets). */
export interface InstanceChatLlmPublic {
  enabled: boolean;
  /** Same vocabulary as agent adapters; instance chat may only persist supported values. */
  adapterType: AgentAdapterType;
  adapterConfig: Record<string, unknown>;
  /** True when OPENAI_API_KEY (or legacy key) is configured via env bindings or stored plain. */
  apiKeySet: boolean;
}

/**
 * Experimental settings returned from GET and PATCH responses (sanitized: no raw secrets in adapterConfig).
 * Use `PatchInstanceExperimentalSettings` for PATCH bodies.
 */
export interface InstanceExperimentalSettings {
  enableIsolatedWorkspaces: boolean;
  chatLlm: InstanceChatLlmPublic;
}

export interface InstanceSettings {
  id: string;
  experimental: InstanceExperimentalSettings;
  createdAt: Date;
  updatedAt: Date;
}
