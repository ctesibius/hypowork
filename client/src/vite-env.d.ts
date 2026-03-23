/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dev-only: auto `POST …/software-factory/dev/ensure-playground-project` when sidebar loads (project appears under Projects). */
  readonly VITE_FACTORY_UI_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
