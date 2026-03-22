import type { Edge, Node } from "@xyflow/react";
import { api } from "./client.js";

export type CanvasPayload = {
  nodes: Node[];
  edges: Edge[];
};

export const canvasesApi = {
  get(companyId: string): Promise<CanvasPayload> {
    return api.get<CanvasPayload>(`/companies/${companyId}/canvas`);
  },
  save(companyId: string, data: CanvasPayload): Promise<CanvasPayload> {
    return api.patch<CanvasPayload>(`/companies/${companyId}/canvas`, data);
  },
};
