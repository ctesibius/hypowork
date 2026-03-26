import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "../types.js";
import { openaiCompatibleChatCompletion } from "../../lib/openai-compatible-completion.js";
import { resolveOpenAiCompatibleConnectionFromResolvedConfig } from "../../services/chat-llm-runtime.js";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

const PROBE_USER_MESSAGE = "Reply with the single word: ok";

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const conn = resolveOpenAiCompatibleConnectionFromResolvedConfig(ctx.config);

  checks.push({
    code: "openai_provider",
    level: "info",
    message: `Provider: ${conn.provider}`,
  });
  checks.push({
    code: "openai_base_url",
    level: "info",
    message: `Base URL: ${conn.baseUrl || "(empty)"}`,
  });

  if (!conn.apiKey.trim()) {
    checks.push({
      code: "openai_api_key_missing",
      level: "error",
      message:
        "No API key resolved. Set env bindings (OPENAI_API_KEY, ANTHROPIC_API_KEY, …) or CHAT_LLM_API_KEY.",
      hint: "Save secret references with a company selected, or set a plain key for testing.",
    });
    return {
      adapterType: ctx.adapterType,
      status: summarizeStatus(checks),
      checks,
      testedAt: new Date().toISOString(),
    };
  }

  if (!conn.model.trim()) {
    checks.push({
      code: "openai_model_missing",
      level: "error",
      message: "No model resolved. Set model in adapter config or provider-specific env (e.g. OPENAI_MODEL).",
    });
    return {
      adapterType: ctx.adapterType,
      status: summarizeStatus(checks),
      checks,
      testedAt: new Date().toISOString(),
    };
  }

  try {
    const reply = await openaiCompatibleChatCompletion({
      provider: conn.provider,
      baseUrl: conn.baseUrl,
      apiKey: conn.apiKey,
      model: conn.model,
      messages: [{ role: "user", content: PROBE_USER_MESSAGE }],
    });
    const preview = reply.trim().slice(0, 200);
    checks.push({
      code: "openai_probe_ok",
      level: "info",
      message: `Chat completion succeeded (model ${conn.model}).`,
      detail: preview ? `Reply preview: ${preview}` : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    checks.push({
      code: "openai_probe_failed",
      level: "error",
      message: msg,
      hint: "Verify base URL, key, and model for your provider.",
    });
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
