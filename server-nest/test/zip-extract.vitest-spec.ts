import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { extractMarkdownFilesFromZip } from "../src/document-import/zip-extract.js";

describe("zip-extract (fflate)", () => {
  it("extracts nested markdown with non-empty body", async () => {
    const zipped = zipSync({
      "vault/daily/note.md": strToU8("---\ntitle: Hi\n---\n\nHello **world**"),
    });
    const files = await extractMarkdownFilesFromZip(Buffer.from(zipped));
    expect(files.length).toBe(1);
    expect(files[0]!.filename).toBe("vault/daily/note.md");
    expect(files[0]!.content.length).toBeGreaterThan(0);
    expect(files[0]!.content).toContain("Hello");
  });

  it("skips __MACOSX paths", async () => {
    const zipped = zipSync({
      "__MACOSX/._x.md": strToU8("bad"),
      "ok/x.md": strToU8("# ok"),
    });
    const files = await extractMarkdownFilesFromZip(Buffer.from(zipped));
    expect(files.length).toBe(1);
    expect(files[0]!.filename).toBe("ok/x.md");
  });

  it("matches .MD basename case-insensitively", async () => {
    const zipped = zipSync({
      "folder/Read.MD": strToU8("# Title"),
    });
    const files = await extractMarkdownFilesFromZip(Buffer.from(zipped));
    expect(files.length).toBe(1);
    expect(files[0]!.content).toContain("Title");
  });
});
