import { api } from "./client";

export type ImportResult = {
  imported: Array<{ id: string; title: string | null; filename: string }>;
  failed: Array<{ filename: string; error: string }>;
};

export const documentImportApi = {
  /**
   * Upload a .md file or .zip (Obsidian vault) for import into a company/project.
   *
   * @param companyId - Company scope
   * @param file - The file to import
   * @param projectId - Optional project scope
   */
  importFile: (companyId: string, file: File, projectId?: string): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append("file", file);
    if (projectId) {
      formData.append("projectId", projectId);
    }
    return api.postForm<ImportResult>(`/workspaces/${companyId}/import`, formData);
  },
};
