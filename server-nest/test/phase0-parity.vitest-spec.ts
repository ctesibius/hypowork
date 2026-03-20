import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const hypoworkRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("Phase 0 — static route parity (scripts/phase0-route-parity.mjs)", () => {
  it("passes marker scan for Express + Nest sources", () => {
    const out = execFileSync(process.execPath, [join(hypoworkRoot, "scripts/phase0-route-parity.mjs")], {
      encoding: "utf8",
    });
    expect(out.trim()).toMatch(/\[parity\] OK/);
  });
});
