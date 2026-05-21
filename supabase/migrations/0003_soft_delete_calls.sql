-- ---------------------------------------------------------------------------
-- Corbeille : suppression douce des conversations (récupérables)
-- ---------------------------------------------------------------------------

alter table public.calls
  add column if not exists deleted_at timestamptz;

create index if not exists calls_deleted_at_idx
  on public.calls (deleted_at);
