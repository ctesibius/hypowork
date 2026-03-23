/**
 * Memory Types for hypowork
 *
 * Interfaces for the in-app memory engine (Mem0-style).
 * Provides runtime memory for agents and persistent company memory.
 */

export interface MemorySearchResult {
  id: string;
  memory: string;
  score?: number;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface MemoryAddResult {
  id: string;
  memory: string;
  event: "ADD" | "UPDATE" | "DELETE";
}

export interface MemorySearchResponse {
  results: MemorySearchResult[];
  relations?: Array<{
    source: string;
    target: string;
    relation: string;
  }>;
}

export interface MemoryAddResponse {
  results: MemoryAddResult[];
  relations?: Array<{
    source: string;
    target: string;
    relation: string;
  }>;
}

export interface MemoryContext {
  userId?: string;
  agentId?: string;
  runId?: string;
  companyId: string;
}

export interface CompanyMemoryEntry {
  id: string;
  companyId: string;
  agentId?: string;
  userId?: string;
  content: string;
  category?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SearchMemoriesDto {
  query: string;
  limit?: number;
  threshold?: number;
}

export interface AddMemoryDto {
  content: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateMemoryDto {
  content: string;
}
