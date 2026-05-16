-- ---------------------------------------------------------------------------
-- Ressources d'aide au closing (base de connaissances du cabinet)
-- Alimente les conseils IA en plus de la méthode C.A.R.E.S.
-- ---------------------------------------------------------------------------

create table if not exists public.closing_resources (
  id uuid primary key default gen_random_uuid (),
  title text not null,
  content text not null,
  kind text not null default 'text', -- 'text' | 'file' (fichiers : phase suivante)
  source_url text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists closing_resources_created_at_idx
  on public.closing_resources (created_at desc);

alter table public.closing_resources enable row level security;

-- Tous les utilisateurs authentifiés peuvent lire (l'IA s'en sert pendant l'appel)
drop policy if exists "resources_select_auth" on public.closing_resources;
create policy "resources_select_auth" on public.closing_resources
  for select using (auth.uid() is not null);

-- Seuls les admins (Dr Delobaux / Prescillia) peuvent ajouter / supprimer
drop policy if exists "resources_insert_admin" on public.closing_resources;
create policy "resources_insert_admin" on public.closing_resources
  for insert with check (public.is_admin());

drop policy if exists "resources_delete_admin" on public.closing_resources;
create policy "resources_delete_admin" on public.closing_resources
  for delete using (public.is_admin());
