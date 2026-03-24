import { api } from "./client";

export type PlcStageNode = {
  id: string;
  label: string;
  kind: "gate" | "phase" | "checkpoint";
  description?: string;
};

export type PlcStageEdge = {
  from: string;
  to: string;
};

export type PlcStagesGraph = {
  nodes: PlcStageNode[];
  edges: PlcStageEdge[];
};

export type PlcTemplate = {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  stages: PlcStagesGraph;
  createdAt: string;
  updatedAt: string;
};

const base = (companyId: string) => `/companies/${companyId}/plc-templates`;

export const plcApi = {
  list(companyId: string) {
    return api.get<PlcTemplate[]>(`${base(companyId)}`);
  },
  get(companyId: string, id: string) {
    return api.get<PlcTemplate>(`${base(companyId)}/${id}`);
  },
  create(companyId: string, body: { name: string; description?: string | null; stages?: PlcStagesGraph }) {
    return api.post<PlcTemplate>(`${base(companyId)}`, body);
  },
  patch(companyId: string, id: string, body: Partial<{ name: string; description: string | null; stages: PlcStagesGraph }>) {
    return api.patch<PlcTemplate>(`${base(companyId)}/${id}`, body);
  },
  delete(companyId: string, id: string) {
    return api.delete<{ ok: true }>(`${base(companyId)}/${id}`);
  },
};
