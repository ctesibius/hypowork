import { createContext, useContext } from "react";
import type { SfWorkOrder } from "../../api/software-factory";

export type CanvasChromeContextValue = {
  /** When true, canvas nodes should not offer inline editing chrome. */
  viewMode: boolean;
  /** Host canvas document id (for Plate preview bootstrap on primary card). */
  hostDocumentId: string;
  /** Match Page view wikilink → document id resolution for @ / [[ chips in read-only preview. */
  wikilinkMentionResolveDocumentId?: (wikilinkTitle: string) => string | null;
  /**
   * When the canvas document is project-scoped, factory work orders — used to derive PLC `stage` node status
   * from `plc_stage_id` (node id must match template stage id).
   */
  projectWorkOrders?: SfWorkOrder[];
};

export const CanvasChromeContext = createContext<CanvasChromeContextValue>({
  viewMode: false,
  hostDocumentId: "",
});

export function useCanvasChrome(): CanvasChromeContextValue {
  return useContext(CanvasChromeContext);
}
