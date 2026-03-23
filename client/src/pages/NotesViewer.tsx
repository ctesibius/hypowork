/**
 * Notes Viewer Page - Phase 1.5: Unified search across Mem0 + Vault + Documents
 */

import { useEffect, useState } from "react";
import { useNavigate } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { notesViewerApi, type SearchResult } from "../api/notes-viewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";
import { Search, FileText, Brain, Database, Clock, TrendingUp } from "lucide-react";

export function NotesViewer() {
  const navigate = useNavigate();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: "Notes" }]);
  }, [setBreadcrumbs]);

  // All notes query
  const { data: allNotes = [], isLoading: notesLoading } = useQuery({
    queryKey: ["notes-viewer", "all", selectedCompanyId],
    queryFn: () => notesViewerApi.getAllNotes(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  // Milestones query
  const { data: milestones = [] } = useQuery({
    queryKey: ["notes-viewer", "milestones", selectedCompanyId],
    queryFn: () => notesViewerApi.getProjectMilestones(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  // Experiments query
  const { data: experiments = [] } = useQuery({
    queryKey: ["notes-viewer", "experiments", selectedCompanyId],
    queryFn: () => notesViewerApi.getExperimentHistory(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const handleSearch = async () => {
    if (!searchQuery.trim() || !selectedCompanyId) return;

    setHasSearched(true);
    try {
      const response = await notesViewerApi.search(selectedCompanyId, {
        query: searchQuery,
        sources: ["memory", "vault", "documents"],
        limit: 20,
      });
      setSearchResults(response.results);
    } catch (err) {
      console.error("Search failed:", err);
      setSearchResults([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      void handleSearch();
    }
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.type === "document" && result.url) {
      navigate(result.url);
    }
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case "memory":
        return <Brain className="h-4 w-4 text-purple-500" />;
      case "vault":
        return <Database className="h-4 w-4 text-blue-500" />;
      case "document":
        return <FileText className="h-4 w-4 text-green-500" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  if (!selectedCompanyId) {
    return <EmptyState icon={Search} message="Select a company to view notes." />;
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Notes & Knowledge</h1>
        <p className="text-sm text-muted-foreground">
          Search across memories, vault, and documents
        </p>
      </div>

      {/* Search Bar */}
      <div className="flex gap-2 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search memories, vault entries, documents..."
            className="pl-9"
          />
        </div>
        <Button onClick={() => void handleSearch()}>Search</Button>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Notes</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="experiments">Experiments</TabsTrigger>
        </TabsList>

        {/* Search Results */}
        {hasSearched && (
          <TabsContent value="all" className="mt-4">
            {searchResults.length > 0 ? (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground mb-2">
                  Found {searchResults.length} results
                </div>
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleResultClick(result)}
                    className="w-full text-left p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{getSourceIcon(result.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground uppercase">
                            {result.type}
                          </span>
                          {result.title && (
                            <span className="font-medium truncate">{result.title}</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {result.excerpt || result.content}
                        </p>
                        {result.score !== undefined && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Relevance: {(result.score * 100).toFixed(0)}%
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No results found for "{searchQuery}"
              </div>
            )}
          </TabsContent>
        )}

        {/* All Notes Tab */}
        {!hasSearched && (
          <TabsContent value="all" className="mt-4">
            {notesLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : allNotes.length > 0 ? (
              <div className="space-y-3">
                {allNotes.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => {
                      if (note.type === "document") {
                        navigate(`/documents/${note.id}`);
                      }
                    }}
                    className="w-full text-left p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{getSourceIcon(note.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground uppercase">
                            {note.type}
                          </span>
                          {note.title && (
                            <span className="font-medium truncate">{note.title}</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {note.content}
                        </p>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(note.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No notes yet. Notes from memories, vault, and documents will appear here.
              </div>
            )}
          </TabsContent>
        )}

        {/* Milestones Tab */}
        <TabsContent value="milestones" className="mt-4">
          {milestones.length > 0 ? (
            <div className="space-y-3">
              {milestones.map((milestone) => (
                <div
                  key={milestone.id}
                  className="p-4 rounded-lg border border-border"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{milestone.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {milestone.projectName}
                      </div>
                    </div>
                    <div
                      className={`text-xs px-2 py-1 rounded ${
                        milestone.completedAt
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {milestone.completedAt ? "Completed" : "In Progress"}
                    </div>
                  </div>
                  {milestone.description && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {milestone.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No milestones yet
            </div>
          )}
        </TabsContent>

        {/* Experiments Tab */}
        <TabsContent value="experiments" className="mt-4">
          {experiments.length > 0 ? (
            <div className="space-y-3">
              {experiments.map((exp) => (
                <div
                  key={exp.id}
                  className="p-4 rounded-lg border border-border"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{exp.name}</span>
                    </div>
                    <div
                      className={`text-xs px-2 py-1 rounded ${
                        exp.kept ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {exp.kept ? "Kept" : "Discarded"}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Status: {exp.status}</span>
                    {exp.metricValue !== undefined && (
                      <span>Metric: {exp.metricValue.toFixed(4)}</span>
                    )}
                    <span>{new Date(exp.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No experiments yet
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
