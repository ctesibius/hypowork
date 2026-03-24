import pc from "picocolors";

const TAGLINE = "Open-source orchestration for zero-human companies";

export function printPaperclipCliBanner(): void {
  const lines = [
    "",
    pc.bold(pc.cyan("  ═══ Hypowork ═══")),
    pc.blue("  ───────────────────────────────────────────────────────"),
    pc.bold(pc.white(`  ${TAGLINE}`)),
    "",
  ];

  console.log(lines.join("\n"));
}
