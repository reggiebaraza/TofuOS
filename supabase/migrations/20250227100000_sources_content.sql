-- Store extracted text from documents so the AI can read source content
alter table public.sources add column if not exists content text;
comment on column public.sources.content is 'Extracted or pasted text from the source (PDF, document, transcript, reviews). Used by AI for analysis and chat.';
