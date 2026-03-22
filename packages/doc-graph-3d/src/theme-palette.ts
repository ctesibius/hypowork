/**
 * Matches Hypowork `ThemeContext`: `light`, parchment `mid`, and `dark`.
 * Colors are tuned for 3D nodes/links on the force-graph canvas (not CSS variables).
 */
export type DocGraphAppTheme = "light" | "mid" | "dark";

export type DocGraphThemePalette = {
  background: string;
  proseNode: string;
  canvasNode: string;
  minimalNode: string;
  particlesNode: string;
  arrowsNode: string;
  curvedNode: string;
  defaultLinkOpacity: number;
  /** Base node color in highlight preset before hover. */
  highlightDim: string;
};

export function getDocGraphThemePalette(theme: DocGraphAppTheme): DocGraphThemePalette {
  switch (theme) {
    case "dark":
      return {
        background: "#0c0c0f",
        proseNode: "#5dade2",
        canvasNode: "#f9e79f",
        minimalNode: "#8ab4f8",
        particlesNode: "#7ec8e3",
        arrowsNode: "#82e0aa",
        curvedNode: "#d7bde2",
        defaultLinkOpacity: 0.42,
        highlightDim: "rgba(120,160,200,0.38)",
      };
    case "mid":
      return {
        background: "#d4cbb8",
        proseNode: "#1e5f7a",
        canvasNode: "#9a6b16",
        minimalNode: "#3d5a73",
        particlesNode: "#2c6f7f",
        arrowsNode: "#2a5c3e",
        curvedNode: "#5c4270",
        defaultLinkOpacity: 0.5,
        highlightDim: "rgba(75,60,48,0.58)",
      };
    case "light":
    default:
      return {
        background: "#f4f4f5",
        proseNode: "#0984e3",
        canvasNode: "#d4ac0d",
        minimalNode: "#1a73e8",
        particlesNode: "#2471a3",
        arrowsNode: "#1e8449",
        curvedNode: "#7d3c98",
        defaultLinkOpacity: 0.42,
        highlightDim: "rgba(80,120,180,0.45)",
      };
  }
}
