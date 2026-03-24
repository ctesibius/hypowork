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

  it("extract prefers isPrimaryDocument over earlier docPage with same documentId (stale ref must not wipe SSOT)", () => {
    const graph = JSON.stringify({
      nodes: [
        {
          id: "ref-first",
          type: "docPage",
          data: {
            body: "short stale",
            documentId: docId,
            isPrimaryDocument: false,
          },
        },
        {
          id: "host-card",
          type: "docPage",
          data: {
            body: "long canonical prose from host card",
            documentId: docId,
            isPrimaryDocument: true,
          },
        },
      ],
      edges: [],
    });
    expect(extractPrimaryDocPageMarkdown(graph, docId)).toBe("long canonical prose from host card");
  });

  it("extract prefers longest among explicit primary docPages (same documentId)", () => {
    const graph = JSON.stringify({
      nodes: [
        {
          id: "a",
          type: "docPage",
          data: {
            body: "short",
            documentId: docId,
            isPrimaryDocument: true,
          },
        },
        {
          id: "b",
          type: "docPage",
          data: {
            body: "longer canonical",
            documentId: docId,
            isPrimaryDocument: true,
          },
        },
      ],
      edges: [],
    });
    expect(extractPrimaryDocPageMarkdown(graph, docId)).toBe("longer canonical");
  });

  it("extract prefers longest body when multiple docPages share documentId and none is explicitly primary", () => {
    const graph = JSON.stringify({
      nodes: [
        {
          id: "ref-first",
          type: "docPage",
          data: {
            body: "short stale",
            documentId: docId,
            isPrimaryDocument: false,
          },
        },
        {
          id: "another-ref",
          type: "docPage",
          data: {
            body: "long canonical prose without explicit isPrimaryDocument flag",
            documentId: docId,
            isPrimaryDocument: false,
          },
        },
      ],
      edges: [],
    });
    expect(extractPrimaryDocPageMarkdown(graph, docId)).toBe(
      "long canonical prose without explicit isPrimaryDocument flag",
    );
  });
});
