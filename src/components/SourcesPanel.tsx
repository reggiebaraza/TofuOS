'use client';

import { Plus, Search, FileText, Link, Star, FileSpreadsheet } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import AddSourcesModal from "@/components/AddSourcesModal";
import type { StoreType } from "@/components/AddSourcesModal";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import {
  fetchSources,
  updateSources,
  addReviewsSource,
  addDocumentSources,
  addAudioSources,
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

  const handleAddAudio = async (files: File[]) => {
    if (!currentProjectId) return;
    try {
      await addAudioSources(currentProjectId, files);
      await loadSources();
    } catch (e) {
      throw e;
    }
  };

  return (
    <aside className={`${mobile ? "w-full h-full" : "w-72 min-w-[280px] shrink-0 border-r"} border-border flex flex-col panel-bg pb-safe`} aria-label="Sources">
      <div className="p-4 pb-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground tracking-tight">Sources</h2>
      </div>

      <div className="p-3 pt-0">
        <button
          onClick={() => setAddModalOpen(true)}
          disabled={!currentProjectId}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-border rounded-xl text-sm font-medium text-muted-foreground hover:border-primary/40 hover:bg-muted/50 hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
          aria-label="Add sources"
        >
          <Plus className="w-4 h-4" aria-hidden />
          Add Sources
        </button>
        <AddSourcesModal
          open={addModalOpen}
          onOpenChange={setAddModalOpen}
          onAddReviews={handleAddReviews}
          onAddDocuments={handleAddDocuments}
          onAddAudio={handleAddAudio}
        />
      </div>

      <div className="px-3 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden />
          <input
            type="search"
            placeholder="Search sources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm bg-muted/80 rounded-xl border border-transparent focus:border-border focus:bg-background outline-none focus:ring-2 focus:ring-ring/20 text-foreground placeholder:text-muted-foreground transition-colors"
            aria-label="Search sources"
          />
        </div>
      </div>

      <div className="px-3 pb-3">
        <button
          onClick={toggleAll}
          className="flex items-center gap-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg py-1 pr-1"
          aria-pressed={allSelected}
        >
          <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 ${allSelected ? "bg-primary border-primary" : "border-border"}`}>
            {allSelected && <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden><polyline points="20 6 9 17 4 12"/></svg>}
          </div>
          Select All
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4 space-y-0.5">
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading sources…</p>
        ) : error ? (
          <p className="text-sm text-destructive py-6 text-center px-2">{error}</p>
        ) : (
          sources
          .filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
          .map((source) => (
            <button
              key={source.id}
              type="button"
              onClick={() => toggleSource(source.id)}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-muted/80 transition-colors group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              aria-pressed={source.selected}
              aria-label={`${source.name}, ${source.selected ? "selected" : "not selected"}`}
            >
              <div className={`w-4 h-4 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-colors ${source.selected ? "bg-primary border-primary" : "border-border"}`}>
                {source.selected && <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              {iconForType(source.type)}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium truncate text-foreground block">{source.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  {source.type}
                  {source.created_at && ` · ${formatDistanceToNow(new Date(source.created_at), { addSuffix: true })}`}
                </span>
              </div>
            </button>
          )))}
      </div>
    </aside>
  );
};

export default SourcesPanel;
