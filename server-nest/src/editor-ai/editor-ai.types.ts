export interface CopilotCompleteDto {
  prompt: string;
  documentId?: string;
  system?: string;
}

export interface CopilotCompleteResponse {
  text: string;
}
