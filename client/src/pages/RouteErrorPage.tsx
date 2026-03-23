import { useEffect } from "react";
import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";
import { Bug, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Data-router error boundary UI (replaces React Router’s default “Unexpected Application Error”).
 * Catches render / loader / action failures under `errorElement` in `main.tsx`.
 *
 * Intentionally avoids BreadcrumbProvider / CompanyContext so it still renders if the layout
 * fails before those providers mount (parent-route errors).
 */
export function RouteErrorPage() {
  const error = useRouteError();

  useEffect(() => {
    document.title = "Error · Paperclip";
  }, []);

  const message =
    error instanceof Error
      ? error.message
      : isRouteErrorResponse(error)
        ? `${error.status} ${error.statusText}`
        : typeof error === "string"
          ? error
          : "Unexpected error";

  const status = isRouteErrorResponse(error) ? error.status : null;
  const title =
    status === 404 ? "Page not found" : status != null && status >= 500 ? "Server error" : "Something went wrong";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-md border border-destructive/20 bg-destructive/10 p-2">
            <Bug className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground">
              The app hit an error while rendering this screen. You can reload or go back to a safe page.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Details: </span>
          <span className="break-words">{message}</span>
        </div>

        {import.meta.env.DEV && error instanceof Error && error.stack ? (
          <details className="mt-4 rounded-md border border-border bg-muted/30">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">
              Developer stack trace
            </summary>
            <pre className="max-h-64 overflow-auto border-t border-border p-3 text-xs leading-relaxed">
              {error.stack}
            </pre>
          </details>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Reload page
          </Button>
          <Button variant="outline" asChild>
            <Link to="/" replace>
              <Home className="mr-1.5 h-4 w-4" />
              Go home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
