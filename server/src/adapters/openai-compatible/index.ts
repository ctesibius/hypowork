import type { ServerAdapterModule } from "../types.js";
import { execute } from "./execute.js";
import { testEnvironment } from "./test.js";

export const openaiCompatibleAdapter: ServerAdapterModule = {
  type: "openai_compatible",
  execute,
  testEnvironment,
  models: [],
  supportsLocalAgentJwt: false,
  agentConfigurationDoc: `# openai_compatible agent configuration

Adapter: openai_compatible (HTTP)

Uses the same OpenAI-compatible / Anthropic Messages HTTP layer as instance Chat LLM.

Core fields:
- provider (string, optional): openai | anthropic | openrouter | custom — affects default env key order
- baseUrl (string, optional): API root, default https://api.openai.com/v1
- model (string, optional): model id; can also be set via env (OPENAI_MODEL, etc.)
- promptTemplate (string, optional): rendered with agent/run/context; if omitted, a short default prompt is used
- env (object, optional): KEY=VALUE or secret_ref bindings (OPENAI_API_KEY, ANTHROPIC_API_KEY, …)

Operational:
- Credentials resolve the same way as Instance Chat LLM; optional host overrides: CHAT_LLM_API_KEY, CHAT_LLM_BASE_URL, CHAT_LLM_MODEL.
`,
};
