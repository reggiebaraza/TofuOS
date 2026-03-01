'use client';

import { useState, useEffect, useCallback } from "react";
import { Send, ThumbsUp, ThumbsDown, Copy, Pin, Sparkles, ExternalLink, MessageCircle, MoreVertical, Trash2, Search, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  fetchSources,
  analyzeSources,
  getJiraConfig,
  chatWithAI,
  getProjectInsights,
  saveProjectInsights,
  getChatMessages,
  appendChatMessage,
  searchProject,
} from "@/lib/api";
import type { InsightItem, InsightStatus, Source, ChatMessage } from "@/lib/api";
import { useProject } from "@/contexts/ProjectContext";
import JiraConfigModal from "@/components/JiraConfigModal";
import CreateJiraModal from "@/components/CreateJiraModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const suggestions = [
  "What should we build next based on customer feedback?",
  "Create a PRD for the most requested feature.",
  "Which pain points appear most frequently in the interviews?",
];

const ChatPanel = () => {
  const { currentProjectId, currentProject } = useProject();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
  const [insightStatusFilter, setInsightStatusFilter] = useState<InsightStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ sources: Source[]; messages: ChatMessage[]; insights: InsightItem[] } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [jiraConfigured, setJiraConfigured] = useState(false);
  const [jiraConfigModalOpen, setJiraConfigModalOpen] = useState(false);
  const [createJiraModalOpen, setCreateJiraModalOpen] = useState(false);
  const [createJiraInsight, setCreateJiraInsight] = useState<{ summary: string; description: string } | null>(null);
  const [lastProjectKey, setLastProjectKey] = useState("");
  const [selectedSourcesCount, setSelectedSourcesCount] = useState(0);
  const [selectedSourceNames, setSelectedSourceNames] = useState<string[]>([]);
  const [feedbackByIndex, setFeedbackByIndex] = useState<Record<number, "up" | "down">>({});

  useEffect(() => {
    getJiraConfig().then((c) => {
      setJiraConfigured(!!c?.configured);
      if (c?.lastProjectKey) setLastProjectKey(c.lastProjectKey);
    });
  }, []);

  // Load messages and insights when project changes
  useEffect(() => {
    if (!currentProjectId) {
      setMessages([]);
      setInsights([]);
      setAnalyzeError(null);
      setSelectedSourcesCount(0);
      return;
    }
    setAnalyzeError(null);
    (async () => {
      const [msgList, insightList, sourcesList] = await Promise.all([
        getChatMessages(currentProjectId),
        getProjectInsights(currentProjectId),
        fetchSources(currentProjectId),
      ]);
      setMessages(msgList.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
      setInsights(insightList);
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

  const handleAnalyze = async () => {
    if (!currentProjectId) return;
    setAnalyzeError(null);
    setAnalyzing(true);
    try {
      const sources = await fetchSources(currentProjectId);
      const selectedIds = sources.filter((s) => s.selected).map((s) => s.id);
      if (selectedIds.length === 0) {
        setAnalyzeError("Select at least one source in the left panel.");
        return;
      }
      const { insights: list, suggestedPrompts: prompts } = await analyzeSources(selectedIds);
      setInsights((list || []).map((i) => ({ ...i, status: (i.status ?? "not_started") as InsightStatus })));
      setSuggestedPrompts(Array.isArray(prompts) ? prompts : []);
      setSelectedSourcesCount(selectedIds.length);
      await saveProjectInsights(currentProjectId, list || []);
      toast.success("Analysis complete. Try a suggested prompt below.");
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : "Analysis failed");
      setInsights([]);
      setSuggestedPrompts([]);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreateJiraClick = (insight: InsightItem) => {
    const payload = { summary: insight.summary, description: insight.description };
    if (!jiraConfigured) {
      setJiraConfigModalOpen(true);
      setCreateJiraInsight(payload);
    } else {
      setCreateJiraInsight(payload);
      setCreateJiraModalOpen(true);
    }
  };

  const handleJiraConfigSaved = () => {
    getJiraConfig().then((c) => {
      setJiraConfigured(!!c?.configured);
      if (c?.lastProjectKey) setLastProjectKey(c.lastProjectKey);
    });
    if (createJiraInsight) {
      setCreateJiraModalOpen(true);
    }
  };

  const handleJiraCreated = useCallback(
    (url: string, issueKey: string, summary: string) => {
      setLastProjectKey((prev) => issueKey.split("-")[0] || prev);
      getJiraConfig().then((c) => {
        if (c?.lastProjectKey) setLastProjectKey(c.lastProjectKey);
      });
    },
    []
  );

  const handleDeleteInsight = async (index: number) => {
    if (!currentProjectId) return;
    const next = insights.filter((_, i) => i !== index);
    setInsights(next);
    try {
      await saveProjectInsights(currentProjectId, next);
      toast.success("Insight removed");
    } catch (e) {
      toast.error("Failed to remove insight");
      setInsights(insights);
    }
  };

  const handleAskAI = (insight: InsightItem) => {
    setInput(`Can you elaborate on this insight or suggest next steps? "${insight.summary}"`);
    toast.info("Question added to chat — send to get a response");
  };

  const handleCopyFullInsight = (insight: InsightItem) => {
    const text = `${insight.summary}\n\n${insight.description}`;
    navigator.clipboard.writeText(text);
    toast.success("Copied summary and description to clipboard");
  };

  const setInsightStatus = async (index: number, status: InsightStatus) => {
    if (!currentProjectId) return;
    const next = insights.map((insight, i) => (i === index ? { ...insight, status } : insight));
    setInsights(next);
    try {
      await saveProjectInsights(currentProjectId, next);
    } catch {
      setInsights(insights);
    }
  };

  const moveInsight = async (index: number, delta: number) => {
    if (!currentProjectId) return;
    const next = [...insights];
    const j = index + delta;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setInsights(next);
    try {
      await saveProjectInsights(currentProjectId, next);
    } catch {
      setInsights(insights);
    }
  };

  const filteredInsights = insightStatusFilter === "all"
    ? insights
    : insights.filter((i) => (i.status ?? "not_started") === insightStatusFilter);

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
    <main className="flex-1 flex flex-col min-w-0 min-h-0 panel-bg">
      {/* Header: single Analyze button, no placeholder Filters/More */}
      <div className="px-3 sm:px-6 py-3 border-b border-border flex-shrink-0 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Chat</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-sm font-medium tofu-gradient text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-70"
              aria-label={analyzing ? "Analyzing sources" : "Analyze sources"}
              title={analyzing ? "Analyzing…" : "Analyze selected sources"}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{analyzing ? "Analyzing…" : "Analyze sources"}</span>
              <span className="sm:hidden">{analyzing ? "…" : "Analyze"}</span>
            </button>
          </div>
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
                className="w-full pl-7 pr-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground"
                aria-label="Search project"
              />
            </div>
            <button
              type="button"
              onClick={runSearch}
              className="px-2 py-1.5 text-xs rounded-md border border-border hover:bg-muted"
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
                  <p key={idx} className="text-xs truncate">{i.summary}</p>
                ))}
                {searchResults.insights.length > 3 && <p className="text-xs text-muted-foreground">+{searchResults.insights.length - 3} more</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Insights list with status filter and one Export to Jira per row, rest in More */}
      {insights.length > 0 && (
        <div className="px-3 sm:px-6 py-4 border-b border-border bg-muted/30 flex-shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-medium text-foreground">Insights (project manager)</h3>
            <select
              value={insightStatusFilter}
              onChange={(e) => setInsightStatusFilter(e.target.value as InsightStatus | "all")}
              className="text-xs rounded-md border border-border bg-background px-2 py-1 text-foreground"
              aria-label="Filter by status"
            >
              <option value="all">All</option>
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </select>
          </div>
          <ul className="space-y-2">
            {filteredInsights.map((insight, i) => {
              const globalIndex = insights.indexOf(insight);
              const status = insight.status ?? "not_started";
              return (
              <li
                key={globalIndex}
                className="flex flex-col sm:flex-row sm:items-start gap-2 text-sm text-foreground bg-background border border-border rounded-lg px-3 py-2"
              >
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <div className="flex flex-col gap-0 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveInsight(globalIndex, -1)}
                      disabled={globalIndex === 0}
                      className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveInsight(globalIndex, 1)}
                      disabled={globalIndex === insights.length - 1}
                      className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <select
                    value={status}
                    onChange={(e) => setInsightStatus(globalIndex, e.target.value as InsightStatus)}
                    className="text-xs rounded border border-border bg-muted/50 px-2 py-0.5 text-foreground"
                    aria-label="Set status"
                    title="Status"
                  >
                    <option value="not_started">Not started</option>
                    <option value="in_progress">In progress</option>
                    <option value="done">Done</option>
                  </select>
                  <span className="min-w-0">{insight.summary}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCreateJiraClick(insight)}
                    className="flex items-center justify-center sm:justify-start gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    title="Export to Jira"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Export to Jira
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                        aria-label="More actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleAskAI(insight)} className="flex items-center gap-2 cursor-pointer">
                        <MessageCircle className="w-4 h-4" />
                        Ask AI / Follow up
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleCopyFullInsight(insight)} className="flex items-center gap-2 cursor-pointer">
                        <Copy className="w-4 h-4" />
                        Copy full (summary + description)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteInsight(globalIndex)}
                        className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete insight
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            );})}
          </ul>
        </div>
      )}
      {analyzeError && (
        <div className="px-3 sm:px-6 py-2 text-sm text-destructive flex-shrink-0">{analyzeError}</div>
      )}

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
                  <li>Run &quot;Analyze sources&quot; to get PM insights</li>
                  <li>Chat here or export insights to Jira</li>
                </ol>
              </>
            ) : (
              <>
                <p>Add sources in the left panel, then ask a question here or run &quot;Analyze sources&quot; to get AI insights.</p>
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

        {/* Suggested prompts after analysis */}
        {suggestedPrompts.length > 0 && !isThinking && (
          <div className="space-y-1.5 pt-2">
            <p className="text-xs font-medium text-muted-foreground">Suggested follow-ups</p>
            {suggestedPrompts.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setInput(s)}
                className="block w-fit text-left text-xs px-3 py-2 suggestion-bg rounded-lg suggestion-hover transition-colors text-muted-foreground hover:text-foreground border border-border"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {/* Default suggestions */}
        {!isThinking && suggestedPrompts.length === 0 && (
          <div className="space-y-1.5 pt-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setInput(s)}
                className="block w-fit text-left text-xs px-3 py-2 suggestion-bg rounded-lg suggestion-hover transition-colors text-muted-foreground hover:text-foreground border border-border"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 sm:p-4 border-t border-border bg-background flex-shrink-0">
        {selectedSourceNames.length > 0 && (
          <p className="text-xs text-muted-foreground mb-1.5 truncate" title={selectedSourceNames.join(", ")}>
            Using: {selectedSourceNames.slice(0, 3).join(", ")}{selectedSourceNames.length > 3 ? ` +${selectedSourceNames.length - 3} more` : ""}
          </p>
        )}
        <div className="flex items-center gap-2 chat-input-bg border border-border rounded-xl px-3 sm:px-4 py-2 focus-within:ring-2 focus-within:ring-ring transition-shadow min-w-0">
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

      <JiraConfigModal
        open={jiraConfigModalOpen}
        onOpenChange={setJiraConfigModalOpen}
        onSaved={handleJiraConfigSaved}
      />
      <CreateJiraModal
        key={createJiraModalOpen && createJiraInsight ? `jira-${createJiraInsight.summary}` : "jira-closed"}
        open={createJiraModalOpen}
        onOpenChange={setCreateJiraModalOpen}
        insight={createJiraInsight}
        initialProjectKey={lastProjectKey}
        projectId={currentProjectId}
        onCreated={(url, issueKey, summary) => {
          setLastProjectKey(issueKey.split("-")[0] || lastProjectKey);
          handleJiraCreated(url, issueKey, summary);
        }}
      />
    </main>
  );
};

export default ChatPanel;
