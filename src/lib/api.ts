/**
 * API client for tofuOS - Supabase and OpenAI implementation.
 */
import { supabase } from './supabase/client';

// --- Projects ---
export interface Project {
  id: string;
  user_id: string;
  name: string;
  summary?: string | null;
  created_at?: string;
  updated_at?: string;
}

export async function fetchProjects(): Promise<Project[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
  return (data ?? []) as Project[];
}

export async function createProject(name: string = 'Untitled Project'): Promise<Project> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from('projects')
    .insert({ user_id: user.id, name })
    .select()
    .single();

  if (error) throw error;
  return data as Project;
}

export async function updateProject(id: string, updates: { name?: string; summary?: string | null }): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update({
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.summary !== undefined && { summary: updates.summary }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Project;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export interface Source {
  id: string;
  name: string;
  type: "pdf" | "link" | "transcript" | "reviews" | "document";
  selected: boolean;
  project_id?: string;
  created_at?: string;
  meta?: { store?: "play" | "apple"; url?: string; fileId?: string };
  user_id?: string;
}

export async function fetchSources(projectId: string | null): Promise<Source[]> {
  if (!projectId) return [];

  const q = supabase
    .from('sources')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  const { data, error } = await q;

  if (error) {
    console.error('Error fetching sources:', error);
    return [];
  }
  return (data ?? []) as Source[];
}

// --- Analyze (AI PM insights) ---
export type InsightStatus = "not_started" | "in_progress" | "done";

export interface InsightItem {
  summary: string;
  description: string;
  status?: InsightStatus;
}

export async function updateSources(sources: Source[]): Promise<Source[]> {
  // In a real DB, we might want to update individually, but for a mock-to-real migration,
  // we'll handle the 'selected' status updates.
  for (const source of sources) {
    await supabase
      .from('sources')
      .update({ selected: source.selected })
      .eq('id', source.id);
  }
  return sources;
}

export async function addReviewsSource(
  projectId: string,
  store: "play" | "apple",
  appPageUrl: string
): Promise<Source> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const newSource = {
    name: `${store === "play" ? "Play Store" : "App Store"} Reviews`,
    type: "reviews",
    selected: true,
    project_id: projectId,
    meta: { store, url: appPageUrl },
    user_id: user.id
  };

  const { data, error } = await supabase
    .from('sources')
    .insert(newSource)
    .select()
    .single();

  if (error) throw error;
  return data as Source;
}

export async function addDocumentSources(
  projectId: string,
  files: File[]
): Promise<Source[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const newSources = files.map((file) => ({
    name: file.name,
    type: file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "document",
    selected: true,
    project_id: projectId,
    user_id: user.id
  }));

  const { data, error } = await supabase
    .from('sources')
    .insert(newSources)
    .select();

  if (error) throw error;
  return data as Source[];
}

// --- Project insights (stored per project) ---
export async function getProjectInsights(projectId: string | null): Promise<InsightItem[]> {
  if (!projectId) return [];

  const { data, error } = await supabase
    .from('project_insights')
    .select('insights')
    .eq('project_id', projectId)
    .single();

  if (error || !data?.insights) return [];
  const raw = Array.isArray(data.insights) ? data.insights : [];
  return raw.map((item: { summary?: string; description?: string; status?: InsightStatus }) => ({
    summary: item.summary ?? "",
    description: item.description ?? "",
    status: (item.status as InsightStatus) ?? "not_started",
  }));
}

export async function saveProjectInsights(projectId: string, insights: InsightItem[]): Promise<void> {
  const normalized = insights.map((i) => ({
    summary: i.summary,
    description: i.description,
    status: i.status ?? "not_started",
  }));
  const { error } = await supabase
    .from('project_insights')
    .upsert({ project_id: projectId, insights: normalized, updated_at: new Date().toISOString() }, { onConflict: 'project_id' });

  if (error) throw error;
}

// --- Chat messages (stored per project) ---
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

export async function getChatMessages(projectId: string | null): Promise<ChatMessage[]> {
  if (!projectId) return [];

  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, role, content, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) return [];
  return (data ?? []) as ChatMessage[];
}

