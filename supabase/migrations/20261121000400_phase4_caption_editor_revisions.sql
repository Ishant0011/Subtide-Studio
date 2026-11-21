-- Phase 4: Caption style config on immutable caption_revisions and atomic
-- optimistic-concurrency save_caption_revision RPC (409 on stale base revision).

alter table public.caption_revisions
  add column if not exists style jsonb not null
  default '{"preset":"word-highlight","fontSize":"md","verticalPosition":14}'::jsonb;

alter table public.caption_revisions
  drop constraint if exists caption_revisions_source_check;

alter table public.caption_revisions
  add constraint caption_revisions_source_check
  check (source in ('deepgram_nova3', 'fixture', 'no_speech', 'editor'));

-- Single-transaction optimistic-concurrency revision save (server-only via service_role)
create or replace function public.save_caption_revision(
  p_user_id uuid,
  p_project_id uuid,
  p_base_revision_id uuid,
  p_cues jsonb,
  p_words jsonb,
  p_style jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects%rowtype;
  v_current public.caption_revisions%rowtype;
  v_next_num integer;
  v_new public.caption_revisions%rowtype;
  v_speech_status text;
begin
  select * into v_project
  from public.projects
  where id = p_project_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Project not found for owner' using errcode = 'P0002';
  end if;

  if v_project.active_revision_id is distinct from p_base_revision_id then
    select * into v_current
    from public.caption_revisions
    where id = v_project.active_revision_id;

    return jsonb_build_object(
      'ok', false,
      'reason', 'stale_revision',
      'currentRevision', case
        when v_current.id is not null then jsonb_build_object(
          'id', v_current.id,
          'revision_number', v_current.revision_number,
          'source', v_current.source,
          'speech_status', v_current.speech_status,
          'language', v_current.language,
          'style', v_current.style,
          'words', v_current.words,
          'cues', v_current.cues,
          'created_at', v_current.created_at
        )
        else null
      end
    );
  end if;

  select coalesce(max(revision_number), 0) + 1 into v_next_num
  from public.caption_revisions
  where project_id = p_project_id;

  v_speech_status := case
    when jsonb_typeof(p_cues) = 'array' and jsonb_array_length(p_cues) > 0 then 'speech'
    else 'no_speech'
  end;

  insert into public.caption_revisions (
    project_id,
    user_id,
    revision_number,
    source,
    speech_status,
    language,
    style,
    words,
    cues
  )
  values (
    p_project_id,
    p_user_id,
    v_next_num,
    'editor',
    v_speech_status,
    'en',
    p_style,
    coalesce(p_words, '[]'::jsonb),
    coalesce(p_cues, '[]'::jsonb)
  )
  returning * into v_new;

  update public.projects
  set active_revision_id = v_new.id
  where id = p_project_id
    and user_id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'revision', jsonb_build_object(
      'id', v_new.id,
      'project_id', v_new.project_id,
      'revision_number', v_new.revision_number,
      'source', v_new.source,
      'speech_status', v_new.speech_status,
      'language', v_new.language,
      'style', v_new.style,
      'words', v_new.words,
      'cues', v_new.cues,
      'created_at', v_new.created_at
    )
  );
end;
$$;

revoke all on function public.save_caption_revision(uuid, uuid, uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_caption_revision(uuid, uuid, uuid, jsonb, jsonb, jsonb) to service_role;
