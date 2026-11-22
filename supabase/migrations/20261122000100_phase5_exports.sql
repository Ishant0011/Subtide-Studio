-- Phase 5: Subtitle (SRT), Burned-in MP4, and Transparent ProRes 4444 MOV exports
-- Bound immutably to saved caption revisions with durable worker queue, deduplication,
-- lease/attempt-token guards, and strict owner-only RLS.

-- ---------------------------------------------------------------------------
-- 1. Extend private 'media' bucket to allow SRT subtitle files and bounded ProRes renders
--    (Client upload cap remains strictly 150 MiB in /api/uploads/init and media_assets check)
-- ---------------------------------------------------------------------------
update storage.buckets
set
  file_size_limit = 524288000,
  allowed_mime_types = array[
    'video/mp4',
    'video/quicktime',
    'audio/mpeg',
    'audio/wav',
    'audio/x-wav',
    'text/plain',
    'application/x-subrip'
  ]
where id = 'media';

-- ---------------------------------------------------------------------------
-- 2. Durable export jobs table: public.export_jobs
-- ---------------------------------------------------------------------------
create table if not exists public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  revision_id uuid not null references public.caption_revisions(id) on delete cascade,
  revision_number integer not null check (revision_number >= 1),
  user_id uuid not null references auth.users(id) on delete cascade,
  format text not null check (format in ('srt', 'mp4', 'mov_alpha')),
  status text not null default 'queued'
    check (status in ('queued', 'rendering', 'ready', 'failed')),
  stage_message text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  attempt_token uuid,
  worker_id text,
  lease_expires_at timestamptz,
  next_run_at timestamptz not null default now(),
  bucket_id text not null default 'media' check (bucket_id = 'media'),
  output_object_key text,
  output_mime_type text,
  output_filename text,
  output_size_bytes bigint check (output_size_bytes is null or output_size_bytes > 0),
  output_width integer check (output_width is null or output_width > 0),
  output_height integer check (output_height is null or output_height > 0),
  output_duration_ms integer check (output_duration_ms is null or output_duration_ms > 0),
  error_code text check (error_code is null or error_code in (
    'corrupt_media',
    'bounds_exceeded',
    'render_failed',
    'storage_error',
    'internal_error'
  )),
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, revision_id, format)
);

create index if not exists idx_export_jobs_runnable
  on public.export_jobs (status, next_run_at)
  where format in ('mp4', 'mov_alpha');

create index if not exists idx_export_jobs_lease
  on public.export_jobs (lease_expires_at)
  where status = 'rendering';

create index if not exists idx_export_jobs_user_project
  on public.export_jobs (user_id, project_id, created_at desc);

drop trigger if exists trg_export_jobs_updated_at on public.export_jobs;
create trigger trg_export_jobs_updated_at
  before update on public.export_jobs
  for each row execute function public.set_updated_at();

alter table public.export_jobs enable row level security;
alter table public.export_jobs force row level security;

drop policy if exists "export_jobs_select_own" on public.export_jobs;
create policy "export_jobs_select_own"
  on public.export_jobs
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on table public.export_jobs from anon, authenticated;
grant select on table public.export_jobs to authenticated;
grant select, insert, update, delete on table public.export_jobs to service_role;

-- ---------------------------------------------------------------------------
-- 3. Transactional Export RPCs (server/worker-only via service_role)
-- ---------------------------------------------------------------------------

