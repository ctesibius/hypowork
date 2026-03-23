import type { UIAdapterModule } from "../types";
import { parseHttpStdoutLine } from "../http/parse-stdout";
import { OpenAiCompatibleConfigFields } from "./config-fields";
import { buildOpenAiCompatibleConfig } from "./build-config";

export const openaiCompatibleUIAdapter: UIAdapterModule = {
  type: "openai_compatible",
  label: "OpenAI-compatible (HTTP)",
  parseStdoutLine: parseHttpStdoutLine,
  ConfigFields: OpenAiCompatibleConfigFields,
  buildAdapterConfig: buildOpenAiCompatibleConfig,
};
