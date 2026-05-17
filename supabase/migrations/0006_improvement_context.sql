-- ---------------------------------------------------------------------------
-- Contexte libre fourni par les utilisateurs (en fin de conversation)
-- pour aider l'app à s'améliorer. Le contexte diffère selon l'utilisateur.
-- Accès via routes serveur uniquement (clé service).
-- ---------------------------------------------------------------------------

create table if not exists public.improvement_context (
  id uuid primary key default gen_random_uuid (),
  user_id uuid references public.users (id) on delete set null,
  user_email text,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists improvement_context_created_at_idx
  on public.improvement_context (created_at desc);

alter table public.improvement_context enable row level security;
