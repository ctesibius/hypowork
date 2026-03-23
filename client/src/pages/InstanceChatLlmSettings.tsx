import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import type { EnvBinding } from "@paperclipai/shared";
import { instanceSettingsApi } from "@/api/instanceSettings";
import { secretsApi } from "@/api/secrets";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { adapterLabels, Field, help } from "@/components/agent-config-primitives";
import { AdapterEnvVarEditor } from "@/components/adapter-env-var-editor";
import { getUIAdapter } from "@/adapters";

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

  return (
    <div className="max-w-4xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Chat LLM</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          This page now uses the same adapter-config SSOT as agents:{" "}
          <span className="font-mono text-xs">adapterType + adapterConfig + env bindings</span>. For instance chat,
          the current adapter type is <span className="font-mono text-xs">openai_compatible</span> (gateway-style
          HTTP chat completion), and you can configure provider/model/keys exactly like agent env bindings. Use the
          <span className="font-mono text-xs"> Provider </span>
          dropdown below for OpenAI/Anthropic/OpenRouter/Custom key preference. Secret references are resolved per
          company at runtime, so keep your company selected when saving secret refs.
          Optional env overrides:{" "}
          <span className="font-mono text-xs">CHAT_LLM_API_KEY</span>,{" "}
          <span className="font-mono text-xs">CHAT_LLM_BASE_URL</span>,{" "}
          <span className="font-mono text-xs">CHAT_LLM_MODEL</span>.
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

      <section className="rounded-xl border border-border bg-card p-5 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">Enable LLM replies</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              When enabled and credentials are set (env bindings, or CHAT_LLM_* overrides), chat uses your
              provider instead of the placeholder RAG stub.
            </p>
          </div>
          <button
            type="button"
            aria-label="Toggle chat LLM"
            disabled={saveMutation.isPending}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60",
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

        <div className="space-y-4 border-t border-border pt-5">
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

        <div className="space-y-2 border-t border-border pt-5">
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
              <span className="font-mono">OPENROUTER_API_KEY</span>, or{" "}
              <span className="font-mono">API_KEY</span> again to rotate.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Set a provider key env binding (plain or secret ref), e.g.{" "}
              <span className="font-mono">OPENAI_API_KEY</span>,{" "}
              <span className="font-mono">ANTHROPIC_API_KEY</span>,{" "}
              <span className="font-mono">OPENROUTER_API_KEY</span>, or{" "}
              <span className="font-mono">API_KEY</span>.
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </section>
    </div>
  );
}
