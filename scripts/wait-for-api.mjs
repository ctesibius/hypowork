#!/usr/bin/env node
/**
 * Blocks until Nest (or any Paperclip API) responds on GET /api/health.
 * Use before `pnpm dev:client` if the client starts faster than the server binds.
 *
 * Env:
 *   PAPERCLIP_DEV_BACKEND_URL — same as Vite (default http://127.0.0.1:3100)
 *   WAIT_FOR_API_MS — max wait (default 120000)
 */
const base = (process.env.PAPERCLIP_DEV_BACKEND_URL ?? "http://127.0.0.1:3100").replace(/\/$/, "");
const url = `${base}/api/health`;
const maxMs = Number(process.env.WAIT_FOR_API_MS ?? 120000);
const intervalMs = 500;

const start = Date.now();
let lastLog = 0;

async function once() {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(2500),
      headers: { Accept: "application/json" },
    });
    return res.ok;
  } catch {
    return false;
  }
}

while (true) {
  if (await once()) {
    console.log(`[wait-for-api] OK ${url} (${Date.now() - start}ms)`);
    process.exit(0);
  }
  if (Date.now() - start > maxMs) {
    console.error(
      `[wait-for-api] Timed out after ${maxMs}ms — nothing answered at ${url}\n` +
        `  Start the API first:  pnpm dev:server\n` +
        `  Or set PAPERCLIP_DEV_BACKEND_URL if the API uses another host/port.`,
    );
    process.exit(1);
  }
  if (Date.now() - lastLog > 4000) {
    lastLog = Date.now();
    console.log(`[wait-for-api] Waiting for ${url} …`);
  }
  await new Promise((r) => setTimeout(r, intervalMs));
}
