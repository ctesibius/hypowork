import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import type { EnvBinding } from "@paperclipai/shared";
import { agentsApi } from "@/api/agents";
import { instanceSettingsApi } from "@/api/instanceSettings";
import { secretsApi } from "@/api/secrets";
import { AdapterEnvironmentResult } from "@/components/adapter-environment-result";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { adapterLabels, Field, help } from "@/components/agent-config-primitives";
import { AdapterEnvVarEditor } from "@/components/adapter-env-var-editor";
import { getUIAdapter } from "@/adapters";
import {
  applyChatEndpointPreset,
  CHAT_ENDPOINT_PRESETS,
  detectChatEndpointPreset,
  type ChatEndpointPresetId,
} from "./instance-chat-llm-presets";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-background outline-none text-sm font-mono placeholder:text-muted-foreground/40";

export function InstanceChatLlmSettings() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const { selectedCompanyId } = useCompany();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [adapterConfig, setAdapterConfig] = useState<Record<string, unknown>>({});

  useEffect(() => {
    setBreadcrumbs([{ label: "Instance Settings" }, { label: "Chat LLM" }]);
  }, [setBreadcrumbs]);

  const experimentalQuery = useQuery({
    queryKey: queryKeys.instance.experimentalSettings,
    queryFn: () => instanceSettingsApi.getExperimental(),
  });

  const secretsQuery = useQuery({
    queryKey: selectedCompanyId ? queryKeys.secrets.list(selectedCompanyId) : ["secrets", "none"],
    queryFn: () => secretsApi.list(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });

  useEffect(() => {
    const d = experimentalQuery.data;
    if (!d?.chatLlm) return;
    setEnabled(d.chatLlm.enabled);
    setAdapterConfig((d.chatLlm.adapterConfig ?? {}) as Record<string, unknown>);
  }, [experimentalQuery.data]);

  const ui = useMemo(() => getUIAdapter("openai_compatible"), []);

  const endpointPreset = useMemo(() => detectChatEndpointPreset(adapterConfig), [adapterConfig]);

  const testEnvironment = useMutation({
    mutationFn: async () => {
      if (!selectedCompanyId) {
        throw new Error("Select a company to test the adapter environment");
      }
      return agentsApi.testEnvironment(selectedCompanyId, "openai_compatible", {
        adapterConfig,
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      instanceSettingsApi.updateExperimental({
        chatLlm: {
          enabled,
          adapterType: "openai_compatible",
          adapterConfig,
        },
        companyIdForSecrets: selectedCompanyId ?? undefined,
      }),
    onSuccess: async () => {
      setActionError(null);
      pushToast({
        tone: "success",
        title: "Chat LLM settings saved",
        body: "Instance chat provider configuration has been updated.",
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.instance.experimentalSettings });
    },
    onError: (error: Error) => {
      const message = error.message || "Failed to save chat LLM settings.";
      setActionError(message);
      pushToast({
        tone: "error",
        title: "Failed to save Chat LLM settings",
        body: message,
      });
    },
  });

  const env = (adapterConfig.env as Record<string, EnvBinding> | undefined) ?? {};

  if (experimentalQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading chat LLM settings...</div>;
  }

  if (experimentalQuery.error) {
    return (
      <div className="text-sm text-destructive">
        {experimentalQuery.error instanceof Error
          ? experimentalQuery.error.message
          : "Failed to load settings."}
      </div>
    );
  }

  const apiKeySet = experimentalQuery.data?.chatLlm?.apiKeySet === true;

  function onPresetChange(id: ChatEndpointPresetId) {
    const next = applyChatEndpointPreset(id);
    setAdapterConfig((prev) => ({
      ...prev,
      ...next,
    }));
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Chat LLM</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Configure the same <span className="font-mono text-xs">adapterConfig + env</span> pattern as agents. Instance
          chat runs on the server (HTTP only). Local CLI adapters such as Codex or Claude Code apply to agents in the
          org board, not to this sidebar chat.
        </p>
        <p className="text-xs text-muted-foreground">
          Optional host overrides:{" "}
          <span className="font-mono">CHAT_LLM_API_KEY</span>,{" "}
          <span className="font-mono">CHAT_LLM_BASE_URL</span>,{" "}
          <span className="font-mono">CHAT_LLM_MODEL</span>.
        </p>
      </div>

      {actionError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {!selectedCompanyId ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          Select a company in the header to manage secrets and to save secret references for chat LLM.
        </div>
      ) : null}

      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">Enable LLM replies</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              When enabled and credentials are set, chat uses your provider instead of the RAG-only stub.
            </p>
          </div>
          <button
            type="button"
            aria-label="Toggle chat LLM"
            disabled={saveMutation.isPending}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              enabled ? "bg-green-600" : "bg-muted",
            )}
            onClick={() => setEnabled((v) => !v)}
          >
            <span
              className={cn(
                "inline-block h-4.5 w-4.5 rounded-full bg-white transition-transform",
                enabled ? "translate-x-6" : "translate-x-0.5",
              )}
            />
          </button>
        </div>

        {/* Adapter — same rhythm as AgentConfigForm */}
        <div className="border-b border-border">
          <div className="flex items-center justify-between gap-2 px-4 py-2">
            <span className="text-xs font-medium text-muted-foreground">Adapter</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => testEnvironment.mutate()}
              disabled={testEnvironment.isPending || !selectedCompanyId}
            >
              {testEnvironment.isPending ? "Testing…" : "Test environment"}
            </Button>
          </div>
          <div className="space-y-3 px-4 pb-4">
            {testEnvironment.error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {testEnvironment.error instanceof Error
                  ? testEnvironment.error.message
                  : "Environment test failed"}
              </div>
            )}
            {testEnvironment.data && <AdapterEnvironmentResult result={testEnvironment.data} />}

            <Field
              label="Chat endpoint"
              hint="Pick a preset to set Provider + Base URL. You can still edit fields below. Same HTTP layer as OpenAI-compatible agents."
            >
              <select
                className={inputClass}
                value={endpointPreset}
                onChange={(e) => onPresetChange(e.target.value as ChatEndpointPresetId)}
              >
                {(Object.keys(CHAT_ENDPOINT_PRESETS) as ChatEndpointPresetId[]).map((id) => (
                  <option key={id} value={id}>
                    {CHAT_ENDPOINT_PRESETS[id].label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] text-muted-foreground"> {CHAT_ENDPOINT_PRESETS[endpointPreset].blurb}</p>
            </Field>

            <Field label="Adapter type" hint={help.adapterType}>
              <div className="rounded-md border border-border px-2.5 py-1.5 text-sm text-foreground bg-muted/20">
                {adapterLabels.openai_compatible} ({`openai_compatible`})
              </div>
            </Field>

            <ui.ConfigFields
              mode="edit"
              isCreate={false}
              adapterType="openai_compatible"
              values={null}
              set={null}
              config={adapterConfig}
              eff={(_g, field, original) => {
                if (field in adapterConfig) return adapterConfig[field] as typeof original;
                return original;
              }}
              mark={(_g, field, value) => {
                setAdapterConfig((prev) => ({ ...prev, [field]: value }));
              }}
              models={[]}
            />
          </div>
        </div>

        <div className="space-y-2 px-4 py-4">
          <Field label="Environment variables" hint={help.envVars}>
            <AdapterEnvVarEditor
              value={env}
              secrets={secretsQuery.data ?? []}
              onCreateSecret={async (name, value) => {
                if (!selectedCompanyId) throw new Error("Select a company");
                return secretsApi.create(selectedCompanyId, { name, value });
              }}
              onChange={(nextEnv) => {
                setAdapterConfig((prev) => {
                  const next = { ...prev };
                  if (nextEnv && Object.keys(nextEnv).length > 0) {
                    next.env = nextEnv;
                  } else {
                    delete next.env;
                  }
                  return next;
                });
              }}
            />
          </Field>
          {apiKeySet ? (
            <p className="text-xs text-muted-foreground">
              A credential is stored. GET responses redact plain values; leave unchanged or set{" "}
              <span className="font-mono">OPENAI_API_KEY</span>,{" "}
              <span className="font-mono">ANTHROPIC_API_KEY</span>,{" "}
              <span className="font-mono">OPENROUTER_API_KEY</span>,{" "}
              <span className="font-mono">MINIMAX_API_KEY</span>, or{" "}
              <span className="font-mono">API_KEY</span> again to rotate.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Set a provider key (plain or secret ref), e.g.{" "}
              <span className="font-mono">OPENAI_API_KEY</span>,{" "}
              <span className="font-mono">ANTHROPIC_API_KEY</span>,{" "}
              <span className="font-mono">MINIMAX_API_KEY</span>, or{" "}
              <span className="font-mono">API_KEY</span>. Add <span className="font-mono">MODEL</span> or{" "}
              <span className="font-mono">MINIMAX_MODEL</span> in env or use the Model field above.
            </p>
          )}
        </div>

        <div className="flex justify-end border-t border-border px-4 py-3">
          <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </section>
    </div>
  );
}
