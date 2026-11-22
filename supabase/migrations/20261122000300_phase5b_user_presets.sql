-- Phase 5B: Personal saved caption presets with strict owner-only RLS.
-- Applied styles are still copied by value into immutable caption_revisions
-- so later preset renames, edits, or deletions never alter earlier exports.

create table if not exists public.caption_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  style jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists caption_presets_user_id_updated_at_idx
  on public.caption_presets (user_id, updated_at desc);

alter table public.caption_presets enable row level security;

drop policy if exists "caption_presets_select_own" on public.caption_presets;
create policy "caption_presets_select_own"
  on public.caption_presets
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "caption_presets_insert_own" on public.caption_presets;
create policy "caption_presets_insert_own"
  on public.caption_presets
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "caption_presets_update_own" on public.caption_presets;
create policy "caption_presets_update_own"
  on public.caption_presets
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "caption_presets_delete_own" on public.caption_presets;
create policy "caption_presets_delete_own"
  on public.caption_presets
  for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.touch_caption_presets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_caption_presets_updated_at on public.caption_presets;
create trigger trg_caption_presets_updated_at
  before update on public.caption_presets
  for each row
  execute function public.touch_caption_presets_updated_at();

grant select, insert, update, delete on public.caption_presets to authenticated;
grant all on public.caption_presets to service_role;
