export interface CopilotCompleteDto {
  prompt: string;
  documentId?: string;
  system?: string;
}

export interface CopilotCompleteResponse {
  text: string;
  /** When `hypowork-default` exists in `prompt_versions`, for dual-loop attribution / future ratings. */
  promptVersionId?: string;
}
