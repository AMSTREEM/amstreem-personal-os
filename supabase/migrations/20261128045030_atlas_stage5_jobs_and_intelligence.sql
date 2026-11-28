-- Stage 5: durable job leases, idempotent run records, in-app notifications and explainable intelligence.
create table if not exists public.atlas_job_leases (
  job_name text primary key check (length(job_name) between 1 and 100),
  lease_owner uuid not null,
  lease_expires_at timestamptz not null,
  heartbeat_at timestamptz not null default now()
);

create table if not exists public.atlas_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null check (length(job_name) between 1 and 100),
  run_key text not null check (length(run_key) between 1 and 240),
  user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'running' check (status in ('running','succeeded','failed','skipped')),
  attempts integer not null default 1 check (attempts > 0),
  request_id text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  next_attempt_at timestamptz,
  error_message text,
  result jsonb not null default '{}'::jsonb,
  unique(job_name, run_key)
);
create index if not exists atlas_job_runs_retry_idx on public.atlas_job_runs(status, next_attempt_at, started_at);

create table if not exists public.atlas_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  category text not null check (category in ('tasks','goals','habits','learning','growth','weekly_review','system')),
  channel text not null check (channel in ('in_app','email','push')),
  title text not null check (length(title) between 1 and 120),
  body text not null check (length(body) between 1 and 500),
  data jsonb not null default '{}'::jsonb,
  dedupe_key text not null check (length(dedupe_key) between 1 and 240),
  status text not null default 'queued' check (status in ('queued','delivered','read','dismissed','failed')),
  scheduled_at timestamptz not null default now(),
  delivered_at timestamptz,
  read_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  unique(user_id, channel, dedupe_key)
);
create index if not exists atlas_notifications_inbox_idx on public.atlas_notifications(user_id, status, created_at desc);
create index if not exists atlas_notifications_dispatch_idx on public.atlas_notifications(status, scheduled_at) where status='queued';

