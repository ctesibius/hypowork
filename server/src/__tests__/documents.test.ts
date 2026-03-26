import { describe, expect, it } from "vitest";
import { extractLegacyPlanBody, mergeProjectScopedDocumentRows, type StandaloneDocumentListRow } from "../services/documents.js";

function row(id: string, updatedAtMs: number): StandaloneDocumentListRow {
  const t = new Date(updatedAtMs);
  return {
    id,
    companyId: "c1",
    projectId: null,
    folderPath: null,
    title: null,
    format: "markdown",
    kind: "prose",
    latestBody: "",
    canvasGraphJson: null,
    latestRevisionId: null,
    latestRevisionNumber: 1,
    createdByAgentId: null,
    createdByUserId: null,
    updatedByAgentId: null,
    updatedByUserId: null,
    createdAt: t,
    updatedAt: t,
  };
}

describe("mergeProjectScopedDocumentRows", () => {
  it("dedupes by id and sorts by updatedAt descending", () => {
    const a = row("a", 100);
    const b = row("b", 300);
    const c = row("c", 200);
    const merged = mergeProjectScopedDocumentRows([a, b], [c]);
    expect(merged.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("does not duplicate the same id across standalone and issue-linked", () => {
    const one = row("same", 400);
    const merged = mergeProjectScopedDocumentRows([one], [one]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.id).toBe("same");
  });
});

describe("extractLegacyPlanBody", () => {
  it("returns null when no plan block exists", () => {
    expect(extractLegacyPlanBody("hello world")).toBeNull();
  });

  it("extracts plan body from legacy issue descriptions", () => {
    expect(
      extractLegacyPlanBody(`
intro

<plan>

# Plan

- one
- two

</plan>
      `),
    ).toBe("# Plan\n\n- one\n- two");
  });

  it("ignores empty plan blocks", () => {
    expect(extractLegacyPlanBody("<plan>   </plan>")).toBeNull();
  });
});
