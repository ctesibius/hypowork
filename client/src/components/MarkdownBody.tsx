"use client";

import { isValidElement, useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { preprocessMermaidSourceForDarkMode } from "../lib/mermaidDarkModeSource";
import { parseProjectMentionHref } from "@paperclipai/shared";
import { CopyToClipboardButton } from "@/components/ui/copy-to-clipboard-button";
import { cn } from "../lib/utils";
import { useTheme } from "../context/ThemeContext";

interface MarkdownBodyProps {
  children: string;
  className?: string;
}

let mermaidLoaderPromise: Promise<typeof import("mermaid").default> | null = null;
let mermaidElkRegistered = false;

function loadMermaid() {
  if (!mermaidLoaderPromise) {
    mermaidLoaderPromise = import("mermaid").then((module) => module.default);
  }
  return mermaidLoaderPromise;
}

/** Mermaid 11+ does not bundle ELK; registerLayoutLoaders must run before initialize. */
async function registerMermaidElkLayouts(mermaid: typeof import("mermaid").default) {
  if (mermaidElkRegistered) return;
  try {
    const elkMod = await import("@mermaid-js/layout-elk");
    const layouts = elkMod.default ?? elkMod;
    mermaid.registerLayoutLoaders(layouts as never);
    mermaidElkRegistered = true;
  } catch {
    // optional
  }
}

function flattenText(value: ReactNode): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((item) => flattenText(item)).join("");
  return "";
}

function extractMermaidSource(children: ReactNode): string | null {
  if (!isValidElement(children)) return null;
  const childProps = children.props as { className?: unknown; children?: ReactNode };
  if (typeof childProps.className !== "string") return null;
  if (!/\blanguage-mermaid\b/i.test(childProps.className)) return null;
  return flattenText(childProps.children).replace(/\n$/, "");
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = match[1];
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function mentionChipStyle(color: string | null): CSSProperties | undefined {
  if (!color) return undefined;
  const rgb = hexToRgb(color);
  if (!rgb) return undefined;
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return {
    borderColor: color,
    backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)`,
    color: luminance > 0.55 ? "#111827" : "#f8fafc",
  };
}

function MermaidDiagramBlock({ source, darkMode }: { source: string; darkMode: boolean }) {
  const renderId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSvg(null);
    setError(null);

    loadMermaid()
      .then(async (mermaid) => {
        await registerMermaidElkLayouts(mermaid);
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: darkMode ? "dark" : "default",
          ...(darkMode
            ? {
                themeVariables: {
                  lineColor: "#d4d4d4",
                  arrowheadColor: "#d4d4d4",
                },
              }
            : {}),
          fontFamily: "inherit",
          suppressErrorRendering: true,
          flowchart: { htmlLabels: true },
        });
        const mermaidSource = darkMode ? preprocessMermaidSourceForDarkMode(source) : source;
        const rendered = await mermaid.render(`paperclip-mermaid-${renderId}`, mermaidSource);
        if (!active) return;
        setSvg(rendered.svg);
      })
      .catch((err) => {
        if (!active) return;
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Failed to render Mermaid diagram.";
        setError(message);
      });

    return () => {
      active = false;
    };
  }, [darkMode, renderId, source]);

  return (
    <div className="paperclip-mermaid relative">
      {svg ? (
        <>
          <div className="pointer-events-auto absolute top-2 right-2 z-10">
            <CopyToClipboardButton text={source} className="size-7" />
          </div>
          <div dangerouslySetInnerHTML={{ __html: svg }} />
        </>
      ) : (
        <>
          <p className={cn("paperclip-mermaid-status", error && "paperclip-mermaid-status-error")}>
            {error ? `Unable to render Mermaid diagram: ${error}` : "Rendering Mermaid diagram..."}
          </p>
          <pre className="paperclip-mermaid-source">
            <code className="language-mermaid">{source}</code>
          </pre>
        </>
      )}
    </div>
  );
}

export function MarkdownBody({ children, className }: MarkdownBodyProps) {
  const { theme } = useTheme();
  return (
    <div
      className={cn(
        "paperclip-markdown prose prose-sm max-w-none break-words overflow-hidden",
        theme === "dark" && "prose-invert",
        className,
      )}
    >
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ node: _node, children: preChildren, className: preClassName, ...preProps }) => {
            const mermaidSource = extractMermaidSource(preChildren);
            if (mermaidSource) {
              return <MermaidDiagramBlock source={mermaidSource} darkMode={theme === "dark"} />;
            }
            const copyText = flattenText(preChildren).replace(/\n$/, "");
            return (
              <div className="relative">
                <div className="pointer-events-auto absolute top-2 right-2 z-10">
                  <CopyToClipboardButton text={copyText} className="size-7" />
                </div>
                <pre {...preProps} className={cn(preClassName, "pr-14")}>
                  {preChildren}
                </pre>
              </div>
            );
          },
          blockquote: ({ children, className: bqClassName, ...bqProps }) => (
            <div className="relative">
              <div className="pointer-events-auto absolute top-2 right-2 z-10">
                <CopyToClipboardButton text={flattenText(children)} className="size-7" />
              </div>
              <blockquote {...bqProps} className={cn(bqClassName, "pr-12")}>
                {children}
              </blockquote>
            </div>
          ),
          a: ({ href, children: linkChildren }) => {
            const parsed = href ? parseProjectMentionHref(href) : null;
            if (parsed) {
              const label = linkChildren;
              return (
                <a
                  href={`/projects/${parsed.projectId}`}
                  className="paperclip-project-mention-chip"
                  style={mentionChipStyle(parsed.color)}
                >
                  {label}
                </a>
              );
            }
            return (
              <a href={href} rel="noreferrer">
                {linkChildren}
              </a>
            );
          },
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}
