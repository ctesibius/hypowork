import { describe, expect, it } from "vitest";
import {
  embedProseMarkdownInCanvasGraph,
  extractPrimaryDocPageMarkdown,
  stripPrimaryDocPageBodyFromGraph,
} from "@paperclipai/shared";

describe("canvas vs prose SSOT (shared helpers)", () => {
  const docId = "550e8400-e29b-41d4-a716-446655440000";

  it("embed then strip leaves no duplicate prose in stored graph", () => {
    const embedded = embedProseMarkdownInCanvasGraph("hello **world**", docId, "Title");
    const stripped = stripPrimaryDocPageBodyFromGraph(embedded, docId);
    expect(extractPrimaryDocPageMarkdown(stripped, docId)).toBe("");
    expect(stripped).toContain('"body":""');
  });

  it("extractPrimaryDocPageMarkdown reads primary docPage only", () => {
    const graph = JSON.stringify({
      nodes: [
        {
          id: "a",
          type: "sticky",
          data: { body: "sticky text" },
        },
        {
          id: "b",
          type: "docPage",
          data: { body: "primary", documentId: docId, isPrimaryDocument: true },
        },
      ],
      edges: [],
    });
    expect(extractPrimaryDocPageMarkdown(graph, docId)).toBe("primary");
  });
});
