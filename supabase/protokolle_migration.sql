-- Migration: protokolle table
-- Run this in the Supabase SQL Editor

create table if not exists protokolle (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  hero_projektnummer text,
  adresse text,
  betrifft text,
  eintraege jsonb not null default '[]',
  protokoll_data jsonb,
  status text default 'entwurf' check (status in ('entwurf', 'abgeschlossen'))
);

alter table protokolle enable row level security;

drop policy if exists "protokolle_select" on protokolle;
drop policy if exists "protokolle_insert" on protokolle;
drop policy if exists "protokolle_update" on protokolle;
drop policy if exists "protokolle_delete" on protokolle;

-- All authenticated users can read all protocols
create policy "protokolle_select"
  on protokolle for select
  to authenticated
  using (true);

create policy "protokolle_insert"
  on protokolle for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "protokolle_update"
  on protokolle for update
  to authenticated
  using (auth.uid() = created_by);

create policy "protokolle_delete"
  on protokolle for delete
  to authenticated
  using (auth.uid() = created_by);
