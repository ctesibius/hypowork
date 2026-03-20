import type {
  AttachCompanyDocumentToIssue,
  CreateCompanyDocument,
  UpdateCompanyDocument,
} from "@paperclipai/shared";
import { api } from "./client";

/** Standalone company note (not yet linked to an issue). */
export type CompanyDocument = {
  id: string;
  companyId: string;
  title: string | null;
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

  get: (companyId: string, documentId: string) =>
    api.get<CompanyDocument>(`/companies/${companyId}/documents/${documentId}`),

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
