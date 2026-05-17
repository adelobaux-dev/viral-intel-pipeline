-- ---------------------------------------------------------------------------
-- Profil de personnalité par utilisateur (test à la création de compte)
-- Sert à personnaliser le feedback et les conseils selon chaque personne.
-- ---------------------------------------------------------------------------

create table if not exists public.user_profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  answers jsonb not null,
  analysis text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

-- Chacun lit son profil ; les admins lisent tout (coaching).
drop policy if exists "profiles_select_self_or_admin" on public.user_profiles;
create policy "profiles_select_self_or_admin" on public.user_profiles
  for select using (user_id = auth.uid() or public.is_admin());
-- L'écriture passe par la route serveur (clé service).
