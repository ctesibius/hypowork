import { describe, expect, it } from "vitest";
import { syntheticMarkdownFromCanvasGraphBody } from "../src/services/document-link-support.js";

/**
 * Phase 1.3 / 1.7g — canvas graph feeds the same link-extraction pipeline as prose.
 * Phase 1.3 — two “agents” worth of content on one synthetic board (Writer + Researcher notes).
 */
describe("Phase 1 — canvas synthetic links + dual-note graph", () => {
  it("merges docPage bodies and docRef @uuid lines for link indexing", () => {
    const graph = JSON.stringify({
      nodes: [
        {
          type: "docPage",
          data: { body: "Writer: see [[Runbook]] and @doc/onboarding" },
        },
        {
          type: "docRef",
          data: { documentId: "550e8400-e29b-41d4-a716-446655440000" },
        },
      ],
      edges: [],
    });
    const md = syntheticMarkdownFromCanvasGraphBody(graph);
    expect(md).toContain("[[Runbook]]");
    expect(md).toContain("@doc/onboarding");
    expect(md).toContain("@550e8400-e29b-41d4-a716-446655440000");
  });

  it("concatenates two agent-scoped sticky bodies (shared company canvas story)", () => {
    const graph = JSON.stringify({
      nodes: [
        { type: "sticky", data: { body: "Agent Writer: draft SOP section A." } },
        { type: "sticky", data: { body: "Agent Researcher: cite [[Policy]] in section B." } },
      ],
      edges: [],
    });
    const md = syntheticMarkdownFromCanvasGraphBody(graph);
    expect(md).toContain("Writer");
    expect(md).toContain("Researcher");
    expect(md).toContain("[[Policy]]");
  });
});
