/**
 * Dev-only entry point for the **Factory playground**: a real `projects` row + DB-backed
 * software-factory rows (see Nest `POST …/software-factory/dev/ensure-playground-project`).
 * When `VITE_FACTORY_UI_MOCK` is set, the app auto-calls ensure-playground on load (sidebar loads Projects list);
 * same env name as before; there is no in-memory mock UI anymore.
 */
export function isFactoryUiMockEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  const v = import.meta.env.VITE_FACTORY_UI_MOCK;
  return v === "1" || v === "true" || v === "yes";
}
