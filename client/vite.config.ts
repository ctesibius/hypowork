import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** `use-sidecar` 1.1.3 lists `module` → `dist/es2015/index.js` but the published tarball only ships `dist/es5/`. Point Vite at the real entry. */
const require = createRequire(import.meta.url);
function resolveUseSidecarEs5(): string | undefined {
  try {
    const pkgJson = require.resolve("use-sidecar/package.json", {
      paths: [__dirname, path.join(__dirname, "..")],
    });
    return path.join(path.dirname(pkgJson), "dist/es5/index.js");
  } catch {
    return undefined;
  }
}
const useSidecarEntry = resolveUseSidecarEs5();

/** Workspace package ships `dist/`; local ELK/Mermaid fixes live in `src/` — alias so dev does not require a successful `pnpm build` in that package. */
const codeDrawingRoot = path.resolve(__dirname, "../packages/editor/code-drawing/src");
/** Same for block selection — otherwise Vite serves stale `dist` and local `BlockSelectionAfterEditable` fixes never apply. */
const selectionRoot = path.resolve(__dirname, "../packages/editor/selection/src");
/** Markdown deserializer fixes (`withoutMdx` fallback, etc.) live in `src/` — alias so dev picks them up without rebuilding. */
const markdownPkgRoot = path.resolve(__dirname, "../packages/editor/markdown/src");
// Use 127.0.0.1 (not "localhost") so the proxy matches Nest's default bind (IPv4). "localhost" can
// resolve to ::1 while the API listens on 127.0.0.1 → ECONNREFUSED and Vite reports proxy 500s.
const devBackend = process.env.PAPERCLIP_DEV_BACKEND_URL ?? "http://127.0.0.1:3100";

/** Logs proxy failures to the terminal (this is the "debug" output for ECONNREFUSED — no separate file). */
function backendProxyOptions(extra: { ws?: boolean }) {
  return {
    target: devBackend,
    changeOrigin: true,
    ...extra,
    configure(
      proxy: {
        on: (
          ev: string,
          fn: (...args: unknown[]) => void,
        ) => void;
      },
    ) {
      proxy.on("error", (err: NodeJS.ErrnoException) => {
        const hint =
          err.code === "ECONNREFUSED"
            ? `Nothing accepted the connection at ${devBackend}. In another terminal run: pnpm dev:server — or use pnpm dev:client:wait so the UI starts after /api/health is up.`
            : err.message;
        console.error(`[vite proxy] ${hint}`);
      });
      // Live events use `ws://host/api/workspaces/.../events/ws` (see LiveUpdatesProvider). During Nest
      // `tsx watch` restarts or before listen(), the upgrade socket resets → Vite logs "ws proxy socket
      // error" with ECONNRESET. Treat as expected noise, not an actionable stack trace.
      proxy.on("proxyReqWs", (_proxyReq: unknown, _req: unknown, socket: { on: (ev: string, fn: (err: NodeJS.ErrnoException) => void) => void }) => {
        socket.on("error", (err: NodeJS.ErrnoException) => {
          if (err.code === "ECONNRESET" || err.code === "EPIPE" || err.code === "ECONNABORTED") {
            return;
          }
          console.error(`[vite proxy] WebSocket to ${devBackend}:`, err.message);
        });
      });
    },
  };
}

/** Remind devs where `/api` goes (Vite already prints Local/Network URLs). */
function devApiProxyHint(): Plugin {
  return {
    name: "hypowork-dev-api-proxy-hint",
    apply: "serve",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        console.log(`  ➜  API proxy: ${devBackend} (PAPERCLIP_DEV_BACKEND_URL)`);
      });
    },
  };
}

/**
 * On-page dev diagnostics: Cursor’s embedded browser often uses 127.0.0.1; Chrome/Safari may open
 * `localhost` → ::1 while the server was IPv4-only → blank / failed load with easy-to-miss console.
 * Also surfaces window 'error' / unhandledrejection on the banner when the console filter hides them.
 */
