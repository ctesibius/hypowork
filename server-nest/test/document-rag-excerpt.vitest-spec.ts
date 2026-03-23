import { describe, expect, it } from "vitest";
import { excerptDocumentBodyForRag } from "../src/chat/document-rag-excerpt.util.js";

describe("document-neighborhood RAG excerpt", () => {
  it("truncates prose", () => {
    const long = "word ".repeat(200);
    expect(excerptDocumentBodyForRag(long, "prose").length).toBeLessThanOrEqual(500);
  });

  it("joins canvas node bodies", () => {
    const body = JSON.stringify({
      nodes: [{ data: { body: "alpha" } }, { data: { body: "beta" } }],
    });
    expect(excerptDocumentBodyForRag(body, "canvas")).toContain("alpha");
    expect(excerptDocumentBodyForRag(body, "canvas")).toContain("beta");
  });
});
