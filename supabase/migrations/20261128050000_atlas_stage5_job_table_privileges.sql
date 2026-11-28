revoke all on table public.atlas_job_leases, public.atlas_job_runs from public, anon, authenticated;
grant all on table public.atlas_job_leases, public.atlas_job_runs to service_role;
create index if not exists atlas_job_runs_user_id_idx on public.atlas_job_runs(user_id) where user_id is not null;