'use client';

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createJiraIssue } from "@/lib/api";

interface CreateJiraModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insight: { summary: string; description: string } | null;
  initialProjectKey?: string;
  projectId?: string | null;
  onCreated?: (url: string, issueKey: string, summary: string) => void;
}

export default function CreateJiraModal({
  open,
  onOpenChange,
  insight,
  initialProjectKey = "",
  projectId,
  onCreated,
}: CreateJiraModalProps) {
  const [summary, setSummary] = useState(insight?.summary ?? "");
  const [description, setDescription] = useState(insight?.description ?? "");
  const [projectKey, setProjectKey] = useState(initialProjectKey);
  const [issueType, setIssueType] = useState("Task");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSummary(insight?.summary ?? "");
      setDescription(insight?.description ?? "");
      setProjectKey(initialProjectKey);
      setCreatedUrl(null);
    }
  }, [open, insight, initialProjectKey]);

  const reset = () => {
    setSummary(insight?.summary ?? "");
    setDescription(insight?.description ?? "");
    setProjectKey("");
    setIssueType("Task");
    setError(null);
    setCreatedUrl(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleCreate = async () => {
    setError(null);
    // Use current state, falling back to insight prop in case effect hasn't run yet (avoids needing two clicks)
    const summaryVal = summary.trim() || insight?.summary?.trim() || "";
    const descriptionVal = description.trim() || insight?.description?.trim() || summaryVal || "";
    const projectVal = projectKey.trim();
    if (!summaryVal) {
      setError("Summary is required.");
      return;
    }
    if (!projectVal) {
      setError("Project key is required (e.g. KAN).");
      return;
    }
    setCreating(true);
    try {
      const result = await createJiraIssue({
        summary: summaryVal,
        description: descriptionVal || summaryVal,
        projectKey: projectVal,
        issueType: issueType.trim() || undefined,
        projectId: projectId ?? undefined,
      });
      setCreatedUrl(result.url);
      onCreated?.(result.url, result.key, summaryVal);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create issue");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Jira ticket</DialogTitle>
          <DialogDescription>
            Create a Jira issue from this insight. Edit summary and optional fields below.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {createdUrl ? (
            <div className="space-y-2">
              <p className="text-sm text-foreground">Ticket created.</p>
              <a
                href={createdUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary underline"
              >
                Open in Jira
              </a>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => handleOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="jira-summary">Summary</Label>
                <Input
                  id="jira-summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Issue summary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jira-description">Description (optional)</Label>
                <Textarea
                  id="jira-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Issue description — more detail is added when creating from an insight"
                  rows={4}
                  className="resize-y min-h-[80px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="jira-project">Project key</Label>
                  <Input
                    id="jira-project"
                    value={projectKey}
                    onChange={(e) => setProjectKey(e.target.value)}
                    placeholder="e.g. PROJ"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jira-type">Issue type</Label>
                  <Input
                    id="jira-type"
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value)}
                    placeholder="Task"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="w-full tofu-gradient text-primary-foreground hover:opacity-90"
              >
                {creating ? "Creating…" : "Create issue"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
