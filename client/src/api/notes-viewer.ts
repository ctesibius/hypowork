/**
 * Notes Viewer API client - Phase 1.5: Unified search across Mem0 + Vault + Documents
 */

import { api } from "./client";

export interface SearchRequest {
  query: string;
  sources?: ("memory" | "vault" | "documents")[];
  limit?: number;
}

export interface SearchResult {
  id: string;
  type: "memory" | "vault" | "document";
  title?: string;
  content: string;
  excerpt?: string;
  score?: number;
  url?: string;
  createdAt?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  facets: {
    sources: Record<string, number>;
    types: Record<string, number>;
  };
  query: string;
  totalResults: number;
}

export interface NoteEntry {
  id: string;
  type: "memory" | "vault" | "document";
  title?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMilestone {
  id: string;
  title: string;
  description?: string;
  status: string;
  dueDate?: string;
  completedAt?: string;
  projectName: string;
}

export interface ExperimentHistory {
  id: string;
  name: string;
  status: string;
  metricValue?: number;
  createdAt: string;
  kept: boolean;
}

class NotesViewerApi {
  async search(companyId: string, request: SearchRequest): Promise<SearchResponse> {
    const params = new URLSearchParams();
    params.set("query", request.query);
    if (request.sources?.length) params.set("sources", request.sources.join(","));
    if (request.limit != null) params.set("limit", String(request.limit));
    const qs = params.toString();
    return api.get<SearchResponse>(`/workspaces/${companyId}/notes/search${qs ? `?${qs}` : ""}`);
  }

  async getAllNotes(companyId: string): Promise<NoteEntry[]> {
    return api.get<NoteEntry[]>(`/workspaces/${companyId}/notes`);
  }

  async getProjectMilestones(companyId: string): Promise<ProjectMilestone[]> {
    return api.get<ProjectMilestone[]>(`/workspaces/${companyId}/notes/milestones`);
  }

  async getExperimentHistory(companyId: string): Promise<ExperimentHistory[]> {
    return api.get<ExperimentHistory[]>(`/workspaces/${companyId}/notes/experiments`);
  }
}

export const notesViewerApi = new NotesViewerApi();
