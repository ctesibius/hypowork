import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { createIssueDetailLocationState } from "../lib/issueDetailBreadcrumb";
import { documentsApi, type CompanyDocument } from "../api/documents";
import { issuesApi } from "../api/issues";
import { EmptyState } from "../components/EmptyState";
import { DocumentsList } from "../components/DocumentsList";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "../api/client";

export function Documents() {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [linkDoc, setLinkDoc] = useState<CompanyDocument | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("# New note\n\n");

  const [linkIssueId, setLinkIssueId] = useState("");
  const [linkKey, setLinkKey] = useState("note");

  const documentLinkState = useMemo(
    () =>
      createIssueDetailLocationState(
        "Documents",
        `${location.pathname}${location.search}${location.hash}`,
      ),
    [location.pathname, location.search, location.hash],
  );

  useEffect(() => {
    setBreadcrumbs([{ label: "Documents" }]);
  }, [setBreadcrumbs]);

  const { data: docs, isLoading, error } = useQuery({
    queryKey: queryKeys.companyDocuments.list(selectedCompanyId!),
    queryFn: () => documentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && !!linkDoc,
  });

  const createMut = useMutation({
    mutationFn: () =>
      documentsApi.create(selectedCompanyId!, {
        title: newTitle.trim() || null,
        format: "markdown",
        body: newBody,
      }),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.companyDocuments.list(selectedCompanyId!) });
      setCreateOpen(false);
      setNewTitle("");
      setNewBody("# New note\n\n");
      navigate(`/documents/${created.id}`, { state: documentLinkState });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => documentsApi.remove(selectedCompanyId!, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.companyDocuments.list(selectedCompanyId!) });
    },
  });

  const linkMut = useMutation({
    mutationFn: () => {
      if (!linkDoc || !selectedCompanyId) throw new Error("Missing");
      return documentsApi.linkIssue(selectedCompanyId, linkDoc.id, {
        issueId: linkIssueId.trim(),
        key: linkKey.trim().toLowerCase(),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.companyDocuments.list(selectedCompanyId!) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) });
      setLinkDoc(null);
      setLinkIssueId("");
      setLinkKey("note");
    },
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={FileText} message="Select a company to view documents." />;
  }

  return (
    <>
      <DocumentsList
        documents={docs ?? []}
        isLoading={isLoading}
        error={error as Error | null}
        documentLinkState={documentLinkState}
        onNewDocument={() => setCreateOpen(true)}
        onLinkDocument={setLinkDoc}
        onDeleteDocument={(id) => void deleteMut.mutateAsync(id)}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New document</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="new-title">Title</Label>
              <Input
                id="new-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Optional title"
              />
            </div>
            <div>
              <Label htmlFor="new-body">Body (Markdown)</Label>
              <Textarea
                id="new-body"
                className="min-h-[200px] font-mono text-sm"
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
              />
            </div>
            {createMut.isError && (
              <p className="text-sm text-destructive">
                {createMut.error instanceof ApiError ? createMut.error.message : String(createMut.error)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void createMut.mutate()} disabled={createMut.isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!linkDoc} onOpenChange={(o) => !o && setLinkDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link to issue</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Attaches this note to an issue with a document key (e.g. <code className="text-xs">plan</code>,{" "}
            <code className="text-xs">note</code>). The document will appear under the issue&apos;s documents API.
          </p>
          <div className="space-y-3">
            <div>
              <Label htmlFor="link-issue">Issue</Label>
              <select
                id="link-issue"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={linkIssueId}
                onChange={(e) => setLinkIssueId(e.target.value)}
              >
                <option value="">Select issue…</option>
                {(issues ?? []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.identifier} — {i.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="link-key">Document key</Label>
              <Input
                id="link-key"
                value={linkKey}
                onChange={(e) => setLinkKey(e.target.value)}
                placeholder="note"
              />
            </div>
            {linkMut.isError && (
              <p className="text-sm text-destructive">
                {linkMut.error instanceof ApiError ? linkMut.error.message : String(linkMut.error)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDoc(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void linkMut.mutate()}
              disabled={linkMut.isPending || !linkIssueId.trim() || !linkKey.trim()}
            >
              Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
