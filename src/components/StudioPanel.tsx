'use client';

import { useState, useEffect, useCallback } from "react";
import { jsPDF } from "jspdf";
import {
  FileText,
  Code,
  BookOpen,
  CheckSquare,
  LayoutDashboard,
  Bug,
  BarChart3,
  Users,
  Database,
  Rocket,
  Map,
  Pencil,
  LayoutGrid,
  List,
  Lightbulb,
  Copy,
  Download,
  RefreshCw,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { fetchSources, generateStudioDocument, getStudioDocuments, saveStudioDocument, updateStudioDocument, deleteStudioDocument } from "@/lib/api";
import type { StudioDocumentItem } from "@/lib/api";
import { useProject } from "@/contexts/ProjectContext";
import InsightsModal from "@/components/InsightsModal";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StudioItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const studioItems: StudioItem[] = [
  { id: "insights", label: "Analyze sources / Insights", icon: <Lightbulb className="w-4 h-4" />, color: "text-tofu-warm" },
  { id: "prd", label: "PRD", icon: <FileText className="w-4 h-4" />, color: "text-primary" },
  { id: "coding-rules", label: "AI Coding Rules & Standards", icon: <Code className="w-4 h-4" />, color: "text-tofu-warm" },
  { id: "api-docs", label: "API Documentation", icon: <BookOpen className="w-4 h-4" />, color: "text-primary" },
  { id: "accessibility", label: "Accessibility Compliance", icon: <CheckSquare className="w-4 h-4" />, color: "text-tofu-warm" },
  { id: "architecture", label: "App Architecture Plan", icon: <LayoutDashboard className="w-4 h-4" />, color: "text-primary" },
  { id: "bug-fix", label: "Bug Investigation & Fix Plan", icon: <Bug className="w-4 h-4" />, color: "text-destructive" },
  { id: "competitive", label: "Competitive Analysis Report", icon: <BarChart3 className="w-4 h-4" />, color: "text-tofu-warm" },
  { id: "journey-map", label: "Customer Journey Map", icon: <Users className="w-4 h-4" />, color: "text-primary" },
  { id: "db-schema", label: "Database Schema Design", icon: <Database className="w-4 h-4" />, color: "text-tofu-warm" },
  { id: "feature-spec", label: "Feature Implementation Spec", icon: <Rocket className="w-4 h-4" />, color: "text-primary" },
  { id: "gtm", label: "Go-to-Market Plan", icon: <Map className="w-4 h-4" />, color: "text-tofu-warm" },
];

const StudioPanel = ({ mobile }: { mobile?: boolean }) => {
  const { currentProjectId } = useProject();
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [gridLayout, setGridLayout] = useState(true);
  const [sources, setSources] = useState<{ id: string; selected: boolean }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [insightsModalOpen, setInsightsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [documents, setDocuments] = useState<StudioDocumentItem[]>([]);
  const [documentModalDoc, setDocumentModalDoc] = useState<StudioDocumentItem | null>(null);
  const [modalContent, setModalContent] = useState("");

  const loadDocuments = useCallback(async () => {
    if (!currentProjectId) {
      setDocuments([]);
      return;
    }
    try {
      const list = await getStudioDocuments(currentProjectId);
      setDocuments(list);
    } catch {
      setDocuments([]);
    }
  }, [currentProjectId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const loadSources = useCallback(async () => {
    if (!currentProjectId) {
      setSources([]);
      return;
    }
    try {
      const list = await fetchSources(currentProjectId);
      setSources(list.map((s) => ({ id: s.id, selected: s.selected })));
    } catch {
      setSources([]);
    }
  }, [currentProjectId]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const selectedSourceIds = sources.filter((s) => s.selected).map((s) => s.id);

  const runDocumentGeneration = useCallback(
    async (documentType: string) => {
      if (selectedSourceIds.length === 0) {
        setError("Select at least one source in the left panel. Documents are generated from your added sources.");
        return;
      }
      setError(null);
      setLoading(true);
      setLoadingLabel(studioItems.find((i) => i.id === documentType)?.label ?? documentType);
      try {
        const { content } = await generateStudioDocument(documentType, selectedSourceIds);
        const label = studioItems.find((i) => i.id === documentType)?.label ?? documentType;
        if (currentProjectId) {
          const saved = await saveStudioDocument(currentProjectId, {
            document_type: documentType,
            label,
            content,
            source_count: selectedSourceIds.length,
          });
          setDocuments((prev) => [saved, ...prev]);
          setDocumentModalDoc(saved);
          setModalContent(saved.content);
        } else {
          setDocumentModalDoc(null);
          setModalContent("");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Generation failed");
      } finally {
        setLoading(false);
      }
    },
    [selectedSourceIds, currentProjectId]
  );

  const handleDocumentCardClick = (item: StudioItem) => {
    if (item.id === "insights") {
      setInsightsModalOpen(true);
      setActiveItem(null);
      return;
    }
    setActiveItem(activeItem === item.id ? null : item.id);
    runDocumentGeneration(item.id);
  };

  const handleOpenDocument = (doc: StudioDocumentItem) => {
    setDocumentModalDoc(doc);
    setModalContent(doc.content);
  };

  const handleCloseDocumentModal = () => {
    setDocumentModalDoc(null);
    setModalContent("");
  };

  const handleSaveModalDocument = useCallback(async () => {
    if (!documentModalDoc) return;
    try {
      await updateStudioDocument(documentModalDoc.id, modalContent);
      setDocuments((prev) =>
        prev.map((d) => (d.id === documentModalDoc.id ? { ...d, content: modalContent } : d))
      );
      setDocumentModalDoc((prev) => (prev ? { ...prev, content: modalContent } : null));
      toast.success("Saved");
    } catch {
      toast.error("Failed to save");
    }
  }, [documentModalDoc, modalContent]);

  const handleRegenerateModalDocument = useCallback(async () => {
    if (!documentModalDoc || !currentProjectId) return;
    setLoading(true);
    setLoadingLabel(documentModalDoc.label);
    try {
      const { content } = await generateStudioDocument(documentModalDoc.document_type, selectedSourceIds);
      await updateStudioDocument(documentModalDoc.id, content);
      setModalContent(content);
      setDocuments((prev) =>
        prev.map((d) => (d.id === documentModalDoc.id ? { ...d, content } : d))
      );
      setDocumentModalDoc((prev) => (prev ? { ...prev, content } : null));
      toast.success("Regenerated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regeneration failed");
    } finally {
      setLoading(false);
    }
  }, [documentModalDoc, currentProjectId, selectedSourceIds]);

  const handleDeleteDocument = async (id: string) => {
    try {
      await deleteStudioDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      if (documentModalDoc?.id === id) handleCloseDocumentModal();
      toast.success("Document deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const downloadAsPdf = (content: string, label: string) => {
    if (!content) return;
    const filename = `${label.replace(/\s+/g, "-")}.pdf`;
    const doc = new jsPDF({ format: "a4", unit: "mm" });
    const margin = 20;
    const pageWidth = doc.getPageWidth();
    const maxWidth = pageWidth - margin * 2;
    let y = margin;
    const lineHeight = 6;
    const fontSize = 10;
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(content, maxWidth);
    for (const line of lines) {
      if (y > doc.getPageHeight() - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }
    doc.save(filename);
    toast.success("Downloaded as PDF");
  };

  function formatTimeAgo(createdAt: string | undefined): string {
    if (!createdAt) return "";
    const d = new Date(createdAt);
    const now = new Date();
    const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <aside className={`${mobile ? "w-full h-full" : "w-80 min-w-[300px] shrink-0 border-l"} border-border flex flex-col panel-bg`} aria-label="Studio">
      <div className="p-4 pb-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground tracking-tight">Studio</h2>
        <button
          type="button"
          onClick={() => setGridLayout(!gridLayout)}
          className="p-1 rounded hover:bg-muted transition-colors"
          title={gridLayout ? "List layout" : "Grid layout"}
        >
          {gridLayout ? (
            <List className="w-4 h-4 text-muted-foreground" />
          ) : (
            <LayoutGrid className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </div>

      <div className="flex-shrink-0 overflow-y-auto p-3">
        <div className={gridLayout ? "grid grid-cols-2 gap-2" : "flex flex-col gap-2"}>
          {studioItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleDocumentCardClick(item)}
              className={`flex items-center gap-2.5 p-3.5 rounded-xl text-left transition-all group border-2 studio-card-bg studio-card-hover border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                activeItem === item.id
                  ? "bg-primary/10 border-primary/30 shadow-sm"
                  : "hover:border-border"
              }`}
            >
              <span className={item.color}>{item.icon}</span>
              <span className="text-xs font-medium text-foreground leading-tight flex-1">
                {item.label}
              </span>
              <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Loader + document list only (no inline editor) */}
      <div className="flex-1 min-h-0 flex flex-col border-t border-border bg-background overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Generating {loadingLabel}…</p>
              <p className="text-xs text-muted-foreground">based on {selectedSourceIds.length} source{selectedSourceIds.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        ) : null}

        {!loading && documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-6 px-4 text-muted-foreground">
            <FileText className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-xs leading-relaxed">
              Select sources in the left panel, then click a document type above to generate. Open a document from the list to view or edit.
            </p>
          </div>
        ) : null}

        {/* List of generated documents */}
        {documents.length > 0 ? (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <p className="text-xs font-medium text-muted-foreground px-3 py-2 sticky top-0 bg-background border-b border-border">Generated documents</p>
            <ul className="space-y-0.5 p-2 pb-4">
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg group ${
                    documentModalDoc?.id === doc.id ? "bg-primary/10" : "hover:bg-muted/50"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleOpenDocument(doc)}
                    className="flex-1 min-w-0 flex items-center gap-2 text-left"
                  >
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{doc.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.source_count} source{doc.source_count !== 1 ? "s" : ""} · {formatTimeAgo(doc.created_at)}
                      </p>
                    </div>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="p-1.5 rounded hover:bg-muted sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        aria-label="Options"
                      >
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenDocument(doc)} className="cursor-pointer">
                        Open
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => downloadAsPdf(doc.content, doc.label)}
                        className="cursor-pointer"
                      >
                        Download PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="cursor-pointer text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {error && <p className="text-xs text-destructive px-4 py-2 flex-shrink-0">{error}</p>}

      {/* Document view/edit popup */}
      <Dialog open={!!documentModalDoc} onOpenChange={(open) => !open && handleCloseDocumentModal()}>
        <DialogContent className="z-[60] max-w-3xl h-[85vh] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden w-[95vw] sm:w-full">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border flex-shrink-0 pr-12">
            <DialogHeader className="min-w-0 flex-1">
              <DialogTitle className="text-base truncate">{documentModalDoc?.label}</DialogTitle>
            </DialogHeader>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={handleSaveModalDocument}
                className="text-xs font-medium text-primary hover:underline px-2"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(modalContent);
                  toast.success("Copied");
                }}
                className="p-2 rounded hover:bg-muted"
                title="Copy"
              >
                <Copy className="w-4 h-4 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={() => documentModalDoc && downloadAsPdf(modalContent, documentModalDoc.label)}
                className="p-2 rounded hover:bg-muted flex items-center gap-1"
                title="Download PDF"
              >
                <Download className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs hidden sm:inline">Download</span>
              </button>
              <button
                type="button"
                onClick={handleRegenerateModalDocument}
                className="p-2 rounded hover:bg-muted flex items-center gap-1"
                title="Regenerate"
              >
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs hidden sm:inline">Regenerate</span>
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col min-h-[200px]">
            <textarea
              value={modalContent}
              onChange={(e) => setModalContent(e.target.value)}
              className="flex-1 min-h-[200px] w-full p-4 text-sm font-mono whitespace-pre-wrap resize-none focus:outline-none focus:ring-0 border-0 bg-transparent overflow-auto"
              spellCheck={false}
            />
          </div>
        </DialogContent>
      </Dialog>

      <InsightsModal
        open={insightsModalOpen}
        onOpenChange={setInsightsModalOpen}
        projectId={currentProjectId}
      />
    </aside>
  );
};

export default StudioPanel;
