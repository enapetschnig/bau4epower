-- Migration: input_templates table
-- Run this in the Supabase SQL Editor

-- Option A: Create table fresh (if it doesn't exist yet)
create table if not exists input_templates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  name text not null,
  type text check (type in ('klein', 'gross')),
  template_data jsonb not null default '{}'
);

-- Option B: Migrate existing table (if it already exists with old column names)
-- Run these only if the table exists with the old schema:

-- alter table input_templates rename column user_id to created_by;
-- alter table input_templates rename column mode to type;
-- alter table input_templates rename column input_text to input_text_old;
-- alter table input_templates add column if not exists template_data jsonb;
-- update input_templates set template_data = jsonb_build_object('inputText', input_text_old) where template_data is null;
-- alter table input_templates drop column if exists input_text_old;

-- RLS: all authenticated users can read all templates
alter table input_templates enable row level security;

drop policy if exists "templates_select" on input_templates;
drop policy if exists "templates_insert" on input_templates;
drop policy if exists "templates_update" on input_templates;
drop policy if exists "templates_delete" on input_templates;

create policy "templates_select"
  on input_templates for select
  to authenticated
  using (true);

create policy "templates_insert"
  on input_templates for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "templates_update"
  on input_templates for update
  to authenticated
  using (auth.uid() = created_by);

create policy "templates_delete"
  on input_templates for delete
  to authenticated
  using (auth.uid() = created_by);
