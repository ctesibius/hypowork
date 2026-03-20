#!/usr/bin/env node
/**
 * Best-effort static list of HTTP route patterns: Nest (@Controller + verbs) vs Express (router.*).
 * Does not prove runtime behavior; use for parity spot-checks alongside `pnpm ci:phase0`.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function walkFiles(dir, pred, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkFiles(p, pred, out);
    else if (pred(p)) out.push(p);
  }
  return out;
}

function extractNestRoutes() {
  const allControllers = walkFiles(join(root, "server-nest", "src"), (p) => p.endsWith(".controller.ts"));
  // LlmsController uses /llms/* without /api — handled separately below.
  const files = allControllers.filter((p) => {
    const n = p.replace(/\\/g, "/");
    return !n.includes("/llms/") && !n.endsWith("/llms.controller.ts");
  });
  const routes = new Set();
  const verbRe = /@(Get|Post|Patch|Put|Delete)\(\s*(?:['"]([^'"]*)['"])?\s*\)/g;

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const ctrl =
      text.match(/@Controller\(\s*['"]([^'"]*)['"]\s*\)/)?.[1] ??
      (text.includes("@Controller()") ? "" : null);
    if (ctrl === null) continue;

    const prefix = ctrl ? `/${ctrl.replace(/^\/+/, "")}` : "";
    verbRe.lastIndex = 0;
    let m;
    while ((m = verbRe.exec(text)) !== null) {
      const verb = m[1].toUpperCase();
      const pathPart = m[2] ?? "";
      const joined = `${prefix}/${pathPart.replace(/^\/+/, "")}`.replace(/\/+/g, "/") || "/";
      routes.add(`${verb} /api${joined === "//" ? "/" : joined}`);
    }
  }

  // LLM routes are excluded from global /api prefix
  const llms = walkFiles(join(root, "server-nest", "src", "llms"), (p) => p.endsWith(".controller.ts"));
  for (const file of llms) {
    const text = readFileSync(file, "utf8");
    let m;
    const r = /@(Get|Post)\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((m = r.exec(text)) !== null) {
      routes.add(`${m[1].toUpperCase()} /${m[2].replace(/^\/+/, "")} (no /api prefix)`);
    }
  }

  return [...routes].sort();
}

function extractExpressRoutes() {
  const dir = join(root, "server", "src", "routes");
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"));
  const routes = new Set();
  const lineRe =
    /router\.(get|post|patch|put|delete)\(\s*['"]([^'"]+)['"]|app\.(get|post)\(\s*['"]([^'"]+)['"]/gi;

  for (const f of files) {
    const text = readFileSync(join(dir, f), "utf8");
    let m;
    while ((m = lineRe.exec(text)) !== null) {
      const method = (m[1] ?? m[3] ?? "?").toUpperCase();
      const path = m[2] ?? m[4] ?? "";
      if (!path || path.includes("function")) continue;
      const api = path.startsWith("/api") ? path : `/api${path.startsWith("/") ? path : `/${path}`}`;
      routes.add(`${method} ${api}`);
    }
  }

  // app.ts mounts llmRoutes at root — also list llms.ts paths without /api
  const llmsPath = join(dir, "llms.ts");
  try {
    const text = readFileSync(llmsPath, "utf8");
    const r = /router\.(get)\(\s*['"]([^'"]+)['"]/gi;
    let m;
    while ((m = r.exec(text)) !== null) {
      routes.add(`${m[1].toUpperCase()} ${m[2]} (Express: mounted outside /api in app.ts)`);
    }
  } catch {
    /* skip */
  }

  return [...routes].sort();
}

const nest = extractNestRoutes();
const express = extractExpressRoutes();

console.log("=== Nest (static scan, most routes under /api) ===\n");
console.log(nest.join("\n"));
console.log(`\n(${nest.length} lines)\n`);

console.log("=== Express routers (static scan) ===\n");
console.log(express.join("\n"));
console.log(`\n(${express.length} lines)\n`);

console.log(
  "Note: This is grep-level, not OpenAPI. For parity, also run: pnpm ci:phase0\n",
);
