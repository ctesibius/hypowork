/** Hash for Plate bootstrap / reloadNonce on canvas cards (stable remount when markdown changes). */
export function hashMarkdownBootstrapKey(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}
