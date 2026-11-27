-- Stage 4B: trusted server-only event commit and authenticated read RPCs.

grant execute on function public.commit_workspace(bigint,jsonb,integer,text,text,boolean,text) to service_role;

create or replace function public.commit_workspace_with_events(
  p_user_id uuid,
  p_expected_version bigint,
  p_data jsonb,
  p_schema_version integer,
  p_idempotency_key text,
  p_request_hash text,
  p_force_history boolean,
  p_history_reason text,
  p_events jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := p_user_id;
  v_result jsonb;
begin
  if current_user <> 'service_role' then
    raise exception 'server_only_workspace_commit' using errcode = '42501';
  end if;
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- The server has already verified the user's access token. Set the request
  -- claims for the existing owner-scoped commit and event triggers.
  perform set_config('request.jwt.claim.sub',v_user_id::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_user_id::text,'role','authenticated')::text,true);
  if auth.uid() is distinct from v_user_id then
    raise exception 'workspace_owner_mismatch' using errcode = '42501';
  end if;

  if p_events is null or jsonb_typeof(p_events) <> 'array' then
    raise exception 'invalid_event_batch' using errcode = '22023';
  end if;
  if jsonb_array_length(p_events) > 5000 then
    raise exception 'event_batch_too_large' using errcode = '22023';
  end if;

  v_result := public.commit_workspace(
    p_expected_version,p_data,p_schema_version,p_idempotency_key,
    p_request_hash,p_force_history,p_history_reason
  );

  -- A replayed idempotency key means the original transaction already appended
  -- its events. Do not append a second batch from the retried HTTP request.
  if not coalesce((v_result->>'replayed')::boolean,false) then
    insert into public.activity_events(
      user_id,event_key,type,module,entity_id,occurred_at,local_date,payload,source
    )
    select
      v_user_id,e.key,e.type,e.module,e.entity_id,e.occurred_at,e.local_date,e.payload,e.source
    from jsonb_to_recordset(p_events) as e(
      key text,type text,module text,entity_id text,occurred_at timestamptz,
      local_date date,payload jsonb,source text
    )
    on conflict (user_id,event_key) do nothing;
  end if;

  return v_result;
end;
$$;

revoke all on function public.commit_workspace_with_events(uuid,bigint,jsonb,integer,text,text,boolean,text,jsonb) from public, anon, authenticated;
grant execute on function public.commit_workspace_with_events(uuid,bigint,jsonb,integer,text,text,boolean,text,jsonb) to service_role;

create or replace function public.get_progress_totals(
  p_start date default null,
  p_end date default null
)
returns table(metric text, value bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.metric, sum(p.value)::bigint
    from public.progress_daily p
   where p.user_id = (select auth.uid())
     and (p_start is null or p.local_date >= p_start)
     and (p_end is null or p.local_date < p_end)
   group by p.metric;
$$;
revoke all on function public.get_progress_totals(date,date) from public, anon;
grant execute on function public.get_progress_totals(date,date) to authenticated;

create or replace function public.get_xp_summary()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'totalXp', coalesce(sum(x.points),0),
    'lastEvent', (
      select jsonb_build_object(
        'category', last_x.category,
        'points', last_x.points,
        'awarded_at', last_x.awarded_at
      )
      from public.xp_ledger last_x
      where last_x.user_id = (select auth.uid())
      order by last_x.awarded_at desc, last_x.id desc
      limit 1
    )
  )
  from public.xp_ledger x
  where x.user_id = (select auth.uid());
$$;
revoke all on function public.get_xp_summary() from public, anon;
grant execute on function public.get_xp_summary() to authenticated;
