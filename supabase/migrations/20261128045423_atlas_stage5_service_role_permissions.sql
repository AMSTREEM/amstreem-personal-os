create or replace function public.claim_atlas_job_lease(p_job_name text, p_owner_id uuid, p_lease_seconds integer default 90)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_claimed text;
begin
  if p_job_name is null or length(p_job_name) not between 1 and 100 or p_owner_id is null then
    raise exception 'invalid job lease arguments' using errcode = '22023';
  end if;
  insert into public.atlas_job_leases(job_name, lease_owner, lease_expires_at, heartbeat_at)
  values (p_job_name, p_owner_id, clock_timestamp() + make_interval(secs => greatest(15, least(coalesce(p_lease_seconds,90),300))), clock_timestamp())
  on conflict (job_name) do update
    set lease_owner = excluded.lease_owner,
        lease_expires_at = excluded.lease_expires_at,
        heartbeat_at = clock_timestamp()
    where public.atlas_job_leases.lease_expires_at < clock_timestamp()
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
declare v_released text;
begin
  update public.atlas_job_leases
     set lease_expires_at = clock_timestamp() - interval '1 second', heartbeat_at = clock_timestamp()
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
  insert into public.atlas_job_runs(job_name, run_key, user_id, status, attempts, request_id)
  values (p_job_name, p_run_key, p_user_id, 'running', 1, p_request_id)
  on conflict (job_name, run_key) do nothing
  returning id, atlas_job_runs.attempts into v_id, v_attempts;
  if v_id is not null then
    return query select true, v_id, v_attempts;
    return;
  end if;
  select j.id, j.status, j.attempts, j.started_at, j.next_attempt_at
    into v_id, v_status, v_attempts, v_started_at, v_next_attempt_at
    from public.atlas_job_runs as j
   where j.job_name = p_job_name and j.run_key = p_run_key
   for update;
  if (v_status = 'failed' and (v_next_attempt_at is null or v_next_attempt_at <= clock_timestamp()))
     or (v_status = 'running' and v_started_at < clock_timestamp() - interval '5 minutes') then
    update public.atlas_job_runs as j
       set status = 'running', attempts = j.attempts + 1, started_at = clock_timestamp(),
           finished_at = null, next_attempt_at = null, error_message = null, request_id = p_request_id
     where j.id = v_id
    returning j.id, j.attempts into v_id, v_attempts;
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
declare v_finished uuid;
begin
  if p_status not in ('succeeded','failed','skipped') then
    raise exception 'invalid job run status' using errcode = '22023';
  end if;
  update public.atlas_job_runs
     set status = p_status,
         finished_at = clock_timestamp(),
         next_attempt_at = case when p_status = 'failed' then clock_timestamp() + make_interval(secs => greatest(30, least(coalesce(p_backoff_seconds,60),86400))) else null end,
         error_message = left(p_error_message, 2000),
         result = coalesce(p_result, '{}'::jsonb)
   where id = p_run_id
  returning id into v_finished;
  return v_finished is not null;
end;
$$;

revoke all on table public.atlas_job_leases, public.atlas_job_runs, public.atlas_notifications, public.atlas_insights, public.atlas_briefings, public.atlas_weekly_reviews from public, anon, authenticated;
grant all on table public.atlas_job_leases, public.atlas_job_runs, public.atlas_notifications, public.atlas_insights, public.atlas_briefings, public.atlas_weekly_reviews to service_role;
grant select on public.atlas_notifications, public.atlas_insights, public.atlas_briefings, public.atlas_weekly_reviews to authenticated;
grant update(status, read_at) on public.atlas_notifications to authenticated;
grant update(status, dismissed_at) on public.atlas_insights to authenticated;

revoke all on function public.claim_atlas_job_lease(text, uuid, integer) from public, anon, authenticated;
revoke all on function public.release_atlas_job_lease(text, uuid) from public, anon, authenticated;
revoke all on function public.claim_atlas_job_run(text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.finish_atlas_job_run(uuid, text, jsonb, text, integer) from public, anon, authenticated;
grant execute on function public.claim_atlas_job_lease(text, uuid, integer) to service_role;
grant execute on function public.release_atlas_job_lease(text, uuid) to service_role;
grant execute on function public.claim_atlas_job_run(text, text, uuid, text) to service_role;
grant execute on function public.finish_atlas_job_run(uuid, text, jsonb, text, integer) to service_role;
