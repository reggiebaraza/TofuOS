-- Store Jira tickets exported from insights per project (for "Exported to Jira" list)
create table if not exists public.project_jira_exports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  summary text not null,
  jira_key text not null,
  jira_url text not null,
  created_at timestamptz default now()
);

create index if not exists idx_project_jira_exports_project_id on public.project_jira_exports(project_id);

alter table public.project_jira_exports enable row level security;

drop policy if exists "Users can manage project_jira_exports for own projects" on public.project_jira_exports;
create policy "Users can manage project_jira_exports for own projects" on public.project_jira_exports for all
  using (exists (select 1 from public.projects p where p.id = project_jira_exports.project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.projects p where p.id = project_jira_exports.project_id and p.user_id = auth.uid()));
