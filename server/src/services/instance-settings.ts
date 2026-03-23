import type { Db } from "@paperclipai/db";
import { companies, instanceSettings } from "@paperclipai/db";
import {
  instanceExperimentalSettingsSchema,
  patchInstanceExperimentalSettingsSchema,
  type AgentAdapterType,
  type InstanceExperimentalSettings,
  type InstanceExperimentalSettingsStored,
  type InstanceSettings,
  type PatchInstanceExperimentalSettings,
} from "@paperclipai/shared";
import { eq } from "drizzle-orm";
import { REDACTED_EVENT_VALUE, redactEventPayload } from "../redaction.js";
import { secretService } from "./secrets.js";
import { unprocessable } from "../errors.js";

const DEFAULT_SINGLETON_KEY = "default";

type SecretsSvc = ReturnType<typeof secretService>;

function isLegacyChatLlm(raw: unknown): raw is {
  enabled?: boolean;
  baseUrl?: string;
  model?: string | null;
  apiKey?: string;
} {
  if (!raw || typeof raw !== "object") return false;
  return "baseUrl" in raw && !("adapterType" in raw);
}

function migrateLegacyChatLlm(legacy: Record<string, unknown>): NonNullable<
  InstanceExperimentalSettingsStored["chatLlm"]
> {
  const apiKey = typeof legacy.apiKey === "string" ? legacy.apiKey.trim() : "";
  const model =
    legacy.model === null || legacy.model === undefined
      ? undefined
      : typeof legacy.model === "string"
        ? legacy.model
        : String(legacy.model);
  return {
    enabled: legacy.enabled === true,
    adapterType: "openai_compatible",
    adapterConfig: {
      baseUrl:
        typeof legacy.baseUrl === "string" && legacy.baseUrl.trim()
          ? legacy.baseUrl.trim()
          : "https://api.openai.com/v1",
      ...(model?.trim() ? { model: model.trim() } : {}),
      ...(apiKey ? { env: { OPENAI_API_KEY: apiKey } } : {}),
    },
  };
}

function chatLlmApiKeyConfigured(adapterConfig: Record<string, unknown>): boolean {
  const env = adapterConfig.env;
  if (env && typeof env === "object" && !Array.isArray(env)) {
    const e = env as Record<string, unknown>;
    const candidates = [
      e.OPENAI_API_KEY,
      e.ANTHROPIC_API_KEY,
      e.OPENROUTER_API_KEY,
      e.API_KEY,
    ];
    if (candidates.some((v) => v !== undefined && v !== null && v !== "")) return true;
  }
  return false;
}

