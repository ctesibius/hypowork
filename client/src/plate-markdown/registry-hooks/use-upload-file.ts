import * as React from 'react';

import { toast } from 'sonner';
import { z } from 'zod';

export type UploadedFile<T = unknown> = {
  key: string;
  appUrl?: string;
  name: string;
  size: number;
  type: string;
  url: string;
} & T;

export interface UseUploadFileProps {
  headers?: Record<string, string>;
  onUploadBegin?: (args: { file: string }) => void;
  onUploadProgress?: (args: { progress: number }) => void;
  skipPolling?: boolean;
  onUploadComplete?: (file: UploadedFile) => void;
  onUploadError?: (error: unknown) => void;
}

export function useUploadFile({
  onUploadComplete,
  onUploadError,
}: UseUploadFileProps = {}) {
  const [uploadedFile, setUploadedFile] = React.useState<UploadedFile>();
  const [uploadingFile, setUploadingFile] = React.useState<File>();
  const [progress, setProgress] = React.useState<number>(0);
  const [isUploading, setIsUploading] = React.useState(false);

  async function uploadThing(file: File) {
    setIsUploading(true);
    setUploadingFile(file);

    try {
      throw new Error('UploadThing is not configured');
    } catch (error) {
      onUploadError?.(error);

      const mockUploadedFile = {
        key: 'mock-key-0',
        appUrl: `https://mock-app-url.com/${file.name}`,
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
      } as UploadedFile;

      let p = 0;

      const simulateProgress = async () => {
        while (p < 100) {
          await new Promise((resolve) => setTimeout(resolve, 50));
          p += 2;
          setProgress(Math.min(p, 100));
        }
      };

      await simulateProgress();

      setUploadedFile(mockUploadedFile);
      onUploadComplete?.(mockUploadedFile);

      return mockUploadedFile;
    } finally {
      setProgress(0);
      setIsUploading(false);
      setUploadingFile(undefined);
    }
  }

  return {
    isUploading,
    progress,
    uploadedFile,
    uploadFile: uploadThing,
    uploadingFile,
  };
}

export function getErrorMessage(err: unknown) {
  const unknownError = 'Something went wrong, please try again later.';

  if (err instanceof z.ZodError) {
    const errors = err.issues.map((issue) => issue.message);

    return errors.join('\n');
  }
  if (err instanceof Error) {
    return err.message;
  }
  return unknownError;
}

export function showErrorToast(err: unknown) {
  const errorMessage = getErrorMessage(err);

  return toast.error(errorMessage);
}
