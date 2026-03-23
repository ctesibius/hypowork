import type { CreateConfigValues } from "@paperclipai/adapter-utils";

export function buildOpenAiCompatibleConfig(v: CreateConfigValues): Record<string, unknown> {
  const ac: Record<string, unknown> = {};
  if (v.url?.trim()) ac.baseUrl = v.url.trim();
  if (v.model?.trim()) ac.model = v.model.trim();
  return ac;
}