function preferredApiKeysForProvider(provider: string): string[] {
  switch (provider) {
    case "anthropic":
      return ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY", "API_KEY"];
    case "openrouter":
      return ["OPENROUTER_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "API_KEY"];
    case "openai":
      return ["OPENAI_API_KEY", "OPENROUTER_API_KEY", "ANTHROPIC_API_KEY", "API_KEY"];
    default:
      return ["API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "OPENROUTER_API_KEY"];
  }
}

function preferredModelKeysForProvider(provider: string): string[] {
  switch (provider) {
    case "anthropic":
      return ["ANTHROPIC_MODEL", "OPENAI_MODEL", "MODEL"];
    case "openrouter":
      return ["OPENROUTER_MODEL", "OPENAI_MODEL", "MODEL"];
    case "openai":
      return ["OPENAI_MODEL", "MODEL"];
    default:
      return ["MODEL", "OPENAI_MODEL", "ANTHROPIC_MODEL", "OPENROUTER_MODEL"];
  }
}

function asRecordLoose(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isRedactedEnvBinding(v: unknown): boolean {
  if (v === REDACTED_EVENT_VALUE) return true;
  if (typeof v === "object" && v !== null && (v as { type?: string }).type === "plain") {
    return (v as { value?: unknown }).value === REDACTED_EVENT_VALUE;
  }
  return false;
}

/** Merge incoming adapterConfig over prev; skip env keys still redacted from GET (client did not re-enter secrets). */
function mergeChatLlmAdapterConfig(
  prev: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...prev, ...incoming };
  const prevEnv = asRecordLoose(prev.env);
  const incEnv = asRecordLoose(incoming.env);
  if (!incEnv) {
    return out;
  }
  const mergedEnv: Record<string, unknown> = { ...(prevEnv ?? {}) };
  for (const [k, v] of Object.entries(incEnv)) {
    if (isRedactedEnvBinding(v)) continue;
    mergedEnv[k] = v;
  }
  out.env = mergedEnv;
  return out;
}

function envHasSecretRefs(env: unknown): boolean {
  if (!env || typeof env !== "object") return false;
  for (const v of Object.values(env as Record<string, unknown>)) {
    if (typeof v === "object" && v !== null && (v as { type?: string }).type === "secret_ref") {
      return true;
    }
  }
  return false;
}

const DEFAULT_CHAT_LLM = (): NonNullable<InstanceExperimentalSettingsStored["chatLlm"]> => ({
  enabled: false,
  adapterType: "openai_compatible",
  adapterConfig: {
    baseUrl: "https://api.openai.com/v1",
  },
});

function preprocessExperimentalRaw(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = { ...(raw as Record<string, unknown>) };
  const c = o.chatLlm;
  if (c && isLegacyChatLlm(c)) {
    o.chatLlm = migrateLegacyChatLlm(c as Record<string, unknown>);
  }
  return o;
}

function normalizeExperimentalSettings(raw: unknown): InstanceExperimentalSettingsStored {
  const preprocessed = preprocessExperimentalRaw(raw ?? {});
  const parsed = instanceExperimentalSettingsSchema.safeParse(preprocessed);
  if (!parsed.success) {
    return {
      enableIsolatedWorkspaces: false,
      chatLlm: DEFAULT_CHAT_LLM(),
    };
  }
  const d = parsed.data;
  const chatLlm: NonNullable<InstanceExperimentalSettingsStored["chatLlm"]> = d.chatLlm
    ? {
        enabled: d.chatLlm.enabled,
        adapterType: d.chatLlm.adapterType,
        adapterConfig: (d.chatLlm.adapterConfig ?? {}) as Record<string, unknown>,
      }
    : DEFAULT_CHAT_LLM();
  return {
    enableIsolatedWorkspaces: d.enableIsolatedWorkspaces ?? false,
    chatLlm,
  };
}

function toPublicExperimental(stored: InstanceExperimentalSettingsStored): InstanceExperimentalSettings {
  const cl = stored.chatLlm ?? DEFAULT_CHAT_LLM();
  const ac = (cl.adapterConfig ?? {}) as Record<string, unknown>;
  return {
    enableIsolatedWorkspaces: stored.enableIsolatedWorkspaces ?? false,
    chatLlm: {
      enabled: cl.enabled,
      adapterType: cl.adapterType as AgentAdapterType,
      adapterConfig: redactEventPayload(ac) ?? {},
      apiKeySet: chatLlmApiKeyConfigured(ac),
    },
  };
}

function toInstanceSettings(row: typeof instanceSettings.$inferSelect): InstanceSettings {
  const stored = normalizeExperimentalSettings(row.experimental);
  return {
    id: row.id,
    experimental: toPublicExperimental(stored),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function instanceSettingsService(db: Db, secretsSvc?: SecretsSvc) {
  async function getOrCreateRow() {
    const existing = await db
      .select()
      .from(instanceSettings)
      .where(eq(instanceSettings.singletonKey, DEFAULT_SINGLETON_KEY))
      .then((rows) => rows[0] ?? null);
    if (existing) return existing;

    const now = new Date();
    const [created] = await db
      .insert(instanceSettings)
      .values({
        singletonKey: DEFAULT_SINGLETON_KEY,
        experimental: {},
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [instanceSettings.singletonKey],
        set: {
          updatedAt: now,
        },
      })
      .returning();

    return created;
  }

  return {
    get: async (): Promise<InstanceSettings> => toInstanceSettings(await getOrCreateRow()),

    getExperimental: async (): Promise<InstanceExperimentalSettings> => {
      const row = await getOrCreateRow();
      return toPublicExperimental(normalizeExperimentalSettings(row.experimental));
    },

    /**
     * Resolved chat LLM config for server-side completion (env overrides + company-scoped secret resolution).
     */
    getChatLlmRuntimeConfig: async (
      companyId: string,
    ): Promise<{
      enabled: boolean;
      provider: string;
      baseUrl: string;
      model: string;
      apiKey: string;
    }> => {
      if (!secretsSvc) {
        throw new Error("instanceSettingsService: secretService is required for getChatLlmRuntimeConfig");
      }
      const row = await getOrCreateRow();
      const stored = normalizeExperimentalSettings(row.experimental);
      const cl = stored.chatLlm ?? DEFAULT_CHAT_LLM();
      const envKey = (process.env.CHAT_LLM_API_KEY ?? "").trim();
      const envBase = (process.env.CHAT_LLM_BASE_URL ?? "").trim();
      const envModel = (process.env.CHAT_LLM_MODEL ?? "").trim();

      const { config: resolved } = await secretsSvc.resolveAdapterConfigForRuntime(
        companyId,
        (cl.adapterConfig ?? {}) as Record<string, unknown>,
      );
      const cfg = resolved as Record<string, unknown>;
      const envObj = (cfg.env as Record<string, string> | undefined) ?? {};
      const provider =
        typeof cfg.provider === "string" && cfg.provider.trim().length > 0
          ? cfg.provider.trim().toLowerCase()
          : "openai";

      const baseUrlRaw =
        envBase ||
        (typeof cfg.baseUrl === "string" ? cfg.baseUrl : "") ||
        envObj.OPENAI_BASE_URL ||
        "https://api.openai.com/v1";
      const baseUrl = baseUrlRaw.replace(/\/$/, "");

      const preferred = preferredApiKeysForProvider(provider);
      const apiKey = envKey || preferred.map((k) => envObj[k]).find((v) => typeof v === "string" && v.trim()) || "";

      const preferredModelKeys = preferredModelKeysForProvider(provider);
      const modelFromEnv =
        preferredModelKeys
          .map((k) => envObj[k])
          .find((v) => typeof v === "string" && v.trim()) ?? "";
      const model = envModel || (typeof cfg.model === "string" ? cfg.model.trim() : "") || modelFromEnv.trim() || "";

      return {
        enabled: cl.enabled === true,
        provider,
        baseUrl,
        model,
        apiKey,
      };
    },

    updateExperimental: async (patch: PatchInstanceExperimentalSettings): Promise<InstanceSettings> => {
      const parsed = patchInstanceExperimentalSettingsSchema.safeParse(patch);
      if (!parsed.success) {
        throw new Error(`Invalid experimental settings: ${parsed.error.message}`);
      }
      const companyIdForSecrets = parsed.data.companyIdForSecrets;
      const p = parsed.data as PatchInstanceExperimentalSettings & { companyIdForSecrets?: string };

      const current = await getOrCreateRow();
      const cur = normalizeExperimentalSettings(current.experimental);

      let nextChatLlm = { ...(cur.chatLlm ?? DEFAULT_CHAT_LLM()) };
      if (p.chatLlm) {
        if (p.chatLlm.enabled !== undefined) nextChatLlm.enabled = p.chatLlm.enabled;
        if (p.chatLlm.adapterType !== undefined) nextChatLlm.adapterType = p.chatLlm.adapterType;
        if (p.chatLlm.adapterConfig !== undefined) {
          const incoming = p.chatLlm.adapterConfig as Record<string, unknown>;
          const merged = mergeChatLlmAdapterConfig(
            (nextChatLlm.adapterConfig ?? {}) as Record<string, unknown>,
            incoming,
          );
          const env = merged.env;
          if (envHasSecretRefs(env) && !companyIdForSecrets) {
            throw unprocessable(
              "chatLlm.adapterConfig uses secret references; provide companyIdForSecrets (same company as in the UI) when saving.",
            );
          }
          if (secretsSvc && companyIdForSecrets) {
            nextChatLlm.adapterConfig = await secretsSvc.normalizeAdapterConfigForPersistence(
              companyIdForSecrets,
              merged,
            );
          } else {
            nextChatLlm.adapterConfig = merged;
          }
        }
      }

      const nextExperimental: InstanceExperimentalSettingsStored = {
        enableIsolatedWorkspaces: p.enableIsolatedWorkspaces ?? cur.enableIsolatedWorkspaces,
        chatLlm: nextChatLlm,
      };

      const now = new Date();
      const [updated] = await db
        .update(instanceSettings)
        .set({
          experimental: { ...nextExperimental } as Record<string, unknown>,
          updatedAt: now,
        })
        .where(eq(instanceSettings.id, current.id))
        .returning();
      return toInstanceSettings(updated ?? current);
    },

    listCompanyIds: async (): Promise<string[]> =>
      db
        .select({ id: companies.id })
        .from(companies)
        .then((rows) => rows.map((row) => row.id)),
  };
}
