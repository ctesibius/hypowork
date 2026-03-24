/** PLC stage node — part of a plc_templates.stages JSONB graph. */
export type PlcStageNode = {
  id: string;
  label: string;
  /** "gate" = review/decision milestone; "phase" = development phase; "checkpoint" = lightweight marker */
  kind: "gate" | "phase" | "checkpoint";
  description?: string;
};

/** PLC stage edge — part of a plc_templates.stages JSONB graph. */
export type PlcStageEdge = {
  from: string;
  to: string;
};

/** Full stages graph stored in plc_templates.stages. */
export type PlcStagesGraph = {
  nodes: PlcStageNode[];
  edges: PlcStageEdge[];
};

export type CreatePlcTemplateDto = {
  name: string;
  description?: string;
  stages?: PlcStagesGraph;
};

export type PatchPlcTemplateDto = Partial<Omit<CreatePlcTemplateDto, "id">>;
