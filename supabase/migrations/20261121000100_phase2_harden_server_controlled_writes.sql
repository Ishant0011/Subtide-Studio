-- Phase 2 hardening: make media allocation, object keys, verification fields,
-- and processing status strictly server-controlled while preserving owner-scoped
-- reads, project renaming (title only), and TUS writes for valid pending allocations.

-- ---------------------------------------------------------------------------
-- 1. Lock down direct authenticated writes on public.media_assets
-- ---------------------------------------------------------------------------
drop policy if exists "media_assets_insert_own" on public.media_assets;
drop policy if exists "media_assets_update_own" on public.media_assets;
drop policy if exists "media_assets_delete_own" on public.media_assets;

revoke insert, update, delete on table public.media_assets from anon, authenticated;
grant select on table public.media_assets to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Lock down public.projects allocation and status; allow owner title rename only
-- ---------------------------------------------------------------------------
drop policy if exists "projects_insert_own" on public.projects;
drop policy if exists "projects_delete_own" on public.projects;

revoke insert, update, delete on table public.projects from anon, authenticated;
grant select on table public.projects to authenticated;
grant update (title) on table public.projects to authenticated;

-- Defense-in-depth trigger ensuring authenticated role cannot mutate server-controlled columns
create or replace function public.guard_projects_authenticated_update()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'authenticated' then
    if new.id is distinct from old.id
      or new.user_id is distinct from old.user_id
      or new.status is distinct from old.status
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Only project title may be updated by authenticated users'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_projects_guard_authenticated_update on public.projects;
create trigger trg_projects_guard_authenticated_update
  before update on public.projects
  for each row execute function public.guard_projects_authenticated_update();

-- ---------------------------------------------------------------------------
-- 3. Tighten storage.objects UPDATE policy so TUS writes stay bound to valid pending keys
-- ---------------------------------------------------------------------------
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
    and exists (
      select 1
      from public.media_assets ma
      where ma.object_key = name
        and ma.user_id = auth.uid()
        and ma.status = 'pending'
    )
  );
