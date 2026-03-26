/**
 * Shared resolution for OpenAI-compatible HTTP chat (instance Chat LLM + `openai_compatible` agents).
 * Applies `CHAT_LLM_*` process env overrides when set.
 */

export function preferredApiKeysForProvider(provider: string): string[] {
  switch (provider) {
    case "anthropic":
      return ["MINIMAX_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY", "API_KEY"];
    case "openrouter":
      return ["OPENROUTER_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "API_KEY"];
    case "openai":
      return ["OPENAI_API_KEY", "OPENROUTER_API_KEY", "ANTHROPIC_API_KEY", "API_KEY"];
    default:
      return ["API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "OPENROUTER_API_KEY"];
  }
}

/** MiniMax and some gateways document model under provider-specific env names. */
const MINIMAX_MODEL_ENV_KEYS = ["MINIMAX_MODEL", "MINIMAX_API_MODEL"] as const;

export function preferredModelKeysForProvider(provider: string): string[] {
  switch (provider) {
    case "anthropic":
      return [...MINIMAX_MODEL_ENV_KEYS, "ANTHROPIC_MODEL", "OPENAI_MODEL", "MODEL"];
    case "openrouter":
      return ["OPENROUTER_MODEL", "OPENAI_MODEL", "MODEL", ...MINIMAX_MODEL_ENV_KEYS];
    case "openai":
      return ["OPENAI_MODEL", "MODEL", ...MINIMAX_MODEL_ENV_KEYS];
    default:
      return [...MINIMAX_MODEL_ENV_KEYS, "MODEL", "OPENAI_MODEL", "ANTHROPIC_MODEL", "OPENROUTER_MODEL"];
  }
}

/**
 * Resolve provider URL, model, and API key from a runtime-resolved `adapterConfig`
 * (same shape as instance chat LLM and openai_compatible agents).
 */
export function resolveOpenAiCompatibleConnectionFromResolvedConfig(
  resolvedCfg: Record<string, unknown>,
): { provider: string; baseUrl: string; model: string; apiKey: string } {
  const envKey = (process.env.CHAT_LLM_API_KEY ?? "").trim();
  const envBase = (process.env.CHAT_LLM_BASE_URL ?? "").trim();
  const envModel = (process.env.CHAT_LLM_MODEL ?? "").trim();

  const cfg = resolvedCfg;
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
    preferredModelKeys.map((k) => envObj[k]).find((v) => typeof v === "string" && v.trim()) ?? "";
  const model = envModel || (typeof cfg.model === "string" ? cfg.model.trim() : "") || modelFromEnv.trim() || "";

  return { provider, baseUrl, model, apiKey };
}
