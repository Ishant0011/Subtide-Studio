-- Phase 5A follow-up: preserve existing saved caption styles (backfilling
-- legacy mint accent on existing revisions without an explicit accent) and
-- switch the default accent for new projects to ClipCaptions violet.

update public.caption_revisions
set style = coalesce(
  style,
  '{"preset":"word-highlight","fontSize":"md","verticalPosition":14}'::jsonb
) || '{"accent":"mint"}'::jsonb
where style is null
   or not (style ? 'accent');

alter table public.caption_revisions
  alter column style
  set default '{"preset":"word-highlight","fontSize":"md","verticalPosition":14,"accent":"violet"}'::jsonb;
