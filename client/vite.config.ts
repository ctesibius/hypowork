import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Use 127.0.0.1 (not "localhost") so the proxy matches Nest’s default bind (IPv4). "localhost" can
// resolve to ::1 while the API listens on 127.0.0.1 → ECONNREFUSED and Vite reports proxy 500s.
const devBackend = process.env.PAPERCLIP_DEV_BACKEND_URL ?? "http://127.0.0.1:3100";

/** Logs proxy failures to the terminal (this is the “debug” output for ECONNREFUSED — no separate file). */
function backendProxyOptions(extra: { ws?: boolean }) {
  return {
    target: devBackend,
    changeOrigin: true,
    ...extra,
    configure(proxy: { on: (ev: string, fn: (err: NodeJS.ErrnoException) => void) => void }) {
      proxy.on("error", (err: NodeJS.ErrnoException) => {
        const hint =
          err.code === "ECONNREFUSED"
            ? `Nothing accepted the connection at ${devBackend}. In another terminal run: pnpm dev:server — or use pnpm dev:client:wait so the UI starts after /api/health is up.`
            : err.message;
        console.error(`[vite proxy] ${hint}`);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": backendProxyOptions({ ws: true }),
      "/_plugins": backendProxyOptions({}),
    },
  },
});