create table if not exists public.atlas_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  insight_type text not null check (length(insight_type) between 1 and 80),
  title text not null check (length(title) between 1 and 120),
  summary text not null check (length(summary) between 1 and 500),
  explanation text not null check (length(explanation) between 1 and 1200),
  evidence jsonb not null default '{}'::jsonb,
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  dedupe_key text not null check (length(dedupe_key) between 1 and 240),
  status text not null default 'active' check (status in ('active','dismissed','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  dismissed_at timestamptz,
  unique(user_id, dedupe_key)
);
create index if not exists atlas_insights_feed_idx on public.atlas_insights(user_id, status, created_at desc);

create table if not exists public.atlas_briefings (
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  briefing jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  primary key(user_id, local_date)
);

create table if not exists public.atlas_weekly_reviews (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  review jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  primary key(user_id, week_start)
);

alter table public.atlas_job_leases enable row level security;
alter table public.atlas_job_runs enable row level security;
alter table public.atlas_notifications enable row level security;
alter table public.atlas_insights enable row level security;
alter table public.atlas_briefings enable row level security;
alter table public.atlas_weekly_reviews enable row level security;

drop policy if exists atlas_notifications_select_own on public.atlas_notifications;
create policy atlas_notifications_select_own on public.atlas_notifications for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists atlas_notifications_update_own on public.atlas_notifications;
create policy atlas_notifications_update_own on public.atlas_notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists atlas_notifications_delete_own on public.atlas_notifications;
create policy atlas_notifications_delete_own on public.atlas_notifications for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists atlas_insights_select_own on public.atlas_insights;
create policy atlas_insights_select_own on public.atlas_insights for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists atlas_insights_update_own on public.atlas_insights;
create policy atlas_insights_update_own on public.atlas_insights for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists atlas_insights_delete_own on public.atlas_insights;
create policy atlas_insights_delete_own on public.atlas_insights for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists atlas_briefings_select_own on public.atlas_briefings;
create policy atlas_briefings_select_own on public.atlas_briefings for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists atlas_weekly_reviews_select_own on public.atlas_weekly_reviews;
create policy atlas_weekly_reviews_select_own on public.atlas_weekly_reviews for select to authenticated using (user_id = (select auth.uid()));

grant select, update, delete on public.atlas_notifications to authenticated;
grant select, update, delete on public.atlas_insights to authenticated;
grant select on public.atlas_briefings to authenticated;
grant select on public.atlas_weekly_reviews to authenticated;
grant all on public.atlas_job_leases, public.atlas_job_runs, public.atlas_notifications, public.atlas_insights, public.atlas_briefings, public.atlas_weekly_reviews to service_role;

create or replace function public.claim_atlas_job_lease(p_job_name text, p_owner_id uuid, p_lease_seconds integer default 90)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_job_name is null or length(p_job_name) not between 1 and 100 or p_owner_id is null then
    raise exception 'invalid job lease arguments' using errcode = '22023';
  end if;
  insert into public.atlas_job_leases(job_name, lease_owner, lease_expires_at, heartbeat_at)
  values (p_job_name, p_owner_id, now() + make_interval(secs => greatest(15, least(coalesce(p_lease_seconds,90),300))), now())
  on conflict (job_name) do update
    set lease_owner = excluded.lease_owner,
        lease_expires_at = excluded.lease_expires_at,
        heartbeat_at = now()
    where public.atlas_job_leases.lease_expires_at < now()
       or public.atlas_job_leases.lease_owner = excluded.lease_owner
  returning job_name into v_claimed;
  return v_claimed is not null;
end;
$$;

create or replace function public.release_atlas_job_lease(p_job_name text, p_owner_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_released text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  update public.atlas_job_leases
     set lease_expires_at = now(), heartbeat_at = now()
   where job_name = p_job_name and lease_owner = p_owner_id
  returning job_name into v_released;
  return v_released is not null;
end;
$$;

create or replace function public.claim_atlas_job_run(p_job_name text, p_run_key text, p_user_id uuid default null, p_request_id text default null)
returns table(claimed boolean, run_id uuid, attempts integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_attempts integer;
  v_status text;
  v_started_at timestamptz;
  v_next_attempt_at timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  insert into public.atlas_job_runs(job_name, run_key, user_id, status, attempts, request_id)
  values (p_job_name, p_run_key, p_user_id, 'running', 1, p_request_id)
  on conflict (job_name, run_key) do nothing
  returning id, atlas_job_runs.attempts into v_id, v_attempts;
  if v_id is not null then
    return query select true, v_id, v_attempts;
    return;
  end if;

  select id, status, attempts, started_at, next_attempt_at
    into v_id, v_status, v_attempts, v_started_at, v_next_attempt_at
    from public.atlas_job_runs
   where job_name = p_job_name and run_key = p_run_key
   for update;

  if (v_status = 'failed' and (v_next_attempt_at is null or v_next_attempt_at <= now()))
     or (v_status = 'running' and v_started_at < now() - interval '5 minutes') then
    update public.atlas_job_runs
       set status = 'running',
           attempts = attempts + 1,
           started_at = now(),
           finished_at = null,
           next_attempt_at = null,
           error_message = null,
           request_id = p_request_id
     where id = v_id
    returning id, atlas_job_runs.attempts into v_id, v_attempts;
    return query select true, v_id, v_attempts;
    return;
  end if;

  return query select false, v_id, v_attempts;
end;
$$;

create or replace function public.finish_atlas_job_run(p_run_id uuid, p_status text, p_result jsonb default '{}'::jsonb, p_error_message text default null, p_backoff_seconds integer default 60)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_finished uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_status not in ('succeeded','failed','skipped') then
    raise exception 'invalid job run status' using errcode = '22023';
  end if;
  update public.atlas_job_runs
     set status = p_status,
         finished_at = now(),
         next_attempt_at = case when p_status = 'failed' then now() + make_interval(secs => greatest(30, least(coalesce(p_backoff_seconds,60),86400))) else null end,
         error_message = left(p_error_message, 2000),
         result = coalesce(p_result, '{}'::jsonb)
   where id = p_run_id
  returning id into v_finished;
  return v_finished is not null;
end;
$$;

revoke all on function public.claim_atlas_job_lease(text, uuid, integer) from public, anon, authenticated;
revoke all on function public.release_atlas_job_lease(text, uuid) from public, anon, authenticated;
revoke all on function public.claim_atlas_job_run(text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.finish_atlas_job_run(uuid, text, jsonb, text, integer) from public, anon, authenticated;
grant execute on function public.claim_atlas_job_lease(text, uuid, integer) to service_role;
grant execute on function public.release_atlas_job_lease(text, uuid) to service_role;
grant execute on function public.claim_atlas_job_run(text, text, uuid, text) to service_role;
grant execute on function public.finish_atlas_job_run(uuid, text, jsonb, text, integer) to service_role;
