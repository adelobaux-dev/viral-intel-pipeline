-- ---------------------------------------------------------------------------
-- Patterns de communication appris automatiquement, PAR utilisateur.
-- Mis à jour à chaque conversation à partir de ce que la personne dit.
-- ---------------------------------------------------------------------------

create table if not exists public.user_comm_patterns (
  user_id uuid primary key references public.users (id) on delete cascade,
  patterns text not null,
  updated_at timestamptz not null default now()
);

alter table public.user_comm_patterns enable row level security;

drop policy if exists "commpat_select_self_or_admin" on public.user_comm_patterns;
create policy "commpat_select_self_or_admin" on public.user_comm_patterns
  for select using (user_id = auth.uid() or public.is_admin());
-- L'écriture se fait via la clé service (route serveur).
