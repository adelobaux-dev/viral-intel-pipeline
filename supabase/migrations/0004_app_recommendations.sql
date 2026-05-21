-- ---------------------------------------------------------------------------
-- Recommandations d'évolution de l'application générées par l'IA
-- (régénérées ~toutes les 48 h à partir des données de conversations)
-- ---------------------------------------------------------------------------

create table if not exists public.app_recommendations (
  id uuid primary key default gen_random_uuid (),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists app_recommendations_created_at_idx
  on public.app_recommendations (created_at desc);

alter table public.app_recommendations enable row level security;

-- Lecture réservée aux admins (Dr Delobaux / Prescillia)
drop policy if exists "apprec_select_admin" on public.app_recommendations;
create policy "apprec_select_admin" on public.app_recommendations
  for select using (public.is_admin());
-- L'écriture se fait via la clé service (côté serveur) qui contourne la RLS.
