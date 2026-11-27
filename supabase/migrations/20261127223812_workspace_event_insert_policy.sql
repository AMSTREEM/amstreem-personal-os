-- Let the authenticated account insert only its own events.
-- The commit RPC is invoker-secured; all writes remain subject to owner RLS.
grant insert on table public.activity_events to authenticated;
drop policy if exists "activity events owner insert" on public.activity_events;
create policy "activity events owner insert"
on public.activity_events
for insert
to authenticated
with check ((select auth.uid()) = user_id);

alter function public.commit_workspace_with_events(
  uuid, bigint, jsonb, integer, text, text, boolean, text, jsonb
) security invoker;

revoke execute on function public.commit_workspace_with_events(
  uuid, bigint, jsonb, integer, text, text, boolean, text, jsonb
) from public, anon;
grant execute on function public.commit_workspace_with_events(
  uuid, bigint, jsonb, integer, text, text, boolean, text, jsonb
) to authenticated;
