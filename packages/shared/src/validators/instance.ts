import { z } from "zod";
import { AGENT_ADAPTER_TYPES } from "../constants.js";
import { adapterConfigSchema } from "./agent.js";

/** Adapters supported for instance-wide chat LLM (HTTP completion path). */
export const INSTANCE_CHAT_LLM_ADAPTER_TYPES = ["openai_compatible"] as const satisfies readonly (
  (typeof AGENT_ADAPTER_TYPES)[number]
)[];

const instanceChatLlmAdapterTypeSchema = z.enum(
  INSTANCE_CHAT_LLM_ADAPTER_TYPES as unknown as [string, ...string[]],
);

/** Stored in DB; uses same adapterConfig + env bindings as agents. */
export const instanceChatLlmStoredSchema = z
  .object({
    enabled: z.boolean().default(false),
    adapterType: instanceChatLlmAdapterTypeSchema.default("openai_compatible"),
    adapterConfig: adapterConfigSchema.default({}),
  })
  .strict();

export const instanceExperimentalSettingsSchema = z
  .object({
    enableIsolatedWorkspaces: z.boolean().default(false),
    chatLlm: instanceChatLlmStoredSchema.optional(),
  })
  .strict();

export const patchInstanceChatLlmSchema = instanceChatLlmStoredSchema.partial();

/** PATCH body: optional company scope for normalizing secret refs in chatLlm.adapterConfig (same as agents). */
export const patchInstanceExperimentalSettingsSchema = z
  .object({
    enableIsolatedWorkspaces: z.boolean().optional(),
    chatLlm: patchInstanceChatLlmSchema.optional(),
    companyIdForSecrets: z.string().uuid().optional(),
  })
  .strict();

export type InstanceChatLlmStored = z.infer<typeof instanceChatLlmStoredSchema>;
/** Full parsed shape including resolved adapter env (server-side / DB only). */
export type InstanceExperimentalSettingsStored = z.infer<typeof instanceExperimentalSettingsSchema>;
export type PatchInstanceExperimentalSettings = z.infer<typeof patchInstanceExperimentalSettingsSchema>;
