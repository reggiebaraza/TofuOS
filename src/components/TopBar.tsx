import Link from "next/link";
import { Plus, BarChart3, Share2, Settings, ChevronDown, LogOut, FolderOpen, Pencil, Trash2, Bot } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import { updateProject, deleteProject, type Project } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const TopBar = () => {
  const { user, signOut } = useAuth();
  const {
    currentProject,
    projects,
    setCurrentProjectId,
    createProjectAndSwitch,
    refreshProjects,
    isLoading: projectLoading,
  } = useProject();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [renameProject, setRenameProject] = useState<Project | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleNewProject = async () => {
    setDropdownOpen(false);
    setCreating(true);
    try {
      const newProject = await createProjectAndSwitch("Untitled Project");
      await refreshProjects();
      setRenameProject(newProject);
      setRenameValue("");
    } finally {
      setCreating(false);
    }
  };

  const handleSelectProject = (id: string) => {
    setCurrentProjectId(id);
    setDropdownOpen(false);
  };

  const openRename = (proj: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setDropdownOpen(false);
    setRenameProject(proj);
    setRenameValue(proj.name);
  };

  const handleSaveRename = async () => {
    if (!renameProject || !renameValue.trim()) return;
    setSaving(true);
    try {
      await updateProject(renameProject.id, { name: renameValue.trim() });
      setRenameProject(null);
      setRenameValue("");
      await refreshProjects();
    } finally {
      setSaving(false);
    }
  };

  const openDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDropdownOpen(false);
    setDeleteProjectId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteProjectId) return;
    setDeleting(true);
    try {
      await deleteProject(deleteProjectId);
      if (currentProject?.id === deleteProjectId) {
        const remaining = projects.filter((p) => p.id !== deleteProjectId);
        setCurrentProjectId(remaining[0]?.id ?? null);
      }
      setDeleteProjectId(null);
      await refreshProjects();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-3 md:px-4 panel-bg relative z-50">
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
          <div className="w-8 h-8 rounded-lg tofu-gradient flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground text-sm tracking-tight hidden sm:inline">tofuOS</span>
        </Link>

        <div className="w-px h-6 bg-border mx-1 hidden sm:block" />

        {/* Project switcher */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 text-sm text-foreground hover:bg-muted rounded-lg transition-colors truncate min-w-0"
          >
            <FolderOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="font-medium truncate max-w-[140px] md:max-w-[200px]">
              {projectLoading ? "Loading…" : currentProject?.name ?? "No project"}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0" onClick={() => setDropdownOpen(false)} aria-hidden />
              <div className="absolute top-full left-0 mt-1 w-72 panel-bg border border-border rounded-xl shadow-lg py-1 max-h-80 overflow-y-auto z-50">
                {projects.map((proj) => (
                  <div
                    key={proj.id}
                    className={`flex items-center gap-1 group px-2 py-1 ${
                      currentProject?.id === proj.id ? "bg-muted/50" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectProject(proj.id)}
                      className={`flex-1 min-w-0 text-left px-2 py-2 text-sm hover:bg-muted rounded-md transition-colors flex items-center gap-2 ${
                        currentProject?.id === proj.id ? "text-foreground font-medium" : "text-muted-foreground"
                      }`}
                    >
                      {currentProject?.id === proj.id ? (
                        <svg className="w-4 h-4 text-primary flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : (
                        <span className="w-4" />
                      )}
                      <span className="truncate">{proj.name}</span>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => openRename(proj, e)}
                      title="Rename"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => openDelete(proj.id, e)}
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                <div className="border-t border-border mt-1 pt-1">
                  <button
                    type="button"
                    onClick={handleNewProject}
                    disabled={creating}
                    className="w-full text-left px-4 py-2.5 text-sm text-primary font-medium hover:bg-muted transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    New project
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Rename project dialog */}
      <Dialog open={!!renameProject} onOpenChange={(open) => !open && setRenameProject(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{renameProject?.name === "Untitled Project" ? "Name your project" : "Rename project"}</DialogTitle>
            <DialogDescription>
              {renameProject?.name === "Untitled Project"
                ? "Give your new project a name so you can find it easily."
                : "Enter a new name for this project."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveRename();
                if (e.key === "Escape") setRenameProject(null);
              }}
              placeholder={renameProject?.name === "Untitled Project" ? "e.g. Q1 Roadmap" : "Project name"}
              className="w-full"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameProject(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveRename} disabled={saving || !renameValue.trim()}>
              {saving ? "Saving…" : renameProject?.name === "Untitled Project" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete project confirmation */}
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

      <div className="flex items-center gap-1 flex-shrink-0">
        <Link
          href="/analytics"
          className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted rounded-lg transition-colors"
        >
          <BarChart3 className="w-4 h-4" />
          Analytics
        </Link>
        <button
          type="button"
          onClick={() => toast.info("Share coming soon")}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted rounded-lg transition-colors"
          title="Share (coming soon)"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>
        <Link
          href="/settings"
          className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted rounded-lg transition-colors"
        >
          <Settings className="w-4 h-4" />
          Settings
        </Link>
        <ThemeSwitcher />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 flex-shrink-0"
              aria-label="Account menu"
            >
              <div className="w-8 h-8 rounded-full tofu-gradient flex items-center justify-center text-primary-foreground text-xs font-medium">
                {user?.user_metadata?.display_name?.charAt(0) ?? user?.email?.charAt(0) ?? "?"}
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-xs text-muted-foreground truncate" title={user?.email ?? undefined}>
                {user?.email ?? "Signed in"}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
                <Settings className="w-4 h-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/analytics" className="flex items-center gap-2 cursor-pointer">
                <BarChart3 className="w-4 h-4" />
                Analytics
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut()}
              className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default TopBar;
