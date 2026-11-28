CREATE OR REPLACE FUNCTION atlas_private.apply_activity_event_projection()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_metric text;
  v_delta bigint := 0;
  v_projection_date date := new.local_date;
  v_reverses_key text := new.payload ->> 'reversesEventKey';
  v_original_xp_category text;
  v_original_xp_points integer;
  v_original_xp_date date;
  v_category text;
  v_points integer := 0;
  v_cap integer := 0;
  v_earned integer := 0;
  v_xp_modules jsonb;
begin
  if auth.uid() is distinct from new.user_id then
    raise exception 'event_owner_mismatch' using errcode = '42501';
  end if;

  if v_reverses_key is not null then
    select local_date into v_projection_date
      from public.activity_events
     where user_id = new.user_id and event_key = v_reverses_key;
  end if;
  v_projection_date := coalesce(v_projection_date, new.local_date);

  v_metric := case new.type
    when 'task.completed' then 'tasks_completed'
    when 'task.reopened' then 'tasks_completed'
    when 'goal.completed' then 'goals_completed'
    when 'goal.reopened' then 'goals_completed'
    when 'goal.milestone_reached' then 'milestones_reached'
    when 'goal.milestone_unreached' then 'milestones_reached'
    when 'habit.checked' then 'habit_checkins'
    when 'habit.unchecked' then 'habit_checkins'
    when 'learning.item_completed' then 'learning_items_completed'
    when 'learning.item_reopened' then 'learning_items_completed'
    when 'review.submitted' then 'reviews_submitted'
    when 'review.reopened' then 'reviews_submitted'
    when 'practice.logged' then 'practices_logged'
    when 'practice.unlogged' then 'practices_logged'
    else null
  end;

  if v_metric is not null then
    v_delta := case
      when new.type in ('task.reopened','goal.reopened','goal.milestone_unreached','habit.unchecked','learning.item_reopened','review.reopened','practice.unlogged')
        then case when v_reverses_key is null then 0 else -1 end
      else 1
    end;
    if v_delta <> 0 then
      insert into public.progress_daily(user_id,local_date,module,metric,value)
      values (new.user_id,v_projection_date,new.module,v_metric,greatest(0,v_delta))
      on conflict (user_id,local_date,module,metric) do update
        set value = greatest(0, public.progress_daily.value + v_delta),
            updated_at = now();
    end if;
  end if;

  if new.type = 'focus.ended' then
    insert into public.progress_daily(user_id,local_date,module,metric,value)
    values (new.user_id,new.local_date,new.module,'focus_minutes',greatest(0,coalesce((new.payload->>'minutes')::bigint,0)))
    on conflict (user_id,local_date,module,metric) do update
      set value = public.progress_daily.value + excluded.value, updated_at = now();
    insert into public.progress_daily(user_id,local_date,module,metric,value)
    values (new.user_id,new.local_date,new.module,'focus_sessions',1)
    on conflict (user_id,local_date,module,metric) do update
      set value = public.progress_daily.value + 1, updated_at = now();
  elsif new.type = 'learning.study_logged' then
    insert into public.progress_daily(user_id,local_date,module,metric,value)
    values (new.user_id,new.local_date,new.module,'study_minutes',greatest(0,coalesce((new.payload->>'minutes')::bigint,0)))
    on conflict (user_id,local_date,module,metric) do update
      set value = public.progress_daily.value + excluded.value, updated_at = now();
  end if;

  if new.source = 'import' then
    perform atlas_private.evaluate_achievements(new.user_id);
    return new;
  end if;

  if v_reverses_key is not null then
    select category, points, local_date
      into v_original_xp_category, v_original_xp_points, v_original_xp_date
      from public.xp_ledger
     where user_id = new.user_id
       and source_event_key = v_reverses_key
       and is_legacy = false
       and points > 0
     order by id desc
     limit 1;

    if v_original_xp_points is not null and v_original_xp_points > 0 then
      insert into public.xp_ledger(user_id,event_key,source_event_key,category,points,local_date,awarded_at,is_legacy,reversal_of)
      values (new.user_id,'reversal:' || new.event_key,v_reverses_key,v_original_xp_category,-v_original_xp_points,v_original_xp_date,now(),false,v_reverses_key)
      on conflict (user_id,event_key) do nothing;
    end if;
    perform atlas_private.evaluate_achievements(new.user_id);
    return new;
  end if;

  case new.type
    when 'task.completed' then
      v_category := 'tasks';
      v_points := case when coalesce((new.payload->>'goalLinked')::boolean,false) then 10 else 5 end;
      v_cap := 100;
    when 'goal.completed' then
      v_category := 'goals'; v_points := 25; v_cap := 100;
    when 'goal.milestone_reached' then
      v_category := 'goals'; v_points := 10; v_cap := 100;
    when 'focus.ended' then
      v_category := 'focus';
      v_points := floor(coalesce((new.payload->>'minutes')::numeric,0) / 5)::integer;
      v_cap := 120;
    when 'habit.checked' then
      v_category := 'habits'; v_points := 3; v_cap := 60;
    when 'learning.item_completed' then
      v_category := 'learning'; v_points := 8; v_cap := 80;
    when 'review.submitted' then
      v_category := 'review'; v_points := 15; v_cap := 30;
    when 'challenge.completed' then
      v_category := 'challenge'; v_points := 50; v_cap := 50;
    else
      v_category := null; v_points := 0; v_cap := 0;
  end case;

  if v_category is not null and v_points > 0 and v_cap > 0 then
    begin
      select (setting_row.setting->>'value')::jsonb
        into v_xp_modules
        from public.personal_os_workspaces as workspace
        cross join lateral jsonb_array_elements(
          coalesce(workspace.data->'tables'->'settings','[]'::jsonb)
        ) as setting_row(setting)
       where workspace.user_id = new.user_id
         and setting_row.setting->>'key' = 'xp_enabled_modules'
       limit 1;
    exception when invalid_text_representation then
      v_xp_modules := null;
    end;

    if jsonb_typeof(v_xp_modules) = 'array' and not (v_xp_modules ? new.module) then
      perform atlas_private.evaluate_achievements(new.user_id);
      return new;
    end if;
    select coalesce(sum(points),0)::integer into v_earned
      from public.xp_ledger
     where user_id = new.user_id and category = v_category and local_date = new.local_date;
    v_points := least(v_points,greatest(0,v_cap-v_earned));
    if v_points > 0 then
      insert into public.xp_ledger(user_id,event_key,source_event_key,category,points,local_date,awarded_at,is_legacy)
      values (new.user_id,new.event_key,new.event_key,v_category,v_points,new.local_date,now(),false)
      on conflict (user_id,event_key) do nothing;
    end if;
  end if;

  perform atlas_private.evaluate_achievements(new.user_id);
  return new;
end;
$function$

