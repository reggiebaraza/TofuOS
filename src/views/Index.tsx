'use client';

import TopBar from "@/components/TopBar";
import SourcesPanel from "@/components/SourcesPanel";
import ChatPanel from "@/components/ChatPanel";
import StudioPanel from "@/components/StudioPanel";
import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useProject } from "@/contexts/ProjectContext";

type MobileTab = "sources" | "chat" | "studio";

const Index = () => {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<MobileTab>("chat");
  const { ensureProject, isLoading: projectLoading } = useProject();

  useEffect(() => {
    if (projectLoading) return;
    ensureProject();
  }, [projectLoading, ensureProject]);

  if (projectLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-lg tofu-gradient animate-pulse" />
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="h-[100dvh] flex flex-col bg-background overflow-hidden">
        <TopBar />
        <nav className="flex border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80" aria-label="Main">
          {([
            { key: "sources", label: "Sources" },
            { key: "chat", label: "Chat" },
            { key: "studio", label: "Studio" },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3.5 text-sm font-medium transition-colors relative min-h-[44px] touch-manipulation ${
                activeTab === tab.key
                  ? "text-foreground"
                  : "text-muted-foreground active:bg-muted/50"
              }`}
              aria-current={activeTab === tab.key ? "page" : undefined}
              aria-label={`${tab.label} tab`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-0.5 bg-primary rounded-full" aria-hidden />
              )}
            </button>
          ))}
        </nav>
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {activeTab === "sources" && <SourcesPanel mobile />}
          {activeTab === "chat" && <ChatPanel />}
          {activeTab === "studio" && <StudioPanel mobile />}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <TopBar />
      <div className="flex flex-1 min-h-0 min-w-0">
        <SourcesPanel />
        <div className="w-px shrink-0 bg-border" aria-hidden />
        <ChatPanel />
        <div className="w-px shrink-0 bg-border" aria-hidden />
        <StudioPanel />
      </div>
    </div>
  );
};

export default Index;
