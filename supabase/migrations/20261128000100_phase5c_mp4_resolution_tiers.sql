-- Phase 5C: MP4-only new exports with server-validated resolution tiers (240p..2160p + original).
-- Preserves existing historical SRT/MOV/MP4 export_jobs rows and owner-only download access.

-- 1. Add resolution_tier column and update deduplication uniqueness to (project_id, revision_id, format, resolution_tier)
alter table public.export_jobs
  add column if not exists resolution_tier text not null default '1080p';

alter table public.export_jobs
  drop constraint if exists export_jobs_resolution_tier_check;

alter table public.export_jobs
  add constraint export_jobs_resolution_tier_check
  check (resolution_tier in ('original', '240p', '360p', '480p', '720p', '1080p', '1440p', '2160p'));

alter table public.export_jobs
  drop constraint if exists export_jobs_project_id_revision_id_format_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'export_jobs_project_rev_fmt_tier_key'
  ) then
    alter table public.export_jobs
      add constraint export_jobs_project_rev_fmt_tier_key
      unique (project_id, revision_id, format, resolution_tier);
  end if;
end;
$$;

-- 2. Replace request_export_job to enforce MP4-only new requests and deduplicate by (revision_id, resolution_tier)
drop function if exists public.request_export_job(uuid, uuid, uuid, text);

create or replace function public.request_export_job(
  p_user_id uuid,
  p_project_id uuid,
  p_revision_id uuid,
  p_format text,
  p_resolution_tier text default '1080p'
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
  v_tier text := lower(trim(coalesce(p_resolution_tier, '1080p')));
begin
  if p_format <> 'mp4' then
    raise exception 'New exports support MP4 only.' using errcode = '22023';
  end if;

  if v_tier not in ('original', '240p', '360p', '480p', '720p', '1080p', '1440p', '2160p') then
    raise exception 'Unsupported export resolution tier: %', p_resolution_tier using errcode = '22023';
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
    and format = 'mp4'
    and resolution_tier = v_tier
  for update;

  if not found then
    insert into public.export_jobs (
      project_id,
      revision_id,
      revision_number,
      user_id,
      format,
      resolution_tier,
      status,
      stage_message
    )
    values (
      v_project.id,
      v_revision.id,
      v_revision.revision_number,
      p_user_id,
      'mp4',
      v_tier,
      'queued',
      format('Queued for %s MP4 render', case when v_tier = 'original' then 'Original size' else upper(v_tier) end)
    )
    returning * into v_job;
  elsif v_job.status = 'failed' then
    v_retried := true;
    update public.export_jobs
    set
      status = 'queued',
      stage_message = format('Re-queued for %s MP4 render', case when v_tier = 'original' then 'Original size' else upper(v_tier) end),
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

-- 3. Update claim_next_export_job to return resolutionTier and source dimensions
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
        when v_job.format = 'mp4' then format(
          'Rendering %s MP4',
          case when v_job.resolution_tier = 'original' then 'Original size' else upper(v_job.resolution_tier) end
        )
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
      'resolutionTier', coalesce(v_job.resolution_tier, '1080p'),
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
      'sourceWidth', v_asset.width,
      'sourceHeight', v_asset.height,
      'sourceRotationDeg', coalesce(v_asset.rotation_deg, 0),
      'style', v_revision.style,
      'cues', v_revision.cues
    );
  end loop;
end;
$$;

revoke all on function public.request_export_job(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.request_export_job(uuid, uuid, uuid, text, text) to service_role;

revoke all on function public.claim_next_export_job(text, integer) from public, anon, authenticated;
grant execute on function public.claim_next_export_job(text, integer) to service_role;
