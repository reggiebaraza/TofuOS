'use client';

import { useState, useEffect, useCallback } from "react";
import { Send, ThumbsUp, ThumbsDown, Copy, Pin, SlidersHorizontal, MoreVertical, Sparkles, ExternalLink } from "lucide-react";
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
} from "@/lib/api";
import type { InsightItem } from "@/lib/api";
import { useProject } from "@/contexts/ProjectContext";
import JiraConfigModal from "@/components/JiraConfigModal";
import CreateJiraModal from "@/components/CreateJiraModal";

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
      const [msgList, insightList] = await Promise.all([
        getChatMessages(currentProjectId),
        getProjectInsights(currentProjectId),
      ]);
      setMessages(msgList.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
      setInsights(insightList);
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
    <main className="flex-1 flex flex-col min-w-0 panel-bg">
      {/* Header */}
      <div className="px-6 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Chat</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium tofu-gradient text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-70"
          >
            <Sparkles className="w-4 h-4" />
            {analyzing ? "Analyzing…" : "Analyze sources"}
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
        <div className="px-6 py-4 border-b border-border bg-muted/30">
          <h3 className="text-sm font-medium text-foreground mb-3">Insights (project manager)</h3>
          <ul className="space-y-2">
            {insights.map((insight, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-foreground bg-background border border-border rounded-lg px-3 py-2"
              >
                <span className="flex-1 min-w-0">{insight.summary}</span>
                <button
                  type="button"
                  onClick={() => handleCreateJiraClick(insight)}
                  className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Create Jira ticket
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {analyzeError && (
        <div className="px-6 py-2 text-sm text-destructive">{analyzeError}</div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {messages.length === 0 && !isThinking && (
          <div className="text-center py-8 text-muted-foreground text-sm max-w-sm mx-auto">
            <p className="font-medium text-foreground mb-1">No messages yet</p>
            <p>Add sources in the left panel, then ask a question here or run &quot;Analyze sources&quot; to get AI insights.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i}>
            {msg.role === "assistant" ? (
              <div className="space-y-3">
                <div className="text-sm leading-relaxed text-foreground whitespace-pre-line">
                  {renderContent(msg.content)}
                </div>
                {msg.content !== "Thinking..." && (
                  <div className="flex items-center gap-1 pt-1">
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
                <div className="tofu-gradient text-primary-foreground px-4 py-2.5 rounded-2xl rounded-br-md text-sm max-w-md">
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
      <div className="p-4 border-t border-border bg-background">
        <div className="flex items-center gap-2 chat-input-bg border border-border rounded-xl px-4 py-2 focus-within:ring-2 focus-within:ring-ring transition-shadow mb-safe">
          <input
            type="text"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
          />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {selectedSourcesCount} Source{selectedSourcesCount !== 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={handleSend}
            className="p-1.5 rounded-lg tofu-gradient text-primary-foreground hover:opacity-90 transition-opacity"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground text-center mt-2">
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
        onCreated={(url, key) => {
          setLastProjectKey(key);
        }}
      />
    </main>
  );
};

export default ChatPanel;
