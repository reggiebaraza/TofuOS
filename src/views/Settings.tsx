'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import {
  getJiraConfig,
  fetchProjects,
  updateProject,
  deleteProject,
  type JiraConfig,
  type Project,
} from "@/lib/api";
import JiraConfigModal from "@/components/JiraConfigModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  User,
  LogOut,
  Key,
  ExternalLink,
  ChevronLeft,
  CheckCircle,
  XCircle,
  Info,
  FolderOpen,
  Pencil,
  Trash2,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";

const Settings = () => {
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { projects: _projects, setCurrentProjectId, refreshProjects, currentProjectId } = useProject();
  const [jiraConfig, setJiraConfig] = useState<JiraConfig | null>(null);
  const [jiraConfigModalOpen, setJiraConfigModalOpen] = useState(false);
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingSummary, setEditingSummary] = useState("");
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getJiraConfig().then((c) => setJiraConfig(c ?? null));
  }, []);

  useEffect(() => {
    fetchProjects().then(setProjectsList);
  }, [jiraConfigModalOpen]);

  const loadProjects = () => {
    fetchProjects().then(setProjectsList);
    refreshProjects();
  };

  const handleJiraConfigSaved = () => {
    getJiraConfig().then((c) => setJiraConfig(c ?? null));
  };

  const handleStartRename = (proj: Project) => {
    setEditingProjectId(proj.id);
    setEditingName(proj.name);
    setEditingSummary(proj.summary ?? "");
  };

  const handleSaveRename = async () => {
    if (!editingProjectId || !editingName.trim()) return;
    setSaving(true);
    try {
      await updateProject(editingProjectId, {
        name: editingName.trim(),
        summary: editingSummary.trim() || null,
      });
      setEditingProjectId(null);
      setEditingName("");
      setEditingSummary("");
      loadProjects();
    } finally {
      setSaving(false);
    }
  };

  const handleCancelRename = () => {
    setEditingProjectId(null);
    setEditingName("");
    setEditingSummary("");
  };

  const handleConfirmDelete = async () => {
    if (!deleteProjectId) return;
    setDeleting(true);
    try {
      await deleteProject(deleteProjectId);
      if (currentProjectId === deleteProjectId) {
        const remaining = projectsList.filter((p) => p.id !== deleteProjectId);
        setCurrentProjectId(remaining[0]?.id ?? null);
      }
      setDeleteProjectId(null);
      loadProjects();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border panel-bg">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/" className="rounded-lg">
              <ChevronLeft className="w-5 h-5" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Settings</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {/* Account */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4" />
              Account
            </CardTitle>
            <CardDescription>Your account and sign-in</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Email</Label>
              <p className="text-sm text-foreground font-medium">{user?.email ?? "—"}</p>
            </div>
            <Button
              variant="outline"
              onClick={() => signOut()}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </Button>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sun className="w-4 h-4" />
              Appearance
            </CardTitle>
            <CardDescription>
              Choose light mode, dark mode, or match your system preference.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={theme ?? "system"}
              onValueChange={(v) => setTheme(v)}
              className="flex gap-3"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="light" id="theme-light" />
                <Label htmlFor="theme-light" className="flex items-center gap-2 cursor-pointer font-normal">
                  <Sun className="h-4 w-4 text-muted-foreground" />
                  Light
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dark" id="theme-dark" />
                <Label htmlFor="theme-dark" className="flex items-center gap-2 cursor-pointer font-normal">
                  <Moon className="h-4 w-4 text-muted-foreground" />
                  Dark
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="system" id="theme-system" />
                <Label htmlFor="theme-system" className="flex items-center gap-2 cursor-pointer font-normal">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  System
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Integrations */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="w-4 h-4" />
              Integrations
            </CardTitle>
            <CardDescription>Connect Jira and configure AI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Jira */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Jira</p>
                  <p className="text-xs text-muted-foreground">
                    Create tickets from insights in the Chat panel
                  </p>
                  {jiraConfig?.configured && jiraConfig.domain && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Current: <span className="text-foreground">{jiraConfig.domain}</span>
                      {jiraConfig.email && (
                        <> · <span className="text-foreground">{jiraConfig.email}</span></>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {jiraConfig?.configured ? (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                      <CheckCircle className="w-4 h-4" />
                      Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <XCircle className="w-4 h-4" />
                      Not connected
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setJiraConfigModalOpen(true)}
                  >
                    {jiraConfig?.configured ? "Reconfigure" : "Configure"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Projects */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              Projects
            </CardTitle>
            <CardDescription>
              Rename or delete projects. Sources, chat, and insights are stored per project.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {projectsList.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects yet. Create one from the app header.</p>
            ) : (
              <ul className="space-y-2">
                {projectsList.map((proj) => (
                  <li
                    key={proj.id}
                    className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/20"
                  >
                    {editingProjectId === proj.id ? (
                      <div className="flex flex-col gap-2 w-full">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) handleSaveRename();
                            if (e.key === "Escape") handleCancelRename();
                          }}
                          className="w-full h-8"
                          placeholder="Project name"
                          autoFocus
                        />
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Project context (optional)</Label>
                          <Textarea
                            value={editingSummary}
                            onChange={(e) => setEditingSummary(e.target.value)}
                            placeholder="e.g. Q1 discovery – 5 user interviews, focus on onboarding"
                            rows={2}
                            className="resize-y text-sm"
                          />
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" onClick={handleSaveRename} disabled={saving}>
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={handleCancelRename}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-foreground truncate block">{proj.name}</span>
                          {proj.summary && (
                            <span className="text-xs text-muted-foreground truncate block">{proj.summary}</span>
                          )}
                        </div>
                        {currentProjectId === proj.id && (
                          <span className="text-xs text-muted-foreground shrink-0">Current</span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => handleStartRename(proj)}
                          title="Rename"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => setDeleteProjectId(proj.id)}
                          title="Delete project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* About */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="w-4 h-4" />
              About
            </CardTitle>
            <CardDescription>App and help</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-foreground font-medium">tofuOS</p>
            <p className="text-xs text-muted-foreground">
              AI-powered product management workspace. Use sources, chat, and Studio to generate PRDs, specs, and Jira tickets.
            </p>
            <a
              href="https://github.com/reginaldbaraza-code/TofuOS"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
            >
              View on GitHub
              <ExternalLink className="w-3 h-3" />
            </a>
          </CardContent>
        </Card>
      </div>

      <JiraConfigModal
        open={jiraConfigModalOpen}
        onOpenChange={setJiraConfigModalOpen}
        onSaved={handleJiraConfigSaved}
      />
      <Dialog open={!!deleteProjectId} onOpenChange={(open) => !open && setDeleteProjectId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete project</DialogTitle>
            <DialogDescription>
              This will permanently delete this project and all its sources, chat messages, and insights. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteProjectId(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
