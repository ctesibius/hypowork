import * as React from "react";
import { StrictMode } from "react";
import * as ReactDOM from "react-dom";
import { createRoot } from "react-dom/client";
import { Outlet, RouterProvider, createBrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { RouteErrorPage } from "./pages/RouteErrorPage";
import { CompanyProvider } from "./context/CompanyContext";
import { LiveUpdatesProvider } from "./context/LiveUpdatesProvider";
import { BreadcrumbProvider } from "./context/BreadcrumbContext";
import { PanelProvider } from "./context/PanelContext";
import { SidebarProvider } from "./context/SidebarContext";
import { DialogProvider } from "./context/DialogContext";
import { ToastProvider } from "./context/ToastContext";
import { ThemeProvider } from "./context/ThemeContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { initPluginBridge } from "./plugins/bridge-init";
import { PluginLauncherProvider } from "./plugins/launchers";
import "@mdxeditor/editor/style.css";
import "./index.css";

initPluginBridge(React, ReactDOM);

if (import.meta.env.DEV) {
  const msg = document.getElementById("pc-dev-boot-msg");
  if (msg) msg.innerHTML = "<code>main.tsx</code> loaded — running bootstrap()…";
}

async function bootstrap() {
  // Dev: remove any service worker registered in a previous build/session. A stale SW
  // still intercepts /@vite/client and HMR even if we no longer call register() in dev.
  if (import.meta.env.DEV && "serviceWorker" in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (regs.length > 0) {
        await Promise.all(regs.map((r) => r.unregister()));
        // Safari / private mode / partitioned storage: Cache Storage API can throw; must not
        // block reload or app boot (otherwise #root never mounts → blank page, easy to miss in console).
        try {
          if ("caches" in globalThis) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
        } catch {
          /* non-fatal */
        }
        window.location.reload();
        return;
      }
    } catch (e) {
      console.warn("[paperclip] Dev service worker cleanup failed; continuing boot.", e);
    }
  }

  // Production only — SW breaks Vite HMR.
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      void navigator.serviceWorker.register("/sw.js");
    });
  }

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
      },
    },
  });

  /**
   * Layout + splat child so all URLs match; data router enables useBlocker in leaves (e.g. DocumentDetail).
   * Parent path must end with `/*` so descendant `<Routes>` inside `<App />` receives correct pathname
   * context (RR warns otherwise; mismatch can leave `<Outlet />` null → blank UI with only Toaster in #root).
   */
  function AppRootLayout() {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <CompanyProvider>
            <ToastProvider>
              <LiveUpdatesProvider>
                <TooltipProvider>
                  <Toaster richColors position="top-center" />
                  <BreadcrumbProvider>
                    <SidebarProvider>
                      <PanelProvider>
                        <PluginLauncherProvider>
                          <DialogProvider>
                            <Outlet />
                          </DialogProvider>
                        </PluginLauncherProvider>
                      </PanelProvider>
                    </SidebarProvider>
                  </BreadcrumbProvider>
                </TooltipProvider>
              </LiveUpdatesProvider>
            </ToastProvider>
          </CompanyProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
  }

  const router = createBrowserRouter([
    {
      path: "/*",
      element: <AppRootLayout />,
      errorElement: <RouteErrorPage />,
      children: [{ path: "*", element: <App />, errorElement: <RouteErrorPage /> }],
    },
  ]);

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );

  if (import.meta.env.DEV) {
    const msg = document.getElementById("pc-dev-boot-msg");
    if (msg) msg.innerHTML = "React mounted. Removing dev overlay…";
    window.setTimeout(() => document.getElementById("pc-dev-boot-banner")?.remove(), 1200);
  }
}

void bootstrap().catch((e) => {
  console.error("[paperclip] Bootstrap failed:", e);
  const root = document.getElementById("root");
  if (root) {
    root.textContent = "";
    const p = document.createElement("p");
    p.style.cssText = "font-family:system-ui;padding:1rem;max-width:40rem";
    p.textContent =
      "Paperclip failed to start. Check the browser console for details, try a hard refresh, or disable extensions blocking localhost.";
    root.appendChild(p);
  }
});
