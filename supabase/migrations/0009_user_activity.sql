-- ---------------------------------------------------------------------------
-- Journal d'activité : "battements" envoyés tant que l'app est ouverte.
-- Permet de reconstituer connexions, sessions et temps d'utilisation.
-- Lecture réservée au Dr Delobaux (via route serveur / clé service).
-- ---------------------------------------------------------------------------

create table if not exists public.user_activity (
  id bigint generated always as identity primary key,
  user_id uuid references public.users (id) on delete cascade,
  ts timestamptz not null default now()
);

create index if not exists user_activity_user_ts_idx
  on public.user_activity (user_id, ts desc);

alter table public.user_activity enable row level security;
-- Aucune policy : accès uniquement via les routes serveur (clé service).