function devClientBootDiagnostics(): Plugin {
  return {
    name: "hypowork-dev-client-boot-diagnostics",
    apply: "serve",
    transformIndexHtml(html) {
      const banner = `
    <div id="pc-dev-boot-banner" style="position:fixed;bottom:10px;right:10px;z-index:2147483647;max-width:min(440px,94vw);font:12px/1.4 ui-monospace,monospace;background:#0d0d0d;color:#7cfc00;padding:10px 12px;border-radius:8px;box-shadow:0 4px 24px #0009;border:1px solid #333">
      <strong>Hypowork dev</strong><br />
      <span id="pc-dev-boot-msg">index.html loaded — waiting for <code>/src/main.tsx</code>…</span>
    </div>
    <script>
(function () {
  function setMsg(html) {
    var m = document.getElementById("pc-dev-boot-msg");
    if (m) { m.innerHTML = html; }
    var b = document.getElementById("pc-dev-boot-banner");
    if (b) { b.style.color = "#ffb4b4"; }
  }
  window.addEventListener("error", function (e) {
    setMsg("window <code>error</code>: " + (e && e.message ? String(e.message) : "unknown"));
  });
  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    setMsg("unhandledrejection: " + (r && r.message ? String(r.message) : String(r)));
  });
})();
    </script>`;
      return html.replace("<body>", `<body>${banner}`);
    },
  };
}

export default defineConfig({
  plugins: [devApiProxyHint(), devClientBootDiagnostics(), react(), tailwindcss()],
  clearScreen: false,
  resolve: {
    alias: [
      // `@platejs/docx-io` → `html-to-vdom` / `mime-types` expect Node `events` + `path`; Vite stubs
      // those builtins in the browser unless we alias to polyfills.
      {
        find: /^events$/,
        replacement: path.resolve(__dirname, "node_modules/events"),
      },
      {
        find: /^node:events$/,
        replacement: path.resolve(__dirname, "node_modules/events"),
      },
      {
        find: /^path$/,
        replacement: path.resolve(__dirname, "node_modules/path-browserify"),
      },
      {
        find: /^node:path$/,
        replacement: path.resolve(__dirname, "node_modules/path-browserify"),
      },
      // Exact subpath first (object-alias order can mis-resolve `@platejs/code-drawing/react`).
      {
        find: "@platejs/code-drawing/react",
        replacement: path.join(codeDrawingRoot, "react/index.ts"),
      },
      {
        find: "@platejs/code-drawing",
        replacement: path.join(codeDrawingRoot, "index.ts"),
      },
      {
        find: "@platejs/selection/react",
        replacement: path.join(selectionRoot, "react/index.ts"),
      },
      {
        find: "@platejs/selection",
        replacement: path.join(selectionRoot, "index.ts"),
      },
      {
        find: "@platejs/markdown",
        replacement: path.join(markdownPkgRoot, "index.ts"),
      },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      { find: "@plate-md", replacement: path.resolve(__dirname, "./src/plate-markdown") },
      ...(useSidecarEntry
        ? [{ find: "use-sidecar", replacement: useSidecarEntry }]
        : []),
    ],
    dedupe: [
      "@platejs/core",
      "platejs",
      "@radix-ui/react-tooltip",
      "mermaid",
      "@mermaid-js/layout-elk",
    ],
  },
  optimizeDeps: {
    include: [
      "@platejs/core",
      "@platejs/core/react",
      "platejs",
      "platejs/react",
      "@radix-ui/react-tooltip",
      "events",
      "path-browserify",
      "react-remove-scroll",
      "use-sidecar",
      "mermaid",
      "@mermaid-js/layout-elk",
    ],
  },
  server: {
    // Listen on all local addresses so both http://127.0.0.1:5173 and http://localhost:5173 work
    // (macOS often resolves localhost → ::1; 127.0.0.1-only bind left external browsers with no server).
    host: true,
    port: 5173,
    proxy: {
      "/api": backendProxyOptions({ ws: true }),
      "/_plugins": backendProxyOptions({}),
    },
  },
});
