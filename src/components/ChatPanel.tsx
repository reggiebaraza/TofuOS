'use client';

import { useState, useEffect, useCallback } from "react";
import { Send, ThumbsUp, ThumbsDown, Copy, Pin, SlidersHorizontal, MoreVertical, Sparkles, ExternalLink, MessageCircle, Trash2 } from "lucide-react";
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
  getExportedJiraTickets,
  deleteExportedJiraTicket,
} from "@/lib/api";
import type { InsightItem, ExportedJiraTicket } from "@/lib/api";
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
  const { currentProjectId } = useProject();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [jiraConfigured, setJiraConfigured] = useState(false);
  const [jiraConfigModalOpen, setJiraConfigModalOpen] = useState(false);
  const [createJiraModalOpen, setCreateJiraModalOpen] = useState(false);
  const [createJiraInsight, setCreateJiraInsight] = useState<{ summary: string; description: string } | null>(null);
  const [lastProjectKey, setLastProjectKey] = useState("");
  const [selectedSourcesCount, setSelectedSourcesCount] = useState(0);
  const [feedbackByIndex, setFeedbackByIndex] = useState<Record<number, "up" | "down">>({});
  const [exportedTickets, setExportedTickets] = useState<ExportedJiraTicket[]>([]);

  useEffect(() => {
    getJiraConfig().then((c) => {
      setJiraConfigured(!!c?.configured);
      if (c?.lastProjectKey) setLastProjectKey(c.lastProjectKey);
    });
  }, []);

  // Load messages, insights, and exported tickets when project changes
  useEffect(() => {
    if (!currentProjectId) {
      setMessages([]);
      setInsights([]);
      setExportedTickets([]);
      setAnalyzeError(null);
      setSelectedSourcesCount(0);
      return;
    }
    setAnalyzeError(null);
    (async () => {
      const [msgList, insightList, tickets] = await Promise.all([
        getChatMessages(currentProjectId),
        getProjectInsights(currentProjectId),
        getExportedJiraTickets(currentProjectId),
      ]);
      setMessages(msgList.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
      setInsights(insightList);
      setExportedTickets(tickets);
      const sources = await fetchSources(currentProjectId);
      setSelectedSourcesCount(sources.filter((s) => s.selected).length);
    })();
  }, [currentProjectId]);

  const refreshSourceCount = useCallback(() => {
    if (!currentProjectId) return;
    fetchSources(currentProjectId).then((list) => setSelectedSourcesCount(list.filter((s) => s.selected).length)).catch(() => {});
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
      const { insights: list } = await analyzeSources(selectedIds);
      setInsights(list || []);
      setSelectedSourcesCount(selectedIds.length);
      await saveProjectInsights(currentProjectId, list || []);
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : "Analysis failed");
      setInsights([]);
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
    async (url: string, issueKey: string, summary: string) => {
      if (!currentProjectId) return;
      setLastProjectKey((prev) => issueKey.split("-")[0] || prev);
      getJiraConfig().then((c) => {
        if (c?.lastProjectKey) setLastProjectKey(c.lastProjectKey);
      });
      const tickets = await getExportedJiraTickets(currentProjectId);
      setExportedTickets(tickets);
    },
    [currentProjectId]
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
      
      const response = await chatWithAI(userMessage, selectedIds, messages);
      
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
      {/* Header */}
      <div className="px-3 sm:px-6 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
        <h2 className="text-sm font-semibold text-foreground">Chat</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-sm font-medium tofu-gradient text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-70"
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">{analyzing ? "Analyzing…" : "Analyze sources"}</span>
            <span className="sm:hidden">{analyzing ? "…" : "Analyze"}</span>
          </button>
          <button
            type="button"
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Filters (coming soon)"
            title="Filters (coming soon)"
          >
            <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            type="button"
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="More options (coming soon)"
            title="More options (coming soon)"
          >
            <MoreVertical className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Insights list (PM analysis) */}
      {insights.length > 0 && (
        <div className="px-3 sm:px-6 py-4 border-b border-border bg-muted/30 flex-shrink-0">
          <h3 className="text-sm font-medium text-foreground mb-3">Insights (project manager)</h3>
          <ul className="space-y-2">
            {insights.map((insight, i) => (
              <li
                key={i}
                className="flex flex-col sm:flex-row sm:items-start gap-2 text-sm text-foreground bg-background border border-border rounded-lg px-3 py-2"
              >
                <span className="flex-1 min-w-0">{insight.summary}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCreateJiraClick(insight)}
                    className="flex items-center justify-center sm:justify-start gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Export to Jira
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                        aria-label="Insight options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleAskAI(insight)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Ask AI / Follow up
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleCreateJiraClick(insight)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Export to Jira
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteInsight(i)}
                        className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete insight
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* Exported to Jira (under Analysis) - show when we have insights or any exports */}
      {(insights.length > 0 || exportedTickets.length > 0) && (
        <div className="px-3 sm:px-6 py-4 border-b border-border bg-muted/20 flex-shrink-0">
          <h3 className="text-sm font-medium text-foreground mb-3">Exported to Jira</h3>
          {exportedTickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tickets exported yet. Use &quot;Export to Jira&quot; on an insight above.</p>
          ) : (
          <ul className="space-y-2">
            {exportedTickets.map((t) => (
              <li
                key={t.id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-foreground bg-background border border-border rounded-lg px-3 py-2"
              >
                <a
                  href={t.jira_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-0 text-primary hover:underline truncate"
                >
                  <span className="font-medium">{t.jira_key}</span>
                  <span className="text-muted-foreground ml-1.5">— {t.summary}</span>
                </a>
                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={t.jira_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open in Jira
                  </a>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await deleteExportedJiraTicket(t.id);
                        setExportedTickets((prev) => prev.filter((x) => x.id !== t.id));
                        toast.success("Removed from list");
                      } catch (e) {
                        toast.error("Failed to remove");
                      }
                    }}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Remove from list"
                    title="Remove from list (does not delete the Jira ticket)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          )}
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
            <p>Add sources in the left panel, then ask a question here or run &quot;Analyze sources&quot; to get AI insights.</p>
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

        {/* Suggestions: hidden while AI is thinking, smaller size */}
        {!isThinking && (
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
        <div className="flex items-center gap-2 chat-input-bg border border-border rounded-xl px-3 sm:px-4 py-2 focus-within:ring-2 focus-within:ring-ring transition-shadow min-w-0">
          <input
            type="text"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            className="flex-1 min-w-0 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
          />
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 hidden sm:inline">
            {selectedSourcesCount} Source{selectedSourcesCount !== 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={handleSend}
            className="p-1.5 rounded-lg tofu-gradient text-primary-foreground hover:opacity-90 transition-opacity shrink-0"
            aria-label="Send message"
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
