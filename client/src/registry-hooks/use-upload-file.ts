import * as React from 'react';

/** Local dev upload: object URLs only (no Uploadthing). */
export type UploadedFile = {
  url: string;
  name?: string;
  size?: number;
  type?: string;
};

export function useUploadFile() {
  const [uploadedFile, setUploadedFile] = React.useState<UploadedFile>();
  const [uploadingFile, setUploadingFile] = React.useState<File>();
  const [progress, setProgress] = React.useState(0);
  const [isUploading, setIsUploading] = React.useState(false);

  async function uploadFile(file: File): Promise<UploadedFile> {
    setIsUploading(true);
    setUploadingFile(file);
    setProgress(0);
    try {
      await new Promise((r) => setTimeout(r, 30));
      setProgress(100);
      const u: UploadedFile = {
        url: URL.createObjectURL(file),
        name: file.name,
        size: file.size,
        type: file.type,
      };
      setUploadedFile(u);
      return u;
    } finally {
      setIsUploading(false);
      setUploadingFile(undefined);
      setProgress(0);
    }
  }

  return {
    isUploading,
    progress,
    uploadedFile,
    uploadFile,
    uploadingFile,
  };
}
