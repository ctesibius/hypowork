/**
 * remark-mdx stringifies plain `[[title]]` text with escapes so MDX does not treat `[` as JSX/expression.
 * The document-link extractor expects raw Obsidian-style `[[...]]` (see server `WIKILINK_RE`).
 * Only touch segments **outside** ``` fenced blocks so Mermaid / code like `["label"]` stays intact.
 */
export function normalizeMarkdownWikilinksForPersistence(md: string): string {
  const fenceRe = /```[\s\S]*?```/g;
  const out: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(md)) !== null) {
    out.push(rewriteWikilinkEscapesIn(md.slice(last, m.index)));
    out.push(m[0]);
    last = m.index + m[0].length;
  }
  out.push(rewriteWikilinkEscapesIn(md.slice(last)));
  return out.join('');
}

const ZERO_WIDTH = /\u200b|\u200c|\u200d|\ufeff|\u2060/g;

function rewriteWikilinkEscapesIn(s: string): string {
  // ZWSP/BOM breaks `\[[` detection (log: `​\\[[2nd note]]`).
  let t = s.replace(ZERO_WIDTH, '');

  for (let i = 0; i < 8; i++) {
    const prev = t;
    // `\[[title]]` — MDX text escape
    t = t.replace(/\\\[\[([^\]]+)\]\]/g, '[[$1]]');
    // `[\[title]]` — stray `[` + `\[` + title + `]]`
    t = t.replace(/\[\\\[([^\]]+)\]\]/g, '[[$1]]');
    // `\[\[title\]\]` — all four brackets escaped
    t = t.replace(/\\\[\[([^\]]+)\\\]\\\]/g, '[[$1]]');
    if (t === prev) break;
  }

  // Collapse whitespace inside titles so `[[`…`]]` survives MDX/Slate churn (log had newlines inside the span).
  t = t.replace(
    /\[\[([^\]|#]+)(#[^\]]*)?(\|[^\]]*)?\]\]/g,
    (full, title: string, hash?: string, alias?: string) => {
      const tt = title.replace(/\s+/g, ' ').trim();
      if (!tt) return full;
      return `[[${tt}${hash ?? ''}${alias ?? ''}]]`;
    },
  );

  return t;
}
