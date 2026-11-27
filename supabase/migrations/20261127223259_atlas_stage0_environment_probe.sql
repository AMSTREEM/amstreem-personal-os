-- Keep app_meta private by default. A secret-gated server-only read is allowed for the environment marker.
create or replace function private.atlas_environment_probe_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_meta
    where key = 'environment_probe_hash'
      and value = encode(
        extensions.digest(
          convert_to(
            coalesce(current_setting('request.headers', true)::json ->> 'x-atlas-probe-token', ''),
            'UTF8'
          ),
          'sha256'
        ),
        'hex'
      )
  );
$$;

revoke all on function private.atlas_environment_probe_allowed() from public, anon, authenticated;
grant usage on schema private to anon;
grant execute on function private.atlas_environment_probe_allowed() to anon;

grant select on public.app_meta to anon;
drop policy if exists app_meta_environment_probe on public.app_meta;
create policy app_meta_environment_probe
on public.app_meta
for select
to anon
using (key = 'environment' and private.atlas_environment_probe_allowed());
