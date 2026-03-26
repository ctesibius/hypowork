/**
 * Vault API client — canvas topology sync + standard vault CRUD.
 */
import { api } from "./client";

const base = (companyId: string) => `/workspaces/${companyId}/vault`;

export const vaultApi = {
  syncCanvasTopology(companyId: string, documentId: string, graphJson: string) {
    return api.post(`${base(companyId)}/sync-canvas-topology`, { documentId, graphJson });
  },
};
