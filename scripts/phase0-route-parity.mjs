#!/usr/bin/env node
/**
 * Phase 0 — lightweight Express vs Nest surface check: key route markers must exist in both codepaths.
 * Does not start servers; safe for CI. Extend ROUTE_MARKERS as parity grows.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const ROUTE_MARKERS = [
  { id: "health", nest: '@Controller("health")', express: "healthRoutes" },
  { id: "cost-events", nest: "cost-events", express: "cost-events" },
  { id: "issues-heartbeat-context", nest: "heartbeat-context", express: "heartbeat-context" },
  { id: "plugins-mount", nest: "createPluginStack", express: "pluginRoutes" },
  { id: "board-guard", nest: "board-mutation", express: "boardMutationGuard" },
  { id: "activity-redaction", nest: "@paperclipai/server/redaction", express: "export function activityRoutes" },
  { id: "access-company-invites", nest: "companies/:companyId/invites", express: "companies/:companyId/invites" },
  { id: "nest-llms-prefix", nest: "applyApiGlobalPrefix", express: "llmRoutes" },
  { id: "embedded-db-bootstrap", nest: "prepareNestDatabaseEnv", express: "startEmbeddedPostgresDatabase" },
];

function walkHasMarker(dir, needle) {
  try {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === "dist") continue;
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) {
        if (walkHasMarker(p, needle)) return true;
      } else if (name.endsWith(".ts") && !name.endsWith(".d.ts")) {
        const t = readFileSync(p, "utf8");
        if (t.includes(needle)) return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

let failed = false;
for (const m of ROUTE_MARKERS) {
  const nestHit = walkHasMarker(join(root, "server-nest/src"), m.nest);
  const expressHit = walkHasMarker(join(root, "server/src"), m.express);
  if (!nestHit || !expressHit) {
    failed = true;
    console.error(
      `[parity] ${m.id}: nest=${nestHit ? "ok" : "MISSING"} express=${expressHit ? "ok" : "MISSING"} (nest:${m.nest} express:${m.express})`,
    );
  }
}

if (failed) {
  process.exit(1);
}
console.log(`[parity] OK (${ROUTE_MARKERS.length} markers)`);
