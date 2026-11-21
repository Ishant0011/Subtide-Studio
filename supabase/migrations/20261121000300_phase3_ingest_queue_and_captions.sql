-- Phase 3: Durable Postgres ingest queue, media probing metadata,
-- MP3/WAV support, atomic first caption revision, and lease/attempt-token RPCs.

-- ---------------------------------------------------------------------------
-- 1. Extend storage bucket 'media' to accept MP3 & WAV alongside MP4 & MOV
-- ---------------------------------------------------------------------------
update storage.buckets
set allowed_mime_types = array[
  'video/mp4',
  'video/quicktime',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav'
]
where id = 'media';

-- ---------------------------------------------------------------------------
-- 2. Extend public.media_assets for audio inputs and probed media metadata
-- ---------------------------------------------------------------------------
alter table public.media_assets
  drop constraint if exists media_assets_mime_type_check;

alter table public.media_assets
  add constraint media_assets_mime_type_check
  check (mime_type in (
    'video/mp4',
    'video/quicktime',
    'audio/mpeg',
    'audio/wav',
    'audio/x-wav'
  ));

alter table public.media_assets
  add column if not exists media_kind text check (media_kind is null or media_kind in ('video', 'audio')),
  add column if not exists duration_ms integer check (duration_ms is null or (duration_ms > 0 and duration_ms <= 180000)),
  add column if not exists width integer check (width is null or width > 0),
  add column if not exists height integer check (height is null or height > 0),
  add column if not exists rotation_deg integer,
  add column if not exists has_audio boolean,
  add column if not exists audio_start_offset_ms integer,
  add column if not exists video_start_offset_ms integer;

-- ---------------------------------------------------------------------------
-- 3. Extend public.projects for processing stages, preview object, and active revision
-- ---------------------------------------------------------------------------
alter table public.projects
  drop constraint if exists projects_status_check;

alter table public.projects
  add constraint projects_status_check
  check (status in ('uploading', 'queued', 'processing', 'ready', 'failed'));

alter table public.projects
  add column if not exists media_kind text check (media_kind is null or media_kind in ('video', 'audio')),
  add column if not exists duration_ms integer check (duration_ms is null or (duration_ms > 0 and duration_ms <= 180000)),
  add column if not exists preview_object_key text,
  add column if not exists preview_mime_type text,
  add column if not exists preview_width integer,
  add column if not exists preview_height integer,
  add column if not exists active_revision_id uuid,
  add column if not exists last_error_code text,
  add column if not exists last_error_message text;

-- Update authenticated update guard to protect all new server-controlled columns
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
      or new.media_kind is distinct from old.media_kind
      or new.duration_ms is distinct from old.duration_ms
      or new.preview_object_key is distinct from old.preview_object_key
      or new.preview_mime_type is distinct from old.preview_mime_type
      or new.preview_width is distinct from old.preview_width
      or new.preview_height is distinct from old.preview_height
      or new.active_revision_id is distinct from old.active_revision_id
      or new.last_error_code is distinct from old.last_error_code
      or new.last_error_message is distinct from old.last_error_message
    then
      raise exception 'Only project title may be updated by authenticated users'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Durable Postgres ingest queue: public.ingest_jobs
-- ---------------------------------------------------------------------------
create table if not exists public.ingest_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  media_asset_id uuid not null unique references public.media_assets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'probing', 'transcoding', 'transcribing', 'completed', 'failed')),
  stage_message text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  attempt_token uuid,
  worker_id text,
  lease_expires_at timestamptz,
  next_run_at timestamptz not null default now(),
  error_code text check (error_code is null or error_code in (
    'corrupt_media',
    'missing_audio',
    'duration_limit_exceeded',
    'bounds_exceeded',
    'provider_failure',
    'storage_error',
    'internal_error'
  )),
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ingest_jobs_runnable
  on public.ingest_jobs (status, next_run_at);

create index if not exists idx_ingest_jobs_lease
  on public.ingest_jobs (lease_expires_at)
  where status in ('probing', 'transcoding', 'transcribing');

create index if not exists idx_ingest_jobs_user_project
  on public.ingest_jobs (user_id, project_id);

