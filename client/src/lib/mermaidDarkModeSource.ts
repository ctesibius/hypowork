/**
 * Preprocess Mermaid source for app dark mode (same behavior as @platejs/code-drawing’s helper;
 * inlined because the published package .d.ts does not export it).
 */
const DARK_SURFACE = { r: 30, g: 30, b: 33 } as const;
const FILL_MIX_TOWARD_SURFACE = 0.72;
const FILL_LUMINANCE_SKIP_BELOW = 0.42;

const FILL_HEX = /fill:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\b/gi;
const STROKE_NEUTRAL_DARK =
  /stroke:\s*#(000000|000|111111|111|222222|222|333333|333|444444|444)\b/gi;

type RGB = { r: number; g: number; b: number };

function expandHex3(hex: string): string {
  const h = hex.slice(1);
  if (h.length === 3) {
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
  }
  return hex.toLowerCase();
}

function parseHex6(hex: string): RGB | null {
  const h = expandHex3(hex);
  const m = /^#([0-9a-f]{6})$/i.exec(h);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function relativeLuminance(r: number, g: number, b: number): number {
  const lin = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function mixRgbTowardSurface(rgb: RGB, t: number): string {
  const r = Math.round(rgb.r * (1 - t) + DARK_SURFACE.r * t);
  const g = Math.round(rgb.g * (1 - t) + DARK_SURFACE.g * t);
  const b = Math.round(rgb.b * (1 - t) + DARK_SURFACE.b * t);
  const clamp = (n: number) => Math.max(0, Math.min(255, n));
  const to = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function transformStyleFragment(line: string): string {
  let out = line.replace(FILL_HEX, (match, hex: string) => {
    const rgb = parseHex6(hex);
    if (!rgb) return match;
    if (relativeLuminance(rgb.r, rgb.g, rgb.b) < FILL_LUMINANCE_SKIP_BELOW) {
      return match;
    }
    return `fill:${mixRgbTowardSurface(rgb, FILL_MIX_TOWARD_SURFACE)}`;
  });
  out = out.replace(STROKE_NEUTRAL_DARK, 'stroke:#9ca3af');
  return out;
}

export function preprocessMermaidSourceForDarkMode(source: string): string {
  const lines = source.split('\n');
  const out = lines.map((line) => {
    const t = line.trimStart();
    if (/^classDef\s/i.test(t) || /^style\s/i.test(t)) {
      return transformStyleFragment(line);
    }
    return line;
  });
  return out.join('\n');
}
