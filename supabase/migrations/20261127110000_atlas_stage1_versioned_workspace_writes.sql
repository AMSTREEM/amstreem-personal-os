-- Stage 1: versioned workspace writes, history and idempotency.
-- This migration is designed for the isolated staging project and is backward compatible.
alter table public.personal_os_workspaces
  add column if not exists version bigint not null default 1,
  add column if not exists schema_version integer not null default 3;

create table if not exists public.personal_os_workspace_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  version bigint not null,
  schema_version integer not null,
  snapshot jsonb not null,
  reason text not null default 'scheduled' check (reason in ('scheduled','pre_import','pre_restore','pre_migration','manual')),
  created_at timestamptz not null default now()
);
create index if not exists personal_os_workspace_history_user_created_idx
  on public.personal_os_workspace_history (user_id, created_at desc);
alter table public.personal_os_workspace_history enable row level security;
alter table public.personal_os_workspace_history force row level security;
drop policy if exists "workspace history owner read" on public.personal_os_workspace_history;
create policy "workspace history owner read" on public.personal_os_workspace_history
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "workspace history owner insert" on public.personal_os_workspace_history;
create policy "workspace history owner insert" on public.personal_os_workspace_history
  for insert to authenticated with check ((select auth.uid()) = user_id);

create table if not exists public.personal_os_workspace_idempotency (
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  request_hash text not null,
  committed_version bigint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, idempotency_key),
  check (length(idempotency_key) between 8 and 200),
  check (length(request_hash) = 64)
);
alter table public.personal_os_workspace_idempotency enable row level security;
alter table public.personal_os_workspace_idempotency force row level security;
drop policy if exists "workspace idempotency owner read" on public.personal_os_workspace_idempotency;
create policy "workspace idempotency owner read" on public.personal_os_workspace_idempotency
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "workspace idempotency owner insert" on public.personal_os_workspace_idempotency;
create policy "workspace idempotency owner insert" on public.personal_os_workspace_idempotency
  for insert to authenticated with check ((select auth.uid()) = user_id);

create or replace function public.commit_workspace(
  p_expected_version bigint,
  p_data jsonb,
  p_schema_version integer,
  p_idempotency_key text default null,
  p_request_hash text default null,
  p_force_history boolean default false,
  p_history_reason text default 'scheduled'
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_version bigint;
  v_new_version bigint;
  v_existing_hash text;
  v_existing_version bigint;
  v_last_history timestamptz;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'invalid_workspace_snapshot' using errcode = '22023';
  end if;
  if p_schema_version < 1 then
    raise exception 'invalid_schema_version' using errcode = '22023';
  end if;
  if p_idempotency_key is not null then
    if length(p_idempotency_key) < 8 or length(p_idempotency_key) > 200
       or p_request_hash is null or length(p_request_hash) <> 64 then
      raise exception 'invalid_idempotency_metadata' using errcode = '22023';
    end if;
  end if;
  if p_history_reason not in ('scheduled','pre_import','pre_restore','pre_migration','manual') then
    raise exception 'invalid_history_reason' using errcode = '22023';
  end if;

  -- Serializes commits for one account across all API instances.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  if p_idempotency_key is not null then
    select request_hash, committed_version into v_existing_hash, v_existing_version
      from public.personal_os_workspace_idempotency
     where user_id = v_user_id and idempotency_key = p_idempotency_key;
    if found then
      if v_existing_hash <> p_request_hash then
        raise exception 'idempotency_key_reused' using errcode = '22023';
      end if;
      return jsonb_build_object('version', v_existing_version, 'replayed', true);
    end if;
  end if;

  select version into v_current_version
    from public.personal_os_workspaces where user_id = v_user_id for update;
  if v_current_version is null then
    if p_expected_version <> 0 then
      raise exception 'version_conflict' using errcode = 'P0001';
    end if;
    insert into public.personal_os_workspaces(user_id, data, version, schema_version, updated_at)
    values (v_user_id, p_data, 1, p_schema_version, now())
    on conflict (user_id) do nothing returning version into v_new_version;
  else
    if v_current_version <> p_expected_version then
      raise exception 'version_conflict' using errcode = 'P0001';
    end if;
    if p_force_history then
      insert into public.personal_os_workspace_history(user_id, version, schema_version, snapshot, reason)
      select user_id, version, schema_version, data, p_history_reason
        from public.personal_os_workspaces where user_id = v_user_id;
    else
      select max(created_at) into v_last_history
        from public.personal_os_workspace_history
       where user_id = v_user_id and reason = 'scheduled';
      if v_last_history is null or v_last_history <= now() - interval '6 hours' then
        insert into public.personal_os_workspace_history(user_id, version, schema_version, snapshot, reason)
        select user_id, version, schema_version, data, 'scheduled'
          from public.personal_os_workspaces where user_id = v_user_id;
      end if;
    end if;
    update public.personal_os_workspaces
       set data = p_data, version = version + 1, schema_version = p_schema_version, updated_at = now()
     where user_id = v_user_id and version = p_expected_version returning version into v_new_version;
  end if;

  if v_new_version is null then raise exception 'version_conflict' using errcode = 'P0001'; end if;
  if p_idempotency_key is not null then
    insert into public.personal_os_workspace_idempotency(user_id, idempotency_key, request_hash, committed_version)
    values (v_user_id, p_idempotency_key, p_request_hash, v_new_version);
  end if;

  delete from public.personal_os_workspace_history h
   where h.user_id = v_user_id and h.reason = 'scheduled'
     and h.id in (
       select id from (
         select id, row_number() over (order by created_at desc, id desc) rn
           from public.personal_os_workspace_history
          where user_id = v_user_id and reason = 'scheduled'
       ) ranked where rn > 30
     );
  delete from public.personal_os_workspace_history
   where user_id = v_user_id and reason <> 'scheduled'
     and created_at < now() - interval '90 days';
  delete from public.personal_os_workspace_idempotency
   where user_id = v_user_id and created_at < now() - interval '30 days';

  return jsonb_build_object('version', v_new_version, 'replayed', false);
end;
$$;

revoke all on function public.commit_workspace(bigint,jsonb,integer,text,text,boolean,text) from public, anon;
grant execute on function public.commit_workspace(bigint,jsonb,integer,text,text,boolean,text) to authenticated;
grant select, insert on public.personal_os_workspace_history to authenticated;
grant select, insert on public.personal_os_workspace_idempotency to authenticated;
