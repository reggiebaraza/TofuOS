'use client';

import { useState, useEffect, useCallback } from "react";
import { Send, ThumbsUp, ThumbsDown, Copy, Pin, Search } from "lucide-react";
import { toast } from "sonner";
import {
  fetchSources,
  chatWithAI,
  getChatMessages,
  appendChatMessage,
  searchProject,
} from "@/lib/api";
import type { InsightItem, InsightStatus, Source, ChatMessage } from "@/lib/api";
import { useProject } from "@/contexts/ProjectContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const suggestions = [
  "What should we build next based on customer feedback?",
  "Create a PRD for the most requested feature.",
  "Which pain points appear most frequently in the interviews?",
];

const insightStatusColors: Record<InsightStatus, { border: string; badge: string; label: string }> = {
  not_started: {
    border: "border-l-slate-400 dark:border-l-slate-500",
    badge: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-400/30",
    label: "Not started",
  },
  in_progress: {
    border: "border-l-amber-500 dark:border-l-amber-400",
    badge: "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30",
    label: "In progress",
  },
  done: {
    border: "border-l-emerald-500 dark:border-l-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30",
    label: "Done",
  },
};

const ChatPanel = () => {
  const { currentProjectId, currentProject } = useProject();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ sources: Source[]; messages: ChatMessage[]; insights: InsightItem[] } | null>(null);
  const [selectedSourcesCount, setSelectedSourcesCount] = useState(0);
  const [selectedSourceNames, setSelectedSourceNames] = useState<string[]>([]);
  const [feedbackByIndex, setFeedbackByIndex] = useState<Record<number, "up" | "down">>({});
  const [insightDetail, setInsightDetail] = useState<InsightItem | null>(null);

  // Load messages and source count when project changes
  useEffect(() => {
    if (!currentProjectId) {
      setMessages([]);
      setSelectedSourcesCount(0);
      return;
    }
    (async () => {
      const [msgList, sourcesList] = await Promise.all([
        getChatMessages(currentProjectId),
        fetchSources(currentProjectId),
      ]);
      setMessages(msgList.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
      const selected = sourcesList.filter((s) => s.selected);
      setSelectedSourcesCount(selected.length);
      setSelectedSourceNames(selected.map((s) => s.name));
    })();
  }, [currentProjectId]);

  const refreshSourceCount = useCallback(() => {
    if (!currentProjectId) return;
    fetchSources(currentProjectId).then((list) => {
      const selected = list.filter((s) => s.selected);
      setSelectedSourcesCount(selected.length);
      setSelectedSourceNames(selected.map((s) => s.name));
    }).catch(() => {});
  }, [currentProjectId]);

  useEffect(() => {
    window.addEventListener("focus", refreshSourceCount);
    return () => window.removeEventListener("focus", refreshSourceCount);
  }, [refreshSourceCount]);

  const runSearch = useCallback(() => {
    if (!currentProjectId || !searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    searchProject(currentProjectId, searchQuery).then((r) => {
      const hasAny = r.sources.length > 0 || r.messages.length > 0 || r.insights.length > 0;
      setSearchResults(hasAny ? r : null);
    });
  }, [currentProjectId, searchQuery]);

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults(null);
  };

  const handleSend = async () => {
    if (!input.trim() || !currentProjectId) return;
    
    const userMessage = input;
    setInput("");
    
    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: userMessage }
    ];
    
    setMessages([
      ...newMessages,
      { role: "assistant", content: "Thinking..." }
    ]);

    try {
      await appendChatMessage(currentProjectId, "user", userMessage);
      const sources = await fetchSources(currentProjectId);
      const selectedIds = sources.filter((s) => s.selected).map((s) => s.id);
      
      const response = await chatWithAI(
        userMessage,
        selectedIds,
        messages,
        currentProject?.summary ?? undefined
      );
      
      await appendChatMessage(currentProjectId, "assistant", response.content);
      setMessages([
        ...newMessages,
        { role: "assistant", content: response.content }
      ]);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Sorry, I encountered an error. Please check your connection and Gemini API key.";
      setMessages([
        ...newMessages,
        { role: "assistant", content: errMsg }
      ]);
    }
  };

  const renderContent = (text: string) => {
    // Simple bold markdown rendering
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  const isThinking =
    messages.length > 0 &&
    messages[messages.length - 1].role === "assistant" &&
    messages[messages.length - 1].content === "Thinking...";

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard");
  };

  const handlePin = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Saved to clipboard");
  };

  const setFeedback = (index: number, value: "up" | "down") => {
    setFeedbackByIndex((prev) => {
      const next = { ...prev };
      if (prev[index] === value) {
        delete next[index];
        return next;
      }
      next[index] = value;
      return next;
    });
  };

  return (
    <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden panel-bg" role="main" aria-label="Chat">
      <div className="shrink-0 px-4 sm:px-6 py-3 border-b border-border space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground tracking-tight">Chat</h2>
        </div>
        {/* Search project */}
        {currentProjectId && (
          <div className="flex gap-1">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search sources, chat, insights..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                className="w-full pl-7 pr-3 py-2 text-xs rounded-xl border border-border bg-muted/50 focus:bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-colors"
                aria-label="Search project"
              />
            </div>
            <button
              type="button"
              onClick={runSearch}
              className="px-3 py-2 text-xs font-medium rounded-xl border border-border hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              Search
            </button>
            {searchResults && (
              <button type="button" onClick={clearSearch} className="text-xs text-muted-foreground hover:text-foreground">
                Clear
              </button>
            )}
          </div>
        )}
        {searchResults && (
          <div className="rounded-md border border-border bg-muted/30 p-2 space-y-2 max-h-40 overflow-y-auto">
            {searchResults.sources.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Sources</p>
                {searchResults.sources.slice(0, 5).map((s) => (
                  <p key={s.id} className="text-xs truncate">{s.name}</p>
                ))}
                {searchResults.sources.length > 5 && <p className="text-xs text-muted-foreground">+{searchResults.sources.length - 5} more</p>}
              </div>
            )}
            {searchResults.messages.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Chat</p>
                {searchResults.messages.slice(0, 3).map((m, i) => (
                  <p key={i} className="text-xs truncate">{m.content.slice(0, 80)}{m.content.length > 80 ? "…" : ""}</p>
                ))}
                {searchResults.messages.length > 3 && <p className="text-xs text-muted-foreground">+{searchResults.messages.length - 3} more</p>}
              </div>
            )}
            {searchResults.insights.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Insights</p>
                {searchResults.insights.slice(0, 3).map((i, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setInsightDetail(i)}
                    className="block w-full text-left text-xs truncate hover:underline text-foreground"
                  >
                    {i.summary}
                  </button>
                ))}
                {searchResults.insights.length > 3 && <p className="text-xs text-muted-foreground">+{searchResults.insights.length - 3} more</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Insight detail popup (from search only) */}
      <Dialog open={!!insightDetail} onOpenChange={(open) => !open && setInsightDetail(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {insightDetail && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base pr-6">{insightDetail.summary}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 text-sm">
                <div>
                  <p className="font-medium text-muted-foreground mb-1">Status</p>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                      insightStatusColors[insightDetail.status ?? "not_started"].badge
                    )}
                  >
                    {insightStatusColors[insightDetail.status ?? "not_started"].label}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground mb-1">Description</p>
                  <p className="text-foreground whitespace-pre-wrap">{insightDetail.description || "—"}</p>
                </div>
                {insightDetail.action && (
                  <div>
                    <p className="font-medium text-muted-foreground mb-1">Action to take</p>
                    <p className="text-foreground whitespace-pre-wrap rounded-md bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 px-3 py-2">{insightDetail.action}</p>
                  </div>
                )}
                <div>
                  <p className="font-medium text-muted-foreground mb-1">Sources</p>
                  <p className="text-foreground">
                    {insightDetail.sourceNames?.length
                      ? insightDetail.sourceNames.join(", ")
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground mb-1">Evidence / Analysis</p>
                  <p className="text-foreground whitespace-pre-wrap">{insightDetail.evidence || "—"}</p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
        {messages.length === 0 && !isThinking && (
          <div className="text-center py-6 sm:py-8 text-muted-foreground text-sm max-w-sm mx-auto px-1">
            <p className="font-medium text-foreground mb-1">No messages yet</p>
            {selectedSourcesCount === 0 ? (
              <>
                <p className="mb-2">No sources in this project yet.</p>
                <ol className="text-left list-decimal list-inside space-y-1 text-xs">
                  <li>Add sources in the left panel (documents, links, reviews)</li>
                  <li>Use Studio to analyze sources and generate documents</li>
                  <li>Chat here using selected sources as context</li>
                </ol>
              </>
            ) : (
              <>
                <p>Ask a question about your selected sources, or use Studio to analyze and generate documents.</p>
                <p className="mt-2 text-xs">Using {selectedSourcesCount} selected source{selectedSourcesCount !== 1 ? "s" : ""} as context.</p>
              </>
            )}
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i}>
            {msg.role === "assistant" ? (
              <div className="space-y-3">
                <div className="text-sm leading-relaxed text-foreground whitespace-pre-line break-words">
                  {renderContent(msg.content)}
                </div>
                {msg.content !== "Thinking..." && (
                  <div className="flex items-center gap-1 pt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handlePin(msg.content)}
                      className="p-1.5 rounded hover:bg-muted transition-colors"
                      title="Save to clipboard"
                    >
                      <Pin className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.content)}
                      className="p-1.5 rounded hover:bg-muted transition-colors"
                      title="Copy"
                    >
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeedback(i, "up")}
                      className={`p-1.5 rounded transition-colors ${
                        feedbackByIndex[i] === "up" ? "bg-primary/15 text-primary" : "hover:bg-muted text-muted-foreground"
                      }`}
                      title="Good response"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeedback(i, "down")}
                      className={`p-1.5 rounded transition-colors ${
                        feedbackByIndex[i] === "down" ? "bg-destructive/15 text-destructive" : "hover:bg-muted text-muted-foreground"
                      }`}
                      title="Bad response"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex justify-end">
                <div className="tofu-gradient text-primary-foreground px-3 sm:px-4 py-2.5 rounded-2xl rounded-br-md text-sm max-w-[85%] sm:max-w-md break-words">
                  {msg.content}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Default suggestions */}
        {!isThinking && (
          <div className="space-y-2 pt-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setInput(s)}
                className="block w-fit text-left text-xs px-4 py-2.5 suggestion-bg rounded-xl suggestion-hover transition-colors text-muted-foreground hover:text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 sm:p-5 border-t border-border bg-background shrink-0">
        {selectedSourceNames.length > 0 && (
          <p className="text-xs text-muted-foreground mb-2 truncate" title={selectedSourceNames.join(", ")}>
            Using: {selectedSourceNames.slice(0, 3).join(", ")}{selectedSourceNames.length > 3 ? ` +${selectedSourceNames.length - 3} more` : ""}
          </p>
        )}
        <div className="flex items-center gap-2 chat-input-bg border border-border rounded-2xl px-4 py-2.5 focus-within:ring-2 focus-within:ring-ring/20 focus-within:border-primary/30 transition-all min-w-0">
          <input
            type="text"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="flex-1 min-w-0 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
            aria-label="Chat message"
          />
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 hidden sm:inline">
            {selectedSourcesCount} Source{selectedSourcesCount !== 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={handleSend}
            className="p-1.5 rounded-lg tofu-gradient text-primary-foreground hover:opacity-90 transition-opacity shrink-0"
            aria-label="Send message"
            title="Send (Enter)"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground text-center mt-2 px-1">
          Chat uses your selected sources as context. tofuOS can make mistakes — verify responses.
        </p>
      </div>
    </main>
  );
};

export default ChatPanel;
