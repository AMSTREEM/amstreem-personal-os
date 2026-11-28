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
declare
  v_released text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  update public.atlas_job_leases
     set lease_expires_at = clock_timestamp() - interval '1 second', heartbeat_at = clock_timestamp()
   where job_name = p_job_name and lease_owner = p_owner_id
  returning job_name into v_released;
  return v_released is not null;
end;
$$;
