/** Build a `FileList` from `File[]` for APIs that require `FileList` (e.g. Plate media insert). */
export function filesToFileList(files: File[]): FileList {
  const dt = new DataTransfer();
  for (const f of files) {
    dt.items.add(f);
  }
  return dt.files;
}
