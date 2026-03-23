import { createContext, useContext } from "react";

export type CanvasChromeContextValue = {
  /** When true, canvas nodes should not offer inline editing chrome. */
  viewMode: boolean;
  /** Host canvas document id (for Plate preview bootstrap on primary card). */
  hostDocumentId: string;
  /** Match Page view wikilink → document id resolution for @ / [[ chips in read-only preview. */
  wikilinkMentionResolveDocumentId?: (wikilinkTitle: string) => string | null;
};

export const CanvasChromeContext = createContext<CanvasChromeContextValue>({
  viewMode: false,
  hostDocumentId: "",
});

export function useCanvasChrome(): CanvasChromeContextValue {
  return useContext(CanvasChromeContext);
}
