import type { AdapterExecutionContext, AdapterExecutionResult } from "../types.js";
import { asString, renderTemplate } from "../utils.js";
import { openaiCompatibleChatCompletion } from "../../lib/openai-compatible-completion.js";
import { resolveOpenAiCompatibleConnectionFromResolvedConfig } from "../../services/chat-llm-runtime.js";

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, config, context, onLog, onMeta } = ctx;

  const conn = resolveOpenAiCompatibleConnectionFromResolvedConfig(config);
  if (!conn.apiKey.trim()) {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "openai_compatible: missing API key (set env bindings or CHAT_LLM_API_KEY)",
    };
  }
  if (!conn.model.trim()) {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "openai_compatible: missing model",
    };
  }

  const promptTemplate = asString(config.promptTemplate, "").trim();
  const templateData = {
    agentId: agent.id,
    companyId: agent.companyId,
    runId,
    company: { id: agent.companyId },
    agent,
    run: { id: runId },
    context,
  };
  const userContent = promptTemplate
    ? renderTemplate(promptTemplate, templateData)
    : "You are a helpful assistant. Respond briefly to the current heartbeat context.";

  if (onMeta) {
    await onMeta({
      adapterType: "openai_compatible",
      command: "POST /v1/chat/completions",
      commandNotes: [`provider=${conn.provider}`, `model=${conn.model}`],
      prompt: userContent,
    });
  }

  try {
    const text = await openaiCompatibleChatCompletion({
      provider: conn.provider,
      baseUrl: conn.baseUrl,
      apiKey: conn.apiKey,
      model: conn.model,
      messages: [{ role: "user", content: userContent }],
    });
    await onLog("stdout", text);
    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      summary: text.slice(0, 500),
      model: conn.model,
      provider: conn.provider,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await onLog("stderr", msg);
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: msg,
    };
  }
}
