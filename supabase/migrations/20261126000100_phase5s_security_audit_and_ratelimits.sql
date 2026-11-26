-- Phase 5S: Security audit log, durable Postgres rate limiting, and RLS/function search_path hardening.

-- ---------------------------------------------------------------------------
-- 1. Harden existing trigger functions with fixed search_path = public
--    and ensure caption_presets forces RLS and denies anon access
-- ---------------------------------------------------------------------------
alter function public.set_updated_at() set search_path = public;
alter function public.guard_projects_authenticated_update() set search_path = public;
alter function public.touch_caption_presets_updated_at() set search_path = public;

alter table public.caption_presets force row level security;
revoke all on table public.caption_presets from anon;

-- ---------------------------------------------------------------------------
-- 2. Redacted Security Audit Events (service_role writes only; no direct client access)
-- ---------------------------------------------------------------------------
create table if not exists public.security_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (char_length(trim(event_type)) between 2 and 80),
  outcome text not null check (outcome in ('allowed', 'denied', 'error')),
  actor_user_id uuid references auth.users (id) on delete set null,
  target_resource text,
  ip_hash text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_security_audit_events_created
  on public.security_audit_events (created_at desc);

create index if not exists idx_security_audit_events_type_created
  on public.security_audit_events (event_type, created_at desc);

alter table public.security_audit_events enable row level security;
alter table public.security_audit_events force row level security;

-- No direct reads or writes for anon or authenticated roles; accessed only through server-only admin guard
revoke all on table public.security_audit_events from public, anon, authenticated;
grant select, insert on table public.security_audit_events to service_role;

-- ---------------------------------------------------------------------------
-- 3. Durable Postgres Rate Limiting (service_role RPC only)
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limit_buckets (
  bucket_key text primary key check (char_length(bucket_key) between 1 and 200),
  window_start timestamptz not null default now(),
  request_count integer not null default 1 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rate_limit_buckets_window
  on public.rate_limit_buckets (window_start);

alter table public.rate_limit_buckets enable row level security;
alter table public.rate_limit_buckets force row level security;

revoke all on table public.rate_limit_buckets from public, anon, authenticated;
grant select, insert, update, delete on table public.rate_limit_buckets to service_role;

create or replace function public.check_and_increment_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window interval := make_interval(secs => greatest(1, p_window_seconds));
  v_row public.rate_limit_buckets%rowtype;
  v_allowed boolean;
  v_retry_after integer := 0;
begin
  if p_bucket_key is null or char_length(trim(p_bucket_key)) = 0 then
    raise exception 'Invalid rate limit bucket key' using errcode = '22023';
  end if;

  insert into public.rate_limit_buckets (bucket_key, window_start, request_count, updated_at)
  values (p_bucket_key, v_now, 1, v_now)
  on conflict (bucket_key) do update
  set
    window_start = case
      when public.rate_limit_buckets.window_start + v_window <= v_now then v_now
      else public.rate_limit_buckets.window_start
    end,
    request_count = case
      when public.rate_limit_buckets.window_start + v_window <= v_now then 1
      else public.rate_limit_buckets.request_count + 1
    end,
    updated_at = v_now
  returning * into v_row;

  v_allowed := v_row.request_count <= greatest(1, p_limit);

  if not v_allowed then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from ((v_row.window_start + v_window) - v_now)))::integer
    );
  end if;

  return jsonb_build_object(
    'allowed', v_allowed,
    'count', v_row.request_count,
    'limit', greatest(1, p_limit),
    'remaining', greatest(0, greatest(1, p_limit) - v_row.request_count),
    'retryAfterSeconds', v_retry_after
  );
end;
$$;

revoke all on function public.check_and_increment_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_and_increment_rate_limit(text, integer, integer) to service_role;
