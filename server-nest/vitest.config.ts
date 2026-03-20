import { defineConfig } from "vitest/config";

/** Fast contract checks (no DB). E2E uses `vitest.e2e.config.ts`. */
export default defineConfig({
  test: {
    include: ["test/**/*.vitest-spec.ts"],
  },
});
