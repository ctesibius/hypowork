/**
 * Notes Viewer Types - Phase 1.5
 *
 * Provides unified search across Mem0 + Vault + Documents:
 * - Live search with facets
 * - Linked views of notes/claims/docs
 * - Project milestones and experiment history
 */

export interface SearchRequest {
  query: string;
  sources?: SearchSource[];
  limit?: number;
  offset?: number;
}

export type SearchSource = "memory" | "vault" | "documents";

export interface SearchResult {
  id: string;
  source: SearchSource;
  type: string;
  title: string;
  excerpt: string;
  url: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  facets: {
    bySource: Record<SearchSource, number>;
    byType: Record<string, number>;
    byDomain: Record<string, number>;
  };
  query: string;
}

export interface NoteEntry {
  id: string;
  source: SearchSource;
  type: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  url: string;
}

export interface ProjectMilestone {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "blocked";
  dueDate?: string;
  linkedNotes: string[];
}

export interface ExperimentHistory {
  id: string;
  title: string;
  metric: number;
  status: "kept" | "discarded" | "running";
  createdAt: string;
  notes?: string;
}
