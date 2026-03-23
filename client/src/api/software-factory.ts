import { api } from "./client";

export type SoftwareFactorySearchHit = {
  kind: "requirement" | "blueprint" | "work_order" | "validation";
  id: string;
  projectId: string;
  title: string;
  excerpt: string;
};

export type SfRequirement = {
  id: string;
  companyId: string;
  projectId: string;
  title: string;
  bodyMd: string;
  structuredYaml: string | null;
  version: number;
  supersedesId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SfBlueprint = {
  id: string;
  companyId: string;
  projectId: string;
  title: string;
  bodyMd: string;
  diagramMermaid: string | null;
  linkedRequirementIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type SfWorkOrder = {
  id: string;
  companyId: string;
  projectId: string;
  title: string;
  descriptionMd: string;
  status: string;
  assigneeAgentId: string | null;
  assignedUserId: string | null;
  dependsOnWorkOrderIds: string[];
  linkedBlueprintId: string | null;
  linkedIssueId: string | null;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type SfValidationEvent = {
  id: string;
  companyId: string;
  projectId: string;
  source: string;
  rawPayload: Record<string, unknown>;
  summary: string | null;
  createdWorkOrderId: string | null;
  createdAt: string;
};

const base = (companyId: string) => `/companies/${companyId}/software-factory`;

export type DevFactoryPlaygroundResult = {
  id: string;
  urlKey: string;
  name: string;
  seededFactory: boolean;
};

export const softwareFactoryApi = {
  /** Dev / explicit allow on server: idempotent real project + seeded factory rows. */
  ensureDevPlayground(companyId: string) {
    return api.post<DevFactoryPlaygroundResult>(`${base(companyId)}/dev/ensure-playground-project`, {});
  },

  search(companyId: string, q: string, limit = 40) {
    const params = new URLSearchParams({ q, limit: String(limit) });
    return api.get<SoftwareFactorySearchHit[]>(`${base(companyId)}/search?${params.toString()}`);
  },

  listRequirements(companyId: string, projectId: string) {
    return api.get<SfRequirement[]>(`${base(companyId)}/projects/${projectId}/requirements`);
  },
  createRequirement(companyId: string, projectId: string, body: { title: string; bodyMd?: string; structuredYaml?: string | null }) {
    return api.post<SfRequirement>(`${base(companyId)}/projects/${projectId}/requirements`, body);
  },
  patchRequirement(companyId: string, id: string, body: Partial<{ title: string; bodyMd: string; structuredYaml: string | null }>) {
    return api.patch<SfRequirement>(`${base(companyId)}/requirements/${id}`, body);
  },
  deleteRequirement(companyId: string, id: string) {
    return api.delete<{ ok: true }>(`${base(companyId)}/requirements/${id}`);
  },

  listBlueprints(companyId: string, projectId: string) {
    return api.get<SfBlueprint[]>(`${base(companyId)}/projects/${projectId}/blueprints`);
  },
  createBlueprint(companyId: string, projectId: string, body: { title: string; bodyMd?: string; diagramMermaid?: string | null }) {
    return api.post<SfBlueprint>(`${base(companyId)}/projects/${projectId}/blueprints`, body);
  },
  patchBlueprint(companyId: string, id: string, body: Partial<{ title: string; bodyMd: string; diagramMermaid: string | null; linkedRequirementIds: string[] }>) {
    return api.patch<SfBlueprint>(`${base(companyId)}/blueprints/${id}`, body);
  },
  deleteBlueprint(companyId: string, id: string) {
    return api.delete<{ ok: true }>(`${base(companyId)}/blueprints/${id}`);
  },

  listWorkOrders(companyId: string, projectId: string) {
    return api.get<SfWorkOrder[]>(`${base(companyId)}/projects/${projectId}/work-orders`);
  },
  createWorkOrder(
    companyId: string,
    projectId: string,
    body: {
      title: string;
      descriptionMd?: string;
      status?: string;
      dependsOnWorkOrderIds?: string[];
      linkedBlueprintId?: string | null;
    },
  ) {
    return api.post<SfWorkOrder>(`${base(companyId)}/projects/${projectId}/work-orders`, body);
  },
  patchWorkOrder(
    companyId: string,
    id: string,
    body: Partial<{
      title: string;
      descriptionMd: string;
      status: string;
      dependsOnWorkOrderIds: string[];
      linkedBlueprintId: string | null;
      linkedIssueId: string | null;
      plannedStartAt: string | null;
      plannedEndAt: string | null;
      sortOrder: number;
    }>,
  ) {
    return api.patch<SfWorkOrder>(`${base(companyId)}/work-orders/${id}`, body);
  },

  batchPatchWorkOrders(companyId: string, projectId: string, patches: Array<{ id: string } & Record<string, unknown>>) {
    return api.post<SfWorkOrder[]>(`${base(companyId)}/projects/${projectId}/work-orders/batch-patch`, { patches });
  },

  designAssistSuggestions(
    companyId: string,
    projectId: string,
    body: { validationEventId?: string; fromOpenRequirements?: boolean },
  ) {
    return api.post<{ suggestions: { title: string; descriptionMd: string }[] }>(
      `${base(companyId)}/projects/${projectId}/design-assist/suggestions`,
      body,
    );
  },
  deleteWorkOrder(companyId: string, id: string) {
    return api.delete<{ ok: true }>(`${base(companyId)}/work-orders/${id}`);
  },

  listValidationEvents(companyId: string, projectId: string) {
    return api.get<SfValidationEvent[]>(`${base(companyId)}/projects/${projectId}/validation-events`);
  },
  createValidationEvent(
    companyId: string,
    projectId: string,
    body: {
      source: string;
      rawPayload?: Record<string, unknown>;
      summary?: string | null;
      createWorkOrder?: boolean;
      workOrderTitle?: string;
    },
  ) {
    return api.post<SfValidationEvent>(`${base(companyId)}/projects/${projectId}/validation-events`, body);
  },
};
