drop policy if exists atlas_notifications_delete_own on public.atlas_notifications;
drop policy if exists atlas_insights_delete_own on public.atlas_insights;
revoke update, delete on public.atlas_notifications from authenticated;
revoke update, delete on public.atlas_insights from authenticated;
grant update(status, read_at) on public.atlas_notifications to authenticated;
grant update(status, dismissed_at) on public.atlas_insights to authenticated;
