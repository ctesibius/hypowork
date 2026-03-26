import type {
  Company,
  CompanyPortabilityExportResult,
  CompanyPortabilityImportRequest,
  CompanyPortabilityImportResult,
  CompanyPortabilityPreviewRequest,
  CompanyPortabilityPreviewResult,
} from "@paperclipai/shared";
import { api } from "./client";

export type CompanyStats = Record<string, { agentCount: number; issueCount: number }>;

const WS = "/workspaces";

/** Canonical workspace CRUD + portability (tenant root = workspace row). */
export const workspacesApi = {
  list: () => api.get<Company[]>(WS),
  get: (workspaceId: string) => api.get<Company>(`${WS}/${workspaceId}`),
  stats: () => api.get<CompanyStats>(`${WS}/stats`),
  create: (data: {
    name: string;
    description?: string | null;
    budgetMonthlyCents?: number;
  }) => api.post<Company>(WS, data),
  update: (
    workspaceId: string,
    data: Partial<
      Pick<
        Company,
        | "name"
        | "description"
        | "status"
        | "budgetMonthlyCents"
        | "requireBoardApprovalForNewAgents"
        | "brandColor"
        | "logoAssetId"
      >
    >,
  ) => api.patch<Company>(`${WS}/${workspaceId}`, data),
  archive: (workspaceId: string) => api.post<Company>(`${WS}/${workspaceId}/archive`, {}),
  remove: (workspaceId: string) => api.delete<{ ok: true }>(`${WS}/${workspaceId}`),
  exportBundle: (workspaceId: string, data: { include?: { company?: boolean; agents?: boolean } }) =>
    api.post<CompanyPortabilityExportResult>(`${WS}/${workspaceId}/export`, data),
  importPreview: (data: CompanyPortabilityPreviewRequest) =>
    api.post<CompanyPortabilityPreviewResult>(`${WS}/import/preview`, data),
  importBundle: (data: CompanyPortabilityImportRequest) =>
    api.post<CompanyPortabilityImportResult>(`${WS}/import`, data),
};

