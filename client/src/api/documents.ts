import type {
  AttachCompanyDocumentToIssue,
  CreateCompanyDocument,
  UpdateCompanyDocument,
} from "@paperclipai/shared";
import { api } from "./client";

/** Standalone company note (not yet linked to an issue). */
export type DocumentLinkDirection = "out" | "in" | "both";

export type DocumentLinksResponse = {
  out: Array<{
    targetDocumentId: string | null;
    rawReference: string;
    linkKind: string;
  }>;
  in: Array<{
    sourceDocumentId: string;
    rawReference: string;
    linkKind: string;
  }>;
};

export type DocumentNeighborhoodResponse = {
  documentIds: string[];
};

export type CompanyDocumentGraphNode = {
  id: string;
  title: string;
  /** @deprecated Same as `collectionPath`. */
  folderPath?: string | null;
  /** Virtual collection (vault / import path); null = root. */
  collectionPath?: string | null;
  kind: "prose" | "canvas";
};

export type CompanyDocumentGraphLink = {
  source: string;
  target: string;
  rawReference: string;
  linkKind: string;
};

export type CompanyDocumentGraphResponse = {
  nodes: CompanyDocumentGraphNode[];
  links: CompanyDocumentGraphLink[];
};

export type DocumentContextPackItem = {
  documentId: string;
  title: string | null;
  format: string;
  body: string;
  bodyTruncated: boolean;
  role: "center" | "outgoing_link" | "incoming_link";
};

export type DocumentContextPackResponse = {
  companyId: string;
  centerDocumentId: string;
  generatedAt: string;
  items: DocumentContextPackItem[];
};

export type CompanyDocument = {
  id: string;
  companyId: string;
  /** Board project scope for standalone notes; null = company-wide. */
  projectId?: string | null;
  /** @deprecated Same as `collectionPath`. */
  folderPath?: string | null;
  /** Obsidian-style collection path (ZIP / vault folders); null/omit = root. */
  collectionPath?: string | null;
  title: string | null;
  /** Prose (markdown) vs spatial canvas (JSON graph in `body`). Omitted from older APIs → treat as prose. */
  kind?: "prose" | "canvas";
  format: string;
  /** Canonical prose / markdown (`latest_body`). */
  body: string;
  /** React Flow graph JSON (`canvas_graph_json`); primary docPage must not duplicate `body`. */
  canvasGraph?: string | null;
  latestRevisionId: string | null;
  latestRevisionNumber: number;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  updatedByAgentId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Effective collection placement. Server returns both `collectionPath` and legacy `folderPath`
 * with the same value; clients should prefer this helper when reading.
 */
export function documentCollectionPath(
  d: Pick<CompanyDocument, "collectionPath" | "folderPath">,
): string | null {
  const p = d.collectionPath ?? d.folderPath;
  if (p == null || !String(p).trim()) return null;
  return String(p).trim();
}

export const documentsApi = {
  list: (companyId: string, opts?: { projectId?: string }) => {
    const q =
      opts?.projectId != null && opts.projectId.length > 0
        ? `?projectId=${encodeURIComponent(opts.projectId)}`
        : "";
    return api.get<CompanyDocument[]>(`/workspaces/${companyId}/documents${q}`);
  },

  graph: (companyId: string) =>
    api.get<CompanyDocumentGraphResponse>(`/workspaces/${companyId}/documents/graph`),

  get: (companyId: string, documentId: string) =>
    api.get<CompanyDocument>(`/workspaces/${companyId}/documents/${documentId}`),

  links: (companyId: string, documentId: string, direction: DocumentLinkDirection = "both") =>
    api.get<DocumentLinksResponse>(
      `/workspaces/${companyId}/documents/${documentId}/links?direction=${encodeURIComponent(direction)}`,
    ),

  neighborhood: (companyId: string, documentId: string, maxIds?: number) =>
    api.get<DocumentNeighborhoodResponse>(
      `/workspaces/${companyId}/documents/${documentId}/neighborhood${
        maxIds !== undefined ? `?max=${encodeURIComponent(String(maxIds))}` : ""
      }`,
    ),

  contextPack: (
    companyId: string,
    documentId: string,
    opts?: { maxDocuments?: number; maxBodyCharsPerDocument?: number },
  ) => {
    const q = new URLSearchParams();
    if (opts?.maxDocuments !== undefined) {
      q.set("maxDocuments", String(opts.maxDocuments));
    }
    if (opts?.maxBodyCharsPerDocument !== undefined) {
      q.set("maxBodyCharsPerDocument", String(opts.maxBodyCharsPerDocument));
    }
    const qs = q.toString();
    return api.get<DocumentContextPackResponse>(
      `/workspaces/${companyId}/documents/${documentId}/context-pack${qs ? `?${qs}` : ""}`,
    );
  },

  create: (companyId: string, data: CreateCompanyDocument) =>
    api.post<CompanyDocument>(`/workspaces/${companyId}/documents`, data),

  update: (companyId: string, documentId: string, data: UpdateCompanyDocument) =>
    api.patch<CompanyDocument>(`/workspaces/${companyId}/documents/${documentId}`, data),

  remove: (companyId: string, documentId: string) =>
    api.delete<{ ok: boolean }>(`/workspaces/${companyId}/documents/${documentId}`),

  revisions: (companyId: string, documentId: string) =>
    api.get<
      Array<{
        id: string;
        revisionNumber: number;
        body: string;
        canvasGraph: string | null;
        changeSummary: string | null;
        createdAt: string;
      }>
    >(`/workspaces/${companyId}/documents/${documentId}/revisions`),

  linkIssue: (companyId: string, documentId: string, data: AttachCompanyDocumentToIssue) =>
    api.post<{ ok: true; issueId: string; key: string }>(
      `/workspaces/${companyId}/documents/${documentId}/link-issue`,
      data,
    ),

  getCanvasViewport: (companyId: string, documentId: string) =>
    api.get<{
      documentId: string;
      companyId: string;
      panX: number;
      panY: number;
      zoom: number;
      userId: string | null;
      updatedAt: string;
    }>(`/workspaces/${companyId}/documents/${documentId}/canvas-viewport`),

  patchCanvasViewport: (companyId: string, documentId: string, body: { panX: number; panY: number; zoom: number }) =>
    api.patch<{ ok: boolean }>(
      `/workspaces/${companyId}/documents/${documentId}/canvas-viewport`,
      body,
    ),
};
