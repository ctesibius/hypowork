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
  title: string | null;
  /** Prose (markdown) vs spatial canvas (JSON graph in `body`). Omitted from older APIs → treat as prose. */
  kind?: "prose" | "canvas";
  format: string;
  body: string;
  latestRevisionId: string | null;
  latestRevisionNumber: number;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  updatedByAgentId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export const documentsApi = {
  list: (companyId: string) => api.get<CompanyDocument[]>(`/companies/${companyId}/documents`),

  graph: (companyId: string) =>
    api.get<CompanyDocumentGraphResponse>(`/companies/${companyId}/documents/graph`),

  get: (companyId: string, documentId: string) =>
    api.get<CompanyDocument>(`/companies/${companyId}/documents/${documentId}`),

  links: (companyId: string, documentId: string, direction: DocumentLinkDirection = "both") =>
    api.get<DocumentLinksResponse>(
      `/companies/${companyId}/documents/${documentId}/links?direction=${encodeURIComponent(direction)}`,
    ),

  neighborhood: (companyId: string, documentId: string, maxIds?: number) =>
    api.get<DocumentNeighborhoodResponse>(
      `/companies/${companyId}/documents/${documentId}/neighborhood${
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
      `/companies/${companyId}/documents/${documentId}/context-pack${qs ? `?${qs}` : ""}`,
    );
  },

  create: (companyId: string, data: CreateCompanyDocument) =>
    api.post<CompanyDocument>(`/companies/${companyId}/documents`, data),

  update: (companyId: string, documentId: string, data: UpdateCompanyDocument) =>
    api.patch<CompanyDocument>(`/companies/${companyId}/documents/${documentId}`, data),

  remove: (companyId: string, documentId: string) =>
    api.delete<{ ok: boolean }>(`/companies/${companyId}/documents/${documentId}`),

  revisions: (companyId: string, documentId: string) =>
    api.get<
      Array<{
        id: string;
        revisionNumber: number;
        body: string;
        changeSummary: string | null;
        createdAt: string;
      }>
    >(`/companies/${companyId}/documents/${documentId}/revisions`),

  linkIssue: (companyId: string, documentId: string, data: AttachCompanyDocumentToIssue) =>
    api.post<{ ok: true; issueId: string; key: string }>(
      `/companies/${companyId}/documents/${documentId}/link-issue`,
      data,
    ),
};
