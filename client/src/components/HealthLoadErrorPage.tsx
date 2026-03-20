import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  message: string;
  onRetry: () => void;
  isRetrying?: boolean;
};

function parseTrailingHttpStatus(message: string): string | null {
  const m = message.match(/\((\d{3})\)\s*$/);
  return m?.[1] ?? null;
}

export function HealthLoadErrorPage({ message, onRetry, isRetrying }: Props) {
  const statusCode = parseTrailingHttpStatus(message);
  const showDevDiagnostics = import.meta.env.DEV;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const diagnosticScript = `# Verify the API from this browser origin
curl -fsS -i "${origin}/api/health"

# Local dev: start the API (Nest) in another terminal
pnpm dev:server`;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="flex gap-4 items-start">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive"
            aria-hidden
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">API health</p>
            <h1 className="text-xl font-semibold tracking-tight">Could not reach the server</h1>
            {statusCode ? (
              <p className="font-mono text-sm text-muted-foreground">HTTP {statusCode}</p>
            ) : null}
            <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
          </div>
        </div>

        {showDevDiagnostics ? (
          <div className="mt-8">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Diagnostics (dev only)</p>
            <pre
              className="overflow-x-auto rounded-lg border border-border bg-muted/50 p-4 text-left text-xs leading-relaxed font-mono text-foreground/90"
              tabIndex={0}
            >
              {diagnosticScript}
            </pre>
          </div>
        ) : (
          <p className="mt-8 text-sm text-muted-foreground leading-relaxed">
            If this continues, try again later or contact whoever runs this instance.
          </p>
        )}

        <div className="mt-6">
          <Button type="button" onClick={onRetry} disabled={isRetrying} className="gap-2">
            <RefreshCw className={cn("h-4 w-4 shrink-0", isRetrying && "animate-spin")} aria-hidden />
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
