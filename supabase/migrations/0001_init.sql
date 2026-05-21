-- ---------------------------------------------------------------------------
-- Cabinet Dr Alexis Delobaux - Schéma initial
-- Tables : users, calls, performance_tracking
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- Rôles applicatifs
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('admin', 'closer', 'ide', 'doctor');
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- users : profil applicatif lié à auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text not null,
  role user_role not null default 'closer',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- calls : un appel patient
-- ---------------------------------------------------------------------------
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.users (id) on delete cascade,
  patient_name text,
  start_time timestamptz not null default now(),
  end_time timestamptz,
  transcript text,
  score numeric(4, 2),
  ai_feedback jsonb,
  created_at timestamptz not null default now()
);

create index if not exists calls_user_id_idx on public.calls (user_id);
create index if not exists calls_created_at_idx on public.calls (created_at desc);

-- ---------------------------------------------------------------------------
-- performance_tracking : agrégats par utilisateur
-- ---------------------------------------------------------------------------
create table if not exists public.performance_tracking (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null unique references public.users (id) on delete cascade,
  total_calls integer not null default 0,
  average_score numeric(4, 2) not null default 0,
  conversion_rate numeric(5, 2) not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.calls enable row level security;
alter table public.performance_tracking enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  );
$$;

-- users : chacun voit/modifie son profil ; admin voit tout
drop policy if exists "users_select_self_or_admin" on public.users;
create policy "users_select_self_or_admin" on public.users
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "users_update_self" on public.users;
create policy "users_update_self" on public.users
  for update using (id = auth.uid());

-- calls : propriétaire ou admin
drop policy if exists "calls_select_owner_or_admin" on public.calls;
create policy "calls_select_owner_or_admin" on public.calls
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "calls_insert_owner" on public.calls;
create policy "calls_insert_owner" on public.calls
  for insert with check (user_id = auth.uid());

drop policy if exists "calls_update_owner" on public.calls;
create policy "calls_update_owner" on public.calls
  for update using (user_id = auth.uid() or public.is_admin());

-- performance_tracking : propriétaire ou admin
drop policy if exists "perf_select_owner_or_admin" on public.performance_tracking;
create policy "perf_select_owner_or_admin" on public.performance_tracking
  for select using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Création automatique du profil à l'inscription.
-- Dr Delobaux & Prescillia sont promus admin via leur email.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_role user_role := 'closer';
  lower_email text := lower(new.email);
begin
  if lower_email like '%delobaux%' or lower_email like 'prescillia%' then
    resolved_role := 'admin';
  end if;

  insert into public.users (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    resolved_role
  )
  on conflict (id) do nothing;

  insert into public.performance_tracking (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Recalcul des agrégats après finalisation d'un appel.
-- ---------------------------------------------------------------------------
create or replace function public.refresh_performance(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.performance_tracking (user_id, total_calls, average_score, conversion_rate, updated_at)
  select
    target_user,
    count(*),
    coalesce(avg(score), 0),
    coalesce(
      100.0 * count(*) filter (where score >= 6) / nullif(count(*), 0),
      0
    ),
    now()
  from public.calls
  where user_id = target_user and end_time is not null
  on conflict (user_id) do update
    set total_calls = excluded.total_calls,
        average_score = excluded.average_score,
        conversion_rate = excluded.conversion_rate,
        updated_at = now();
end;
$$;
