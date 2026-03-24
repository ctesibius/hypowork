import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useParams } from "@/lib/router";

export type OpenDocumentTab = {
  documentId: string;
  title: string;
  kind: "prose" | "canvas";
};

interface OpenDocumentTabsContextValue {
  tabs: OpenDocumentTab[];
  ensureTab: (documentId: string, title: string, kind: "prose" | "canvas") => void;
  closeTab: (documentId: string) => void;
  activateTab: (documentId: string) => void;
}

const OpenDocumentTabsContext = createContext<OpenDocumentTabsContextValue | null>(null);

export function OpenDocumentTabsProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<OpenDocumentTab[]>([]);
  const navigate = useNavigate();
  const { companyPrefix, documentId: routeDocumentId } = useParams<{
    companyPrefix?: string;
    documentId?: string;
  }>();

  useEffect(() => {
    setTabs([]);
  }, [companyPrefix]);

  const ensureTab = useCallback((documentId: string, title: string, kind: "prose" | "canvas") => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.documentId === documentId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { documentId, title, kind };
        return next;
      }
      return [...prev, { documentId, title, kind }];
    });
  }, []);

  const activateTab = useCallback(
    (documentId: string) => {
      if (!companyPrefix) return;
      navigate(`/${companyPrefix}/documents/${documentId}`);
    },
    [companyPrefix, navigate],
  );

  const closeTab = useCallback(
    (documentId: string) => {
      if (!companyPrefix) return;
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.documentId === documentId);
        if (idx < 0) return prev;
        const wasActive = routeDocumentId === documentId;
        const replacement = prev[idx + 1] ?? prev[idx - 1] ?? null;
        const next = prev.filter((t) => t.documentId !== documentId);
        if (wasActive) {
          queueMicrotask(() => {
            if (replacement) {
              navigate(`/${companyPrefix}/documents/${replacement.documentId}`);
            } else {
              navigate(`/${companyPrefix}/documents`);
            }
          });
        }
        return next;
      });
    },
    [companyPrefix, navigate, routeDocumentId],
  );

  return (
    <OpenDocumentTabsContext.Provider value={{ tabs, ensureTab, closeTab, activateTab }}>
      {children}
    </OpenDocumentTabsContext.Provider>
  );
}

export function useOpenDocumentTabs() {
  const ctx = useContext(OpenDocumentTabsContext);
  if (!ctx) {
    throw new Error("useOpenDocumentTabs must be used within OpenDocumentTabsProvider");
  }
  return ctx;
}
