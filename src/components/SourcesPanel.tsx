'use client';

import { Plus, Search, FileText, Link, Star, FileSpreadsheet } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import AddSourcesModal from "@/components/AddSourcesModal";
import type { StoreType } from "@/components/AddSourcesModal";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import {
  fetchSources,
  updateSources,
  addReviewsSource,
  addDocumentSources,
  type Source,
} from "@/lib/api";

const SourcesPanel = ({ mobile }: { mobile?: boolean }) => {
  const { isAuthenticated } = useAuth();
  const { currentProjectId } = useProject();
  const [sources, setSources] = useState<Source[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSources = useCallback(async () => {
    if (!isAuthenticated || !currentProjectId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await fetchSources(currentProjectId);
      setSources(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sources");
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, currentProjectId]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const toggleSource = async (id: string) => {
    const next = sources.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s));
    setSources(next);
    try {
      const saved = await updateSources(next);
      setSources(saved);
    } catch {
      setSources(sources);
    }
  };

  const allSelected = sources.length > 0 && sources.every((s) => s.selected);
  const toggleAll = async () => {
    const next = sources.map((s) => ({ ...s, selected: !allSelected }));
    setSources(next);
    try {
      const saved = await updateSources(next);
      setSources(saved);
    } catch {
      setSources(sources);
    }
  };

  const iconForType = (type: Source["type"]) => {
    switch (type) {
      case "pdf": return <FileText className="w-4 h-4 text-destructive" />;
      case "link": return <Link className="w-4 h-4 text-primary" />;
      case "transcript": return <FileText className="w-4 h-4 text-tofu-warm" />;
      case "reviews": return <Star className="w-4 h-4 text-amber-500" />;
      case "document": return <FileSpreadsheet className="w-4 h-4 text-emerald-600" />;
    }
  };

  const handleAddReviews = async (store: StoreType, appPageUrl: string) => {
    if (!currentProjectId) return;
    try {
      await addReviewsSource(currentProjectId, store, appPageUrl);
      await loadSources();
    } catch (e) {
      throw e;
    }
  };

  const handleAddDocuments = async (files: File[]) => {
    if (!currentProjectId) return;
    try {
      await addDocumentSources(currentProjectId, files);
      await loadSources();
    } catch (e) {
      throw e;
    }
  };

  return (
    <aside className={`${mobile ? "w-full h-full" : "w-72 min-w-[280px] border-r"} border-border flex flex-col panel-bg pb-safe`}>
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Sources</h2>
        <button
          type="button"
          className="p-1 rounded hover:bg-muted transition-colors"
          aria-label="View options (coming soon)"
          title="View options (coming soon)"
        >
          <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        </button>
      </div>

      <div className="p-3">
        <button
          onClick={() => setAddModalOpen(true)}
          disabled={!currentProjectId}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          <Plus className="w-4 h-4" />
          Add Sources
        </button>
        <AddSourcesModal
          open={addModalOpen}
          onOpenChange={setAddModalOpen}
          onAddReviews={handleAddReviews}
          onAddDocuments={handleAddDocuments}
        />
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search sources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-muted rounded-lg border-none outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="px-3 pb-2">
        <button
          onClick={toggleAll}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${allSelected ? "bg-primary border-primary" : "border-border"}`}>
            {allSelected && <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
          </div>
          Select All Sources
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 space-y-1">
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading sources…</p>
        ) : error ? (
          <p className="text-sm text-destructive py-4 text-center">{error}</p>
        ) : (
          sources
          .filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
          .map((source) => (
            <div
              key={source.id}
              onClick={() => toggleSource(source.id)}
              className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-muted transition-colors group"
            >
              <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${source.selected ? "bg-primary border-primary" : "border-border"}`}>
                {source.selected && <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              {iconForType(source.type)}
              <span className="text-sm truncate text-foreground">{source.name}</span>
            </div>
          )))}
      </div>
    </aside>
  );
};

export default SourcesPanel;
