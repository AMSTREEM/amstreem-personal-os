-- Workspace persistence: allow each authenticated account to commit only its own snapshot.
-- The function runs with its owner privileges only after binding the target user to auth.uid().
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
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null or v_user_id is distinct from p_user_id then
    raise exception 'workspace_owner_mismatch' using errcode = '42501';
  end if;

  if p_events is null or jsonb_typeof(p_events) <> 'array' then
    raise exception 'invalid_event_batch' using errcode = '22023';
  end if;
  if jsonb_array_length(p_events) > 5000 then
    raise exception 'event_batch_too_large' using errcode = '22023';
  end if;

  -- commit_workspace and its event triggers still derive ownership from auth.uid().
  v_result := public.commit_workspace(
    p_expected_version,p_data,p_schema_version,p_idempotency_key,
    p_request_hash,p_force_history,p_history_reason
  );

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

revoke all on function public.commit_workspace_with_events(uuid,bigint,jsonb,integer,text,text,boolean,text,jsonb)
  from public, anon, service_role;
grant execute on function public.commit_workspace_with_events(uuid,bigint,jsonb,integer,text,text,boolean,text,jsonb)
  to authenticated;
