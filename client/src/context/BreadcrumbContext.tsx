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

/** Set by `DocumentDetail` for `HeaderNavbar`: rev, autosave, toolbar actions (title lives on tabs). */
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
  /** When set, used for `document.title` if breadcrumbs are empty (e.g. document detail with tab strip). */
  documentTitleOverride: string | null;
  setDocumentTitleOverride: (title: string | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [breadcrumbs, setBreadcrumbsState] = useState<Breadcrumb[]>([]);
  const [documentDetailChrome, setDocumentDetailChromeState] = useState<DocumentDetailChrome | null>(null);
  const [documentTitleOverride, setDocumentTitleOverrideState] = useState<string | null>(null);

  const setBreadcrumbs = useCallback((crumbs: Breadcrumb[]) => {
    setBreadcrumbsState(crumbs);
  }, []);

  const setDocumentDetailChrome = useCallback((chrome: DocumentDetailChrome | null) => {
    setDocumentDetailChromeState(chrome);
  }, []);

  const setDocumentTitleOverride = useCallback((title: string | null) => {
    setDocumentTitleOverrideState(title);
  }, []);

  useEffect(() => {
    if (documentTitleOverride) {
      document.title = `${documentTitleOverride} · Hypowork`;
      return;
    }
    if (breadcrumbs.length === 0) {
      document.title = "Hypowork";
    } else {
      const parts = [...breadcrumbs].reverse().map((b) => {
        if (b.kind === "document-title" && documentDetailChrome) {
          return documentDetailChrome.title.trim() || "Untitled";
        }
        return b.label;
      });
      document.title = `${parts.join(" · ")} · Hypowork`;
    }
  }, [breadcrumbs, documentDetailChrome, documentTitleOverride]);

  return (
    <BreadcrumbContext.Provider
      value={{
        breadcrumbs,
        setBreadcrumbs,
        documentDetailChrome,
        setDocumentDetailChrome,
        documentTitleOverride,
        setDocumentTitleOverride,
      }}
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
