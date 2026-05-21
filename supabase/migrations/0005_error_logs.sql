-- ---------------------------------------------------------------------------
-- Journal des erreurs rencontrées par les utilisateurs
-- Consultable uniquement par le Dr Delobaux (contrôlé côté serveur).
-- ---------------------------------------------------------------------------

create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid (),
  user_email text,
  message text not null,
  detail text,
  path text,
  created_at timestamptz not null default now()
);

create index if not exists error_logs_created_at_idx
  on public.error_logs (created_at desc);

-- RLS activée sans policy : aucun accès direct client.
-- Tous les accès passent par les routes serveur (clé service).
alter table public.error_logs enable row level security;