drop trigger if exists trg_ingest_jobs_updated_at on public.ingest_jobs;
create trigger trg_ingest_jobs_updated_at
  before update on public.ingest_jobs
  for each row execute function public.set_updated_at();

alter table public.ingest_jobs enable row level security;
alter table public.ingest_jobs force row level security;

drop policy if exists "ingest_jobs_select_own" on public.ingest_jobs;
create policy "ingest_jobs_select_own"
  on public.ingest_jobs
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on table public.ingest_jobs from anon, authenticated;
grant select on table public.ingest_jobs to authenticated;
grant select, insert, update, delete on table public.ingest_jobs to service_role;

-- ---------------------------------------------------------------------------
-- 5. Caption revisions table: public.caption_revisions
-- ---------------------------------------------------------------------------
create table if not exists public.caption_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  revision_number integer not null check (revision_number >= 1),
  source text not null check (source in ('deepgram_nova3', 'fixture', 'no_speech')),
  speech_status text not null default 'speech' check (speech_status in ('speech', 'no_speech')),
  language text,
  words jsonb not null default '[]'::jsonb,
  cues jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (project_id, revision_number)
);

create index if not exists idx_caption_revisions_user_project
  on public.caption_revisions (user_id, project_id, revision_number desc);

alter table public.caption_revisions enable row level security;
alter table public.caption_revisions force row level security;

drop policy if exists "caption_revisions_select_own" on public.caption_revisions;
create policy "caption_revisions_select_own"
  on public.caption_revisions
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on table public.caption_revisions from anon, authenticated;
grant select on table public.caption_revisions to authenticated;
grant select, insert, update, delete on table public.caption_revisions to service_role;

-- Link projects.active_revision_id -> caption_revisions(id)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_active_revision_id_fkey'
  ) then
    alter table public.projects
      add constraint projects_active_revision_id_fkey
      foreign key (active_revision_id)
      references public.caption_revisions(id)
      on delete set null;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Transactional RPCs (server/worker-only via service_role)
-- ---------------------------------------------------------------------------

