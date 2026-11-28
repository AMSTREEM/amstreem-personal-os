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

  select j.id, j.status, j.attempts, j.started_at, j.next_attempt_at
    into v_id, v_status, v_attempts, v_started_at, v_next_attempt_at
    from public.atlas_job_runs as j
   where j.job_name = p_job_name and j.run_key = p_run_key
   for update;

  if (v_status = 'failed' and (v_next_attempt_at is null or v_next_attempt_at <= clock_timestamp()))
     or (v_status = 'running' and v_started_at < clock_timestamp() - interval '5 minutes') then
    update public.atlas_job_runs as j
       set status = 'running',
           attempts = j.attempts + 1,
           started_at = clock_timestamp(),
           finished_at = null,
           next_attempt_at = null,
           error_message = null,
           request_id = p_request_id
     where j.id = v_id
    returning j.id, j.attempts into v_id, v_attempts;
    return query select true, v_id, v_attempts;
    return;
  end if;

  return query select false, v_id, v_attempts;
end;
$$;
