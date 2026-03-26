/**
 * Instance Chat LLM uses adapter type `openai_compatible` only (server-side HTTP).
 * Presets set logical provider + default base URL — same env resolution as agents using that adapter.
 */

export type ChatEndpointPresetId =
  | "openai"
  | "anthropic"
  | "openrouter"
  | "minimax_anthropic"
  | "minimax_openai"
  | "custom";

export const CHAT_ENDPOINT_PRESETS: Record<
  ChatEndpointPresetId,
  { label: string; provider: string; baseUrl: string; blurb: string }
> = {
  openai: {
    label: "OpenAI",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    blurb: "Official OpenAI API (chat completions).",
  },
  anthropic: {
    label: "Anthropic",
    provider: "anthropic",
    baseUrl: "https://api.anthropic.com",
    blurb: "Official Anthropic Messages API.",
  },
  openrouter: {
    label: "OpenRouter",
    provider: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    blurb: "OpenRouter gateway (many models).",
  },
  minimax_anthropic: {
    label: "MiniMax (Anthropic-compatible)",
    provider: "anthropic",
    baseUrl: "https://api.minimax.io/anthropic",
    blurb: "MiniMax via Anthropic-style /v1/messages. Use MINIMAX_API_KEY, MINIMAX_MODEL or Model field.",
  },
  minimax_openai: {
    label: "MiniMax (OpenAI-compatible)",
    provider: "openai",
    baseUrl: "https://api.minimax.io/v1",
    blurb: "MiniMax via OpenAI-style /chat/completions. Use MINIMAX_API_KEY and model.",
  },
  custom: {
    label: "Custom",
    provider: "custom",
    baseUrl: "",
    blurb: "Set Provider, Base URL, Model, and env yourself.",
  },
};

const norm = (s: string) => s.replace(/\/$/, "").toLowerCase();

export function detectChatEndpointPreset(cfg: Record<string, unknown>): ChatEndpointPresetId {
  const provider = typeof cfg.provider === "string" ? cfg.provider.trim().toLowerCase() : "";
  const base = typeof cfg.baseUrl === "string" ? norm(cfg.baseUrl) : "";

  if (base.includes("minimax.io/anthropic") && provider === "anthropic") return "minimax_anthropic";
  if ((base === "https://api.minimax.io/v1" || base.endsWith("minimax.io/v1")) && provider === "openai") {
    return "minimax_openai";
  }
  if (base.includes("openrouter") && provider === "openrouter") return "openrouter";
  if ((base === "https://api.openai.com/v1" || base === "https://api.openai.com") && provider === "openai") {
    return "openai";
  }
  if (
    (base === "https://api.anthropic.com" || base.startsWith("https://api.anthropic.com/")) &&
    provider === "anthropic"
  ) {
    return "anthropic";
  }
  if (!base && !provider) return "custom";
  return "custom";
}

export function applyChatEndpointPreset(
  presetId: ChatEndpointPresetId,
): Pick<Record<string, unknown>, "provider" | "baseUrl"> {
  const p = CHAT_ENDPOINT_PRESETS[presetId];
  return {
    provider: p.provider,
    baseUrl: p.baseUrl,
  };
}
