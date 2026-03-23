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
  private readonly basePath = "/notes-viewer";

  async search(companyId: string, request: SearchRequest): Promise<SearchResponse> {
    return api.post<SearchResponse>(`${this.basePath}/companies/${companyId}/search`, request);
  }

  async getAllNotes(companyId: string): Promise<NoteEntry[]> {
    return api.get<NoteEntry[]>(`${this.basePath}/companies/${companyId}/notes`);
  }

  async getProjectMilestones(companyId: string): Promise<ProjectMilestone[]> {
    return api.get<ProjectMilestone[]>(`${this.basePath}/companies/${companyId}/milestones`);
  }

  async getExperimentHistory(companyId: string): Promise<ExperimentHistory[]> {
    return api.get<ExperimentHistory[]>(`${this.basePath}/companies/${companyId}/experiments`);
  }
}

export const notesViewerApi = new NotesViewerApi();
