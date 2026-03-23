export interface Entity {
  userId?: string;
  agentId?: string;
  runId?: string;
}

export interface AddMemoryOptions extends Entity {
  metadata?: Record<string, any>;
  filters?: Record<string, any>;
  infer?: boolean;
}

export interface SearchMemoryOptions extends Entity {
  limit?: number;
  filters?: Record<string, any>;
}

export interface GetAllMemoryOptions extends Entity {
  limit?: number;
}

export interface DeleteAllMemoryOptions extends Entity {}
