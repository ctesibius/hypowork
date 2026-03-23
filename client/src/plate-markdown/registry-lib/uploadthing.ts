/**
 * UploadThing is not used in this Vite client; the file router type is kept so
 * `useUploadFile` can stay API-compatible if UploadThing is added later.
 */
export type OurFileRouter = {
  editorUploader: {
    input: undefined;
    output: { key: string; name: string; size: number; type: string; url: string };
  };
};
