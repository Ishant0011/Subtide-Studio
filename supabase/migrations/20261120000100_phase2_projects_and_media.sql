-- Phase 2: Projects, Media Assets, Row-Level Security, and Private Storage Bucket

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Projects table
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  status text not null default 'uploading' check (status in ('uploading', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_user_created
  on public.projects (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. Media assets table
-- ---------------------------------------------------------------------------
create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket_id text not null default 'media' check (bucket_id = 'media'),
  object_key text not null unique,
  original_filename text not null check (char_length(trim(original_filename)) between 1 and 255),
  mime_type text not null check (mime_type in ('video/mp4', 'video/quicktime')),
  expected_size_bytes bigint not null check (expected_size_bytes > 0 and expected_size_bytes <= 157286400),
  verified_size_bytes bigint check (verified_size_bytes is null or (verified_size_bytes > 0 and verified_size_bytes <= 157286400)),
  status text not null default 'pending' check (status in ('pending', 'uploaded', 'failed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_media_assets_project
  on public.media_assets (project_id);

create index if not exists idx_media_assets_user_created
  on public.media_assets (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Automatic updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists trg_media_assets_updated_at on public.media_assets;
create trigger trg_media_assets_updated_at
  before update on public.media_assets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Row-Level Security (RLS) on projects and media_assets
-- ---------------------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.projects force row level security;

alter table public.media_assets enable row level security;
alter table public.media_assets force row level security;

-- Projects policies
drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own"
  on public.projects
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own"
  on public.projects
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own"
  on public.projects
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own"
  on public.projects
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Media assets policies (also enforce project ownership)
drop policy if exists "media_assets_select_own" on public.media_assets;
create policy "media_assets_select_own"
  on public.media_assets
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "media_assets_insert_own" on public.media_assets;
create policy "media_assets_insert_own"
  on public.media_assets
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "media_assets_update_own" on public.media_assets;
create policy "media_assets_update_own"
  on public.media_assets
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "media_assets_delete_own" on public.media_assets;
create policy "media_assets_delete_own"
  on public.media_assets
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. Private Storage Bucket ('media') and strict owner-only Storage policies
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  false,
  157286400,
  array['video/mp4', 'video/quicktime']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Owner can read/download/HEAD only objects under their own <user_id>/ prefix
drop policy if exists "media_objects_select_own" on storage.objects;
create policy "media_objects_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can create objects ONLY for a server-assigned, pending media_asset key
drop policy if exists "media_objects_insert_pending_own" on storage.objects;
create policy "media_objects_insert_pending_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.media_assets ma
      where ma.object_key = name
        and ma.user_id = auth.uid()
        and ma.status = 'pending'
    )
  );

-- Owner can PATCH resumable TUS chunks ONLY while the asset is still pending (prevents overwrite after completion)
drop policy if exists "media_objects_update_pending_own" on storage.objects;
create policy "media_objects_update_pending_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.media_assets ma
      where ma.object_key = name
        and ma.user_id = auth.uid()
        and ma.status = 'pending'
    )
  )
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can delete their own objects
drop policy if exists "media_objects_delete_own" on storage.objects;
create policy "media_objects_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
