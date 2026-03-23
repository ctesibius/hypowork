"use client";

import { useEffect, useId, useState } from "react";
import { preprocessMermaidSourceForDarkMode } from "@/lib/mermaidDarkModeSource";
import { CopyToClipboardButton } from "@/components/ui/copy-to-clipboard-button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/context/ThemeContext";

let mermaidLoaderPromise: Promise<typeof import("mermaid").default> | null = null;
let mermaidElkRegistered = false;

function loadMermaid() {
  if (!mermaidLoaderPromise) {
    mermaidLoaderPromise = import("mermaid").then((module) => module.default);
  }
  return mermaidLoaderPromise;
}

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

export interface MermaidDiagramProps {
  source: string;
  className?: string;
  /** When false, skip render (parent may show placeholder). */
  showCopyButton?: boolean;
}

/**
 * Renders Mermaid source to SVG (same pipeline as {@link MarkdownBody} fenced ```mermaid blocks).
 */
export function MermaidDiagram({ source, className, showCopyButton = true }: MermaidDiagramProps) {
  const { theme } = useTheme();
  const darkMode = theme === "dark";
  const renderId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSvg(null);
    setError(null);

    const trimmed = source.trim();
    if (!trimmed) {
      return () => {
        active = false;
      };
    }

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
        const mermaidSource = darkMode ? preprocessMermaidSourceForDarkMode(trimmed) : trimmed;
        const rendered = await mermaid.render(`hypowork-mermaid-${renderId}`, mermaidSource);
        if (!active) return;
        setSvg(rendered.svg);
      })
      .catch((err) => {
        if (!active) return;
        const message =
          err instanceof Error && err.message ? err.message : "Failed to render Mermaid diagram.";
        setError(message);
      });

    return () => {
      active = false;
    };
  }, [darkMode, renderId, source]);

  if (!source.trim()) {
    return null;
  }

  return (
    <div className={cn("paperclip-mermaid relative", className)}>
      {svg ? (
        <>
          {showCopyButton ? (
            <div className="pointer-events-auto absolute top-2 right-2 z-10">
              <CopyToClipboardButton text={source.trim()} className="size-7" />
            </div>
          ) : null}
          <div dangerouslySetInnerHTML={{ __html: svg }} />
        </>
      ) : (
        <>
          <p className={cn("paperclip-mermaid-status", error && "paperclip-mermaid-status-error")}>
            {error ? `Unable to render Mermaid diagram: ${error}` : "Rendering Mermaid diagram…"}
          </p>
          <pre className="paperclip-mermaid-source">
            <code className="language-mermaid">{source}</code>
          </pre>
        </>
      )}
    </div>
  );
}
