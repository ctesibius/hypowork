import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface Breadcrumb {
  label: string;
  href?: string;
  /** Last segment: title is edited in the bar via {@link DocumentDetailChrome}. */
  kind?: "document-title";
}

/** Set by `DocumentDetail` so `BreadcrumbBar` can inline-edit the title, rev, autosave, and actions. */
export type DocumentDetailChrome = {
  revisionNumber: number;
  title: string;
  onTitleChange: (value: string) => void;
  /** e.g. Saving… / Saved / Save failed */
  autosaveLabel?: string;
  /** Copy, link, overflow — rendered after `rev` */
  toolbarActions?: ReactNode;
};

interface BreadcrumbContextValue {
  breadcrumbs: Breadcrumb[];
  setBreadcrumbs: (crumbs: Breadcrumb[]) => void;
  documentDetailChrome: DocumentDetailChrome | null;
  setDocumentDetailChrome: (chrome: DocumentDetailChrome | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [breadcrumbs, setBreadcrumbsState] = useState<Breadcrumb[]>([]);
  const [documentDetailChrome, setDocumentDetailChromeState] = useState<DocumentDetailChrome | null>(null);

  const setBreadcrumbs = useCallback((crumbs: Breadcrumb[]) => {
    setBreadcrumbsState(crumbs);
  }, []);

  const setDocumentDetailChrome = useCallback((chrome: DocumentDetailChrome | null) => {
    setDocumentDetailChromeState(chrome);
  }, []);

  useEffect(() => {
    if (breadcrumbs.length === 0) {
      document.title = "Paperclip";
    } else {
      const parts = [...breadcrumbs].reverse().map((b) => {
        if (b.kind === "document-title" && documentDetailChrome) {
          return documentDetailChrome.title.trim() || "Untitled";
        }
        return b.label;
      });
      document.title = `${parts.join(" · ")} · Paperclip`;
    }
  }, [breadcrumbs, documentDetailChrome]);

  return (
    <BreadcrumbContext.Provider
      value={{ breadcrumbs, setBreadcrumbs, documentDetailChrome, setDocumentDetailChrome }}
    >
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbs() {
  const ctx = useContext(BreadcrumbContext);
  if (!ctx) {
    throw new Error("useBreadcrumbs must be used within BreadcrumbProvider");
  }
  return ctx;
}
