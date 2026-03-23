export type SoftwareFactorySearchHit = {
  kind: "requirement" | "blueprint" | "work_order" | "validation";
  id: string;
  projectId: string;
  title: string;
  excerpt: string;
};

export type CreateRequirementDto = {
  title: string;
  bodyMd?: string;
  structuredYaml?: string | null;
  version?: number;
  supersedesId?: string | null;
};

export type PatchRequirementDto = Partial<CreateRequirementDto>;

export type CreateBlueprintDto = {
  title: string;
  bodyMd?: string;
  diagramMermaid?: string | null;
  linkedRequirementIds?: string[];
};

export type PatchBlueprintDto = Partial<CreateBlueprintDto>;

export type CreateWorkOrderDto = {
  title: string;
  descriptionMd?: string;
  status?: string;
  assigneeAgentId?: string | null;
  assignedUserId?: string | null;
  dependsOnWorkOrderIds?: string[];
  linkedBlueprintId?: string | null;
  /** Board issue in the same project (optional bridge). */
  linkedIssueId?: string | null;
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
  sortOrder?: number;
};

export type PatchWorkOrderDto = Partial<CreateWorkOrderDto>;

export type BatchPatchWorkOrdersDto = {
  patches: Array<{ id: string } & PatchWorkOrderDto>;
};

export type DesignAssistSuggestionsDto = {
  validationEventId?: string;
  /** Heuristic: one draft WO per requirement with short body (Design Engineer stub). */
  fromOpenRequirements?: boolean;
};

export type DesignAssistSuggestion = {
  title: string;
  descriptionMd: string;
};

export type CreateValidationEventDto = {
  source: string;
  rawPayload?: Record<string, unknown>;
  summary?: string | null;
  createWorkOrder?: boolean;
  workOrderTitle?: string;
};