-- 3a. Request or deduplicate an export bound to a specific saved caption revision
create or replace function public.request_export_job(
  p_user_id uuid,
  p_project_id uuid,
  p_revision_id uuid,
  p_format text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects%rowtype;
  v_revision public.caption_revisions%rowtype;
  v_job public.export_jobs%rowtype;
  v_idempotent boolean := false;
  v_retried boolean := false;
begin
  if p_format not in ('srt', 'mp4', 'mov_alpha') then
    raise exception 'Unsupported export format: %', p_format using errcode = '22023';
  end if;

  select * into v_project
  from public.projects
  where id = p_project_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Project not found for owner' using errcode = 'P0002';
  end if;

  if v_project.status <> 'ready' then
    raise exception 'Project is not ready for export' using errcode = '22023';
  end if;

  select * into v_revision
  from public.caption_revisions
  where id = p_revision_id
    and project_id = p_project_id
    and user_id = p_user_id;

  if not found then
    raise exception 'Saved caption revision not found for project' using errcode = 'P0002';
  end if;

  select * into v_job
  from public.export_jobs
  where project_id = p_project_id
    and revision_id = p_revision_id
    and format = p_format
  for update;

  if not found then
    insert into public.export_jobs (
      project_id,
      revision_id,
      revision_number,
      user_id,
      format,
      status,
      stage_message
    )
    values (
      v_project.id,
      v_revision.id,
      v_revision.revision_number,
      p_user_id,
      p_format,
      'queued',
      case
        when p_format = 'srt' then 'Generating SRT subtitle file'
        when p_format = 'mp4' then 'Queued for MP4 render'
        else 'Queued for transparent MOV render'
      end
    )
    returning * into v_job;
  elsif v_job.status = 'failed' then
    v_retried := true;
    update public.export_jobs
    set
      status = 'queued',
      stage_message = case
        when p_format = 'srt' then 'Retrying SRT generation'
        when p_format = 'mp4' then 'Re-queued for MP4 render'
        else 'Re-queued for transparent MOV render'
      end,
      attempt_count = 0,
      attempt_token = null,
      worker_id = null,
      lease_expires_at = null,
      next_run_at = now(),
      output_object_key = null,
      output_mime_type = null,
      output_filename = null,
      output_size_bytes = null,
      output_width = null,
      output_height = null,
      output_duration_ms = null,
      error_code = null,
      error_message = null,
      started_at = null,
      completed_at = null
    where id = v_job.id
    returning * into v_job;
  else
    v_idempotent := true;
  end if;

  return jsonb_build_object(
    'ok', true,
    'idempotent', v_idempotent,
    'retried', v_retried,
    'job', to_jsonb(v_job)
  );
end;
$$;

-- 3b. Publish an immediate synchronous export (used for UTF-8 SRT after storage upload)
create or replace function public.publish_immediate_export(
  p_user_id uuid,
  p_job_id uuid,
  p_output_object_key text,
  p_output_mime_type text,
  p_output_filename text,
  p_output_size_bytes bigint,
  p_output_duration_ms integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.export_jobs%rowtype;
begin
  update public.export_jobs
  set
    status = 'ready',
    stage_message = 'Ready',
    output_object_key = p_output_object_key,
    output_mime_type = p_output_mime_type,
    output_filename = p_output_filename,
    output_size_bytes = p_output_size_bytes,
    output_duration_ms = p_output_duration_ms,
    error_code = null,
    error_message = null,
    started_at = coalesce(started_at, now()),
    completed_at = now()
  where id = p_job_id
    and user_id = p_user_id
  returning * into v_job;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  return jsonb_build_object('ok', true, 'job', to_jsonb(v_job));
end;
$$;

-- 3c. Claim next runnable or lease-expired video export job (mp4 / mov_alpha)
create or replace function public.claim_next_export_job(
  p_worker_id text,
  p_lease_seconds integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.export_jobs%rowtype;
  v_project public.projects%rowtype;
  v_revision public.caption_revisions%rowtype;
  v_asset public.media_assets%rowtype;
  v_token uuid;
begin
  loop
    select * into v_job
    from public.export_jobs
    where format in ('mp4', 'mov_alpha')
      and (
        (status = 'queued' and next_run_at <= now())
        or (status = 'rendering' and lease_expires_at < now())
      )
    order by next_run_at asc, created_at asc
    limit 1
    for update skip locked;

    if not found then
      return null;
    end if;

    if v_job.attempt_count >= v_job.max_attempts then
      update public.export_jobs
      set
        status = 'failed',
        attempt_token = null,
        lease_expires_at = null,
        error_code = coalesce(error_code, 'internal_error'),
        error_message = coalesce(error_message, 'Max render attempts exceeded after worker interruption.'),
        stage_message = 'Render failed after max retries',
        completed_at = now()
      where id = v_job.id;

      continue;
    end if;

    v_token := gen_random_uuid();

    update public.export_jobs
    set
      status = 'rendering',
      stage_message = case
        when v_job.format = 'mp4' then 'Rendering burned-in MP4'
        else 'Rendering transparent ProRes 4444 MOV'
      end,
      attempt_count = v_job.attempt_count + 1,
      attempt_token = v_token,
      worker_id = p_worker_id,
      lease_expires_at = now() + make_interval(secs => greatest(15, p_lease_seconds)),
      started_at = coalesce(v_job.started_at, now()),
      error_code = null,
      error_message = null
    where id = v_job.id
    returning * into v_job;

    select * into v_project
    from public.projects
    where id = v_job.project_id;

    select * into v_revision
    from public.caption_revisions
    where id = v_job.revision_id;

    select * into v_asset
    from public.media_assets
    where project_id = v_job.project_id
      and status = 'uploaded'
    order by created_at asc
    limit 1;

    return jsonb_build_object(
      'jobId', v_job.id,
      'projectId', v_job.project_id,
      'revisionId', v_job.revision_id,
      'revisionNumber', v_job.revision_number,
      'userId', v_job.user_id,
      'format', v_job.format,
      'attemptCount', v_job.attempt_count,
      'maxAttempts', v_job.max_attempts,
      'attemptToken', v_job.attempt_token,
      'bucketId', v_job.bucket_id,
      'projectTitle', v_project.title,
      'mediaKind', coalesce(v_project.media_kind, v_asset.media_kind, 'video'),
      'durationMs', coalesce(v_project.duration_ms, v_asset.duration_ms),
      'previewObjectKey', v_project.preview_object_key,
      'previewWidth', v_project.preview_width,
      'previewHeight', v_project.preview_height,
      'sourceObjectKey', v_asset.object_key,
      'sourceRotationDeg', coalesce(v_asset.rotation_deg, 0),
      'style', v_revision.style,
      'cues', v_revision.cues
    );
  end loop;
end;
$$;

-- 3d. Renew export lease ONLY if attempt_token still matches
create or replace function public.heartbeat_export_job(
  p_job_id uuid,
  p_attempt_token uuid,
  p_stage_message text default null,
  p_lease_seconds integer default 90
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.export_jobs
  set
    stage_message = coalesce(p_stage_message, stage_message),
    lease_expires_at = now() + make_interval(secs => greatest(15, p_lease_seconds))
  where id = p_job_id
    and attempt_token = p_attempt_token
    and status = 'rendering';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

-- 3e. Publish complete rendered artifact atomically (attempt-token guarded)
create or replace function public.publish_export_result(
  p_job_id uuid,
  p_attempt_token uuid,
  p_output_object_key text,
  p_output_mime_type text,
  p_output_filename text,
  p_output_size_bytes bigint,
  p_output_width integer,
  p_output_height integer,
  p_output_duration_ms integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.export_jobs%rowtype;
begin
  select * into v_job
  from public.export_jobs
  where id = p_job_id
  for update;

  if not found
    or v_job.attempt_token is distinct from p_attempt_token
    or v_job.status <> 'rendering'
  then
    return jsonb_build_object('ok', false, 'reason', 'stale_attempt');
  end if;

  update public.export_jobs
  set
    status = 'ready',
    stage_message = 'Ready',
    output_object_key = p_output_object_key,
    output_mime_type = p_output_mime_type,
    output_filename = p_output_filename,
    output_size_bytes = p_output_size_bytes,
    output_width = p_output_width,
    output_height = p_output_height,
    output_duration_ms = p_output_duration_ms,
    lease_expires_at = null,
    error_code = null,
    error_message = null,
    completed_at = now()
  where id = v_job.id
  returning * into v_job;

  return jsonb_build_object('ok', true, 'job', to_jsonb(v_job));
end;
$$;

-- 3f. Fail or retry export job with bounded retries and attempt-token guard
create or replace function public.fail_export_job(
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
  v_job public.export_jobs%rowtype;
begin
  select * into v_job
  from public.export_jobs
  where id = p_job_id
  for update;

  if not found
    or v_job.attempt_token is distinct from p_attempt_token
    or v_job.status <> 'rendering'
  then
    return jsonb_build_object('ok', false, 'reason', 'stale_attempt');
  end if;

  if p_retryable and v_job.attempt_count < v_job.max_attempts then
    update public.export_jobs
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

    return jsonb_build_object('ok', true, 'finalStatus', 'queued');
  else
    update public.export_jobs
    set
      status = 'failed',
      stage_message = 'Render failed',
      attempt_token = null,
      lease_expires_at = null,
      error_code = p_error_code,
      error_message = p_error_message,
      completed_at = now()
    where id = v_job.id;

    return jsonb_build_object('ok', true, 'finalStatus', 'failed');
  end if;
end;
$$;

-- Restrict export RPC execution strictly to service_role
revoke all on function public.request_export_job(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.request_export_job(uuid, uuid, uuid, text) to service_role;

revoke all on function public.publish_immediate_export(uuid, uuid, text, text, text, bigint, integer) from public, anon, authenticated;
grant execute on function public.publish_immediate_export(uuid, uuid, text, text, text, bigint, integer) to service_role;

revoke all on function public.claim_next_export_job(text, integer) from public, anon, authenticated;
grant execute on function public.claim_next_export_job(text, integer) to service_role;

revoke all on function public.heartbeat_export_job(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.heartbeat_export_job(uuid, uuid, text, integer) to service_role;

revoke all on function public.publish_export_result(uuid, uuid, text, text, text, bigint, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.publish_export_result(uuid, uuid, text, text, text, bigint, integer, integer, integer) to service_role;

revoke all on function public.fail_export_job(uuid, uuid, text, text, boolean, integer) from public, anon, authenticated;
grant execute on function public.fail_export_job(uuid, uuid, text, text, boolean, integer) to service_role;