-- 6a. Atomically finalize upload and enqueue one logical ingest job
create or replace function public.finalize_upload_and_enqueue_ingest(
  p_user_id uuid,
  p_project_id uuid,
  p_asset_id uuid,
  p_verified_size_bytes bigint,
  p_completed_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset public.media_assets%rowtype;
  v_project public.projects%rowtype;
  v_job public.ingest_jobs%rowtype;
  v_idempotent boolean := false;
begin
  select * into v_asset
  from public.media_assets
  where id = p_asset_id
    and project_id = p_project_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Media asset not found for owner' using errcode = 'P0002';
  end if;

  select * into v_project
  from public.projects
  where id = p_project_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Project not found for owner' using errcode = 'P0002';
  end if;

  if v_asset.status = 'uploaded' then
    v_idempotent := true;
  else
    update public.media_assets
    set
      status = 'uploaded',
      verified_size_bytes = p_verified_size_bytes,
      completed_at = p_completed_at
    where id = v_asset.id
    returning * into v_asset;

    update public.projects
    set
      status = 'queued',
      last_error_code = null,
      last_error_message = null
    where id = v_project.id
    returning * into v_project;
  end if;

  insert into public.ingest_jobs (project_id, media_asset_id, user_id, status, stage_message)
  values (v_project.id, v_asset.id, p_user_id, 'queued', 'Queued for media processing')
  on conflict (media_asset_id) do nothing;

  select * into v_job
  from public.ingest_jobs
  where media_asset_id = v_asset.id;

  return jsonb_build_object(
    'idempotent', v_idempotent,
    'project', jsonb_build_object(
      'id', v_project.id,
      'title', v_project.title,
      'status', v_project.status
    ),
    'asset', jsonb_build_object(
      'id', v_asset.id,
      'objectKey', v_asset.object_key,
      'status', v_asset.status,
      'verifiedSizeBytes', coalesce(v_asset.verified_size_bytes, v_asset.expected_size_bytes),
      'completedAt', v_asset.completed_at
    ),
    'job', jsonb_build_object(
      'id', v_job.id,
      'status', v_job.status,
      'stageMessage', v_job.stage_message,
      'attemptCount', v_job.attempt_count
    )
  );
end;
$$;

-- 6b. Owner-authorized enqueue for existing finalized Phase 2 uploads (or retry failed jobs)
create or replace function public.enqueue_existing_asset_ingest(
  p_user_id uuid,
  p_project_id uuid,
  p_asset_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset public.media_assets%rowtype;
  v_project public.projects%rowtype;
  v_job public.ingest_jobs%rowtype;
  v_idempotent boolean := false;
begin
  select * into v_asset
  from public.media_assets
  where id = p_asset_id
    and project_id = p_project_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Media asset not found for owner' using errcode = 'P0002';
  end if;

  if v_asset.status <> 'uploaded' then
    raise exception 'Media asset is not finalized yet' using errcode = '22023';
  end if;

  select * into v_project
  from public.projects
  where id = p_project_id
    and user_id = p_user_id
  for update;

  select * into v_job
  from public.ingest_jobs
  where media_asset_id = v_asset.id
  for update;

  if not found then
    insert into public.ingest_jobs (project_id, media_asset_id, user_id, status, stage_message)
    values (v_project.id, v_asset.id, p_user_id, 'queued', 'Queued for media processing')
    returning * into v_job;

    update public.projects
    set status = 'queued', last_error_code = null, last_error_message = null
    where id = v_project.id
    returning * into v_project;
  elsif v_job.status = 'failed' then
    update public.ingest_jobs
    set
      status = 'queued',
      stage_message = 'Re-queued by owner',
      attempt_count = 0,
      attempt_token = null,
      worker_id = null,
      lease_expires_at = null,
      next_run_at = now(),
      error_code = null,
      error_message = null,
      completed_at = null
    where id = v_job.id
    returning * into v_job;

    update public.projects
    set status = 'queued', last_error_code = null, last_error_message = null
    where id = v_project.id
    returning * into v_project;
  else
    v_idempotent := true;
  end if;

  return jsonb_build_object(
    'idempotent', v_idempotent,
    'project', jsonb_build_object('id', v_project.id, 'status', v_project.status),
    'job', jsonb_build_object(
      'id', v_job.id,
      'status', v_job.status,
      'stageMessage', v_job.stage_message,
      'attemptCount', v_job.attempt_count
    )
  );
end;
$$;

-- 6c. Claim next runnable or lease-expired ingest job with fresh attempt token
create or replace function public.claim_next_ingest_job(
  p_worker_id text,
  p_lease_seconds integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.ingest_jobs%rowtype;
  v_asset public.media_assets%rowtype;
  v_token uuid;
begin
  loop
    select * into v_job
    from public.ingest_jobs
    where
      (status = 'queued' and next_run_at <= now())
      or (status in ('probing', 'transcoding', 'transcribing') and lease_expires_at < now())
    order by next_run_at asc, created_at asc
    limit 1
    for update skip locked;

    if not found then
      return null;
    end if;

    -- Bounded retries: if expired-lease job already hit max_attempts, fail it cleanly
    if v_job.attempt_count >= v_job.max_attempts then
      update public.ingest_jobs
      set
        status = 'failed',
        attempt_token = null,
        lease_expires_at = null,
        error_code = coalesce(error_code, 'internal_error'),
        error_message = coalesce(error_message, 'Max processing attempts exceeded after worker interruption.'),
        stage_message = 'Processing failed after max retries',
        completed_at = now()
      where id = v_job.id;

      update public.projects
      set
        status = 'failed',
        last_error_code = coalesce(v_job.error_code, 'internal_error'),
        last_error_message = coalesce(v_job.error_message, 'Max processing attempts exceeded after worker interruption.')
      where id = v_job.project_id;

      continue;
    end if;

    v_token := gen_random_uuid();

    update public.ingest_jobs
    set
      status = 'probing',
      stage_message = 'Probing uploaded media',
      attempt_count = v_job.attempt_count + 1,
      attempt_token = v_token,
      worker_id = p_worker_id,
      lease_expires_at = now() + make_interval(secs => greatest(10, p_lease_seconds)),
      started_at = coalesce(v_job.started_at, now()),
      error_code = null,
      error_message = null
    where id = v_job.id
    returning * into v_job;

    update public.projects
    set status = 'processing', last_error_code = null, last_error_message = null
    where id = v_job.project_id;

    select * into v_asset
    from public.media_assets
    where id = v_job.media_asset_id;

    return jsonb_build_object(
      'jobId', v_job.id,
      'projectId', v_job.project_id,
      'mediaAssetId', v_job.media_asset_id,
      'userId', v_job.user_id,
      'attemptCount', v_job.attempt_count,
      'maxAttempts', v_job.max_attempts,
      'attemptToken', v_job.attempt_token,
      'bucketId', v_asset.bucket_id,
      'objectKey', v_asset.object_key,
      'originalFilename', v_asset.original_filename,
      'mimeType', v_asset.mime_type,
      'verifiedSizeBytes', coalesce(v_asset.verified_size_bytes, v_asset.expected_size_bytes)
    );
  end loop;
end;
$$;

-- 6d. Renew lease & advance stage ONLY if attempt_token still matches
create or replace function public.heartbeat_ingest_job(
  p_job_id uuid,
  p_attempt_token uuid,
  p_status text,
  p_stage_message text default null,
  p_lease_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if p_status not in ('probing', 'transcoding', 'transcribing') then
    raise exception 'Invalid active job stage: %', p_status using errcode = '22023';
  end if;

  update public.ingest_jobs
  set
    status = p_status,
    stage_message = coalesce(p_stage_message, stage_message),
    lease_expires_at = now() + make_interval(secs => greatest(10, p_lease_seconds))
  where id = p_job_id
    and attempt_token = p_attempt_token
    and status in ('probing', 'transcoding', 'transcribing');

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

-- 6e. Atomically publish probed metadata, preview key, and first caption revision
--     Rejects stale attempt tokens cleanly so superseded workers can never publish.
create or replace function public.publish_ingest_result(
  p_job_id uuid,
  p_attempt_token uuid,
  p_media_kind text,
  p_duration_ms integer,
  p_width integer,
  p_height integer,
  p_rotation_deg integer,
  p_has_audio boolean,
  p_audio_start_offset_ms integer,
  p_video_start_offset_ms integer,
  p_preview_object_key text,
  p_preview_mime_type text,
  p_preview_width integer,
  p_preview_height integer,
  p_revision_source text,
  p_speech_status text,
  p_language text,
  p_words jsonb,
  p_cues jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.ingest_jobs%rowtype;
  v_rev_id uuid;
begin
  select * into v_job
  from public.ingest_jobs
  where id = p_job_id
  for update;

  if not found
    or v_job.attempt_token is distinct from p_attempt_token
    or v_job.status in ('completed', 'failed')
  then
    return jsonb_build_object('ok', false, 'reason', 'stale_attempt');
  end if;

  -- Insert revision #1 atomically; unique(project_id, revision_number) ensures only one first revision
  insert into public.caption_revisions (
    project_id,
    user_id,
    revision_number,
    source,
    speech_status,
    language,
    words,
    cues
  )
  values (
    v_job.project_id,
    v_job.user_id,
    1,
    p_revision_source,
    p_speech_status,
    p_language,
    coalesce(p_words, '[]'::jsonb),
    coalesce(p_cues, '[]'::jsonb)
  )
  on conflict (project_id, revision_number) do nothing;

  select id into v_rev_id
  from public.caption_revisions
  where project_id = v_job.project_id
    and revision_number = 1;

  update public.media_assets
  set
    media_kind = p_media_kind,
    duration_ms = p_duration_ms,
    width = p_width,
    height = p_height,
    rotation_deg = p_rotation_deg,
    has_audio = p_has_audio,
    audio_start_offset_ms = p_audio_start_offset_ms,
    video_start_offset_ms = p_video_start_offset_ms
  where id = v_job.media_asset_id;

  update public.projects
  set
    status = 'ready',
    media_kind = p_media_kind,
    duration_ms = p_duration_ms,
    preview_object_key = p_preview_object_key,
    preview_mime_type = p_preview_mime_type,
    preview_width = p_preview_width,
    preview_height = p_preview_height,
    active_revision_id = v_rev_id,
    last_error_code = null,
    last_error_message = null
  where id = v_job.project_id;

  update public.ingest_jobs
  set
    status = 'completed',
    stage_message = case
      when p_speech_status = 'no_speech' then 'Ready (no speech detected)'
      else 'Ready'
    end,
    lease_expires_at = null,
    completed_at = now(),
    error_code = null,
    error_message = null
  where id = v_job.id;

  return jsonb_build_object(
    'ok', true,
    'revisionId', v_rev_id,
    'projectId', v_job.project_id
  );
end;
$$;

-- 6f. Fail or requeue ingest job with bounded retries and attempt-token guard
create or replace function public.fail_ingest_job(
  p_job_id uuid,
  p_attempt_token uuid,
  p_error_code text,
  p_error_message text,
  p_retryable boolean default false,
  p_backoff_seconds integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.ingest_jobs%rowtype;
begin
  select * into v_job
  from public.ingest_jobs
  where id = p_job_id
  for update;

  if not found
    or v_job.attempt_token is distinct from p_attempt_token
    or v_job.status in ('completed', 'failed')
  then
    return jsonb_build_object('ok', false, 'reason', 'stale_attempt');
  end if;

  if p_retryable and v_job.attempt_count < v_job.max_attempts then
    update public.ingest_jobs
    set
      status = 'queued',
      stage_message = format('Retry scheduled (attempt %s of %s)', v_job.attempt_count + 1, v_job.max_attempts),
      attempt_token = null,
      worker_id = null,
      lease_expires_at = null,
      next_run_at = now() + make_interval(secs => greatest(1, p_backoff_seconds)),
      error_code = p_error_code,
      error_message = p_error_message
    where id = v_job.id;

    update public.projects
    set
      status = 'queued',
      last_error_code = p_error_code,
      last_error_message = p_error_message
    where id = v_job.project_id;

    return jsonb_build_object('ok', true, 'finalStatus', 'queued');
  else
    update public.ingest_jobs
    set
      status = 'failed',
      stage_message = 'Processing failed',
      attempt_token = null,
      lease_expires_at = null,
      error_code = p_error_code,
      error_message = p_error_message,
      completed_at = now()
    where id = v_job.id;

    update public.projects
    set
      status = 'failed',
      last_error_code = p_error_code,
      last_error_message = p_error_message
    where id = v_job.project_id;

    return jsonb_build_object('ok', true, 'finalStatus', 'failed');
  end if;
end;
$$;

-- Restrict RPC execution strictly to service_role
revoke all on function public.finalize_upload_and_enqueue_ingest(uuid, uuid, uuid, bigint, timestamptz) from public, anon, authenticated;
grant execute on function public.finalize_upload_and_enqueue_ingest(uuid, uuid, uuid, bigint, timestamptz) to service_role;

revoke all on function public.enqueue_existing_asset_ingest(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.enqueue_existing_asset_ingest(uuid, uuid, uuid) to service_role;

revoke all on function public.claim_next_ingest_job(text, integer) from public, anon, authenticated;
grant execute on function public.claim_next_ingest_job(text, integer) to service_role;

revoke all on function public.heartbeat_ingest_job(uuid, uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.heartbeat_ingest_job(uuid, uuid, text, text, integer) to service_role;

revoke all on function public.publish_ingest_result(uuid, uuid, text, integer, integer, integer, integer, boolean, integer, integer, text, text, integer, integer, text, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.publish_ingest_result(uuid, uuid, text, integer, integer, integer, integer, boolean, integer, integer, text, text, integer, integer, text, text, text, jsonb, jsonb) to service_role;

revoke all on function public.fail_ingest_job(uuid, uuid, text, text, boolean, integer) from public, anon, authenticated;
grant execute on function public.fail_ingest_job(uuid, uuid, text, text, boolean, integer) to service_role;
