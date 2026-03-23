import type { AdapterConfigFieldsProps } from "../types";
import type { CreateConfigValues } from "@paperclipai/adapter-utils";
import { Field, DraftInput, help } from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

/** OpenAI-compatible HTTP chat; credentials via Environment variables (same as other adapters). */
export function OpenAiCompatibleConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  const createValues = values as (CreateConfigValues & { provider?: string }) | null;
  const providerValue = isCreate
    ? String((createValues?.provider as unknown as string | undefined) ?? "openai")
    : eff("adapterConfig", "provider", String(config.provider ?? "openai"));

  return (
    <>
      <Field
        label="Provider"
        hint="Logical provider used for defaults and API key preference. Keep Custom for generic compatible gateways."
      >
        <select
          className={`${inputClass} bg-background`}
          value={providerValue}
          onChange={(e) =>
            isCreate
              ? set!({ provider: e.target.value } as unknown as Partial<CreateConfigValues>)
              : mark("adapterConfig", "provider", e.target.value || undefined)
          }
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="openrouter">OpenRouter</option>
          <option value="custom">Custom</option>
        </select>
      </Field>
      <Field
        label="Base URL"
        hint="API root for chat completions, e.g. https://api.openai.com/v1 or your gateway."
      >
        <DraftInput
          value={
            isCreate ? values!.url ?? "" : eff("adapterConfig", "baseUrl", String(config.baseUrl ?? ""))
          }
          onCommit={(v) =>
            isCreate ? set!({ url: v }) : mark("adapterConfig", "baseUrl", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="https://api.openai.com/v1"
        />
      </Field>
      <Field label="Model" hint={help.model}>
        <DraftInput
          value={
            isCreate
              ? values!.model ?? ""
              : eff("adapterConfig", "model", String(config.model ?? ""))
          }
          onCommit={(v) =>
            isCreate ? set!({ model: v }) : mark("adapterConfig", "model", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="gpt-4o-mini"
        />
      </Field>
    </>
  );
}