export async function appendChatMessage(
  projectId: string,
  role: "user" | "assistant",
  content: string
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ project_id: projectId, role, content })
    .select()
    .single();

  if (error) throw error;
  return data as ChatMessage;
}

// --- Analyze (AI PM insights) ---
export async function analyzeSources(sourceIds: string[]): Promise<{ insights: InsightItem[]; suggestedPrompts?: string[] }> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceIds }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Analysis failed');
  }

  return response.json();
}

// --- Conversational Chat with AI ---
export async function chatWithAI(
  message: string,
  sourceIds: string[],
  history: { role: "user" | "assistant"; content: string }[],
  projectContext?: string | null
): Promise<{ content: string }> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sourceIds, history, projectContext: projectContext ?? undefined }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Chat failed');
  }

  return response.json();
}

// --- Search within a project (sources + chat + insights) ---
export async function searchProject(
  projectId: string | null,
  query: string
): Promise<{ sources: Source[]; messages: ChatMessage[]; insights: InsightItem[] }> {
  if (!projectId || !query.trim()) {
    return { sources: [], messages: [], insights: [] };
  }
  const q = query.trim().toLowerCase();
  const [sources, messages, insights] = await Promise.all([
    fetchSources(projectId),
    getChatMessages(projectId),
    getProjectInsights(projectId),
  ]);
  return {
    sources: sources.filter((s) => s.name.toLowerCase().includes(q)),
    messages: messages.filter((m) => m.content.toLowerCase().includes(q)),
    insights: insights.filter((i) => i.summary.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)),
  };
}

// --- Studio (document generation) ---
export async function generateStudioDocument(
  documentType: string,
  sourceIds: string[]
): Promise<{ content: string }> {
  const response = await fetch('/api/studio/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentType, sourceIds }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Document generation failed');
  }

  return response.json();
}

// --- Jira ---
export interface JiraConfig {
  configured: boolean;
  domain?: string;
  email?: string;
  hasToken?: boolean;
  lastProjectKey?: string;
}

export async function getJiraConfig(): Promise<JiraConfig | null> {
  const { data, error } = await supabase
    .from('jira_configs')
    .select('*')
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 is 'no rows found'
    console.error('Error fetching Jira config:', error);
    return { configured: false };
  }

  if (!data) return { configured: false };

  return {
    ...data,
    configured: true,
    hasToken: !!data.api_token,
    lastProjectKey: data.last_project_key
  };
}

export async function saveJiraConfig(domain: string, email: string, apiToken: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from('jira_configs')
    .upsert({ 
      domain, 
      email, 
      api_token: apiToken,
      user_id: user.id 
    }, {
      onConflict: 'user_id'
    });

  if (error) throw error;
}

export async function createJiraIssue(params: {
  summary: string;
  description?: string;
  projectKey?: string;
  issueType?: string;
  projectId?: string;
}): Promise<{ key: string; id: string; url: string }> {
  // Pass the access token to the server route
  const { data: { session } } = await supabase.auth.getSession();
  
  const response = await fetch('/api/jira/create-issue', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create Jira issue');
  }

  return response.json();
}

// --- Exported Jira tickets (per project, for Analysis list) ---
export interface ExportedJiraTicket {
  id: string;
  project_id: string;
  summary: string;
  jira_key: string;
  jira_url: string;
  created_at?: string;
}

export async function getExportedJiraTickets(projectId: string | null): Promise<ExportedJiraTicket[]> {
  if (!projectId) return [];

  const { data, error } = await supabase
    .from('project_jira_exports')
    .select('id, project_id, summary, jira_key, jira_url, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching exported Jira tickets:', error);
    return [];
  }
  return (data ?? []) as ExportedJiraTicket[];
}

export async function saveExportedJiraTicket(
  projectId: string,
  payload: { summary: string; jira_key: string; jira_url: string }
): Promise<ExportedJiraTicket> {
  const { data, error } = await supabase
    .from('project_jira_exports')
    .insert({
      project_id: projectId,
      summary: payload.summary,
      jira_key: payload.jira_key,
      jira_url: payload.jira_url,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ExportedJiraTicket;
}

export async function deleteExportedJiraTicket(id: string): Promise<void> {
  const { error } = await supabase
    .from('project_jira_exports')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
