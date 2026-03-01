-- PM features: project context, source metadata, insight status stored in existing jsonb
alter table public.projects add column if not exists summary text;
comment on column public.projects.summary is 'Optional project context/summary used to prime AI (e.g. "Q1 discovery – 5 user interviews").';

-- Ensure sources have created_at for "last added" display (no-op if already exists)
alter table public.sources add column if not exists created_at timestamptz default now();
