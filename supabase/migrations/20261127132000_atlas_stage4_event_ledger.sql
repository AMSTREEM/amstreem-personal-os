-- Stage 4A: append-only event ledger and shared progress/XP projections.
-- Historical facts are imported without XP awards. No Qur'an or faith tables are read.

create table if not exists public.activity_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null check (length(event_key) between 8 and 240),
  type text not null check (type = any (array[
    'task.completed','task.reopened',
    'focus.ended',
    'goal.completed','goal.reopened','goal.milestone_reached','goal.milestone_unreached',
    'habit.checked','habit.unchecked',
    'learning.item_completed','learning.item_reopened','learning.study_logged',
    'review.submitted','review.reopened',
    'practice.logged','practice.unlogged',
    'challenge.completed'
  ]::text[])),
  module text not null check (module = any (array[
    'residence','actions','goals','calendar','habits','learning','growth','values'
  ]::text[])),
  entity_id text check (entity_id is null or length(entity_id) between 1 and 160),
  occurred_at timestamptz not null,
  local_date date not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  source text not null default 'user' check (source = any (array['user','system','import']::text[])),
  created_at timestamptz not null default now(),
  unique (user_id, event_key)
);
create index if not exists activity_events_user_date_idx
  on public.activity_events(user_id, local_date desc, occurred_at desc);
create index if not exists activity_events_user_entity_idx
  on public.activity_events(user_id, module, entity_id, occurred_at desc);

alter table public.activity_events enable row level security;
alter table public.activity_events force row level security;
drop policy if exists "activity events owner read" on public.activity_events;
create policy "activity events owner read" on public.activity_events
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "activity events owner append" on public.activity_events;
revoke all on public.activity_events from anon, authenticated;
grant select on public.activity_events to authenticated;
grant select, insert on public.activity_events to service_role;
grant usage, select on sequence public.activity_events_id_seq to service_role;

create table if not exists public.progress_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  module text not null check (module = any (array[
    'residence','actions','goals','calendar','habits','learning','growth','values'
  ]::text[])),
  metric text not null check (metric ~ '^[a-z][a-z0-9_]{1,63}$'),
  value bigint not null check (value >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date, module, metric)
);
create index if not exists progress_daily_user_metric_date_idx
  on public.progress_daily(user_id, metric, local_date desc);
alter table public.progress_daily enable row level security;
alter table public.progress_daily force row level security;
drop policy if exists "progress daily owner read" on public.progress_daily;
create policy "progress daily owner read" on public.progress_daily
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.progress_daily from anon, authenticated;
grant select on public.progress_daily to authenticated;

create table if not exists public.xp_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  source_event_key text,
  category text not null check (length(category) between 1 and 40),
  points integer not null check (points <> 0),
  local_date date not null,
  awarded_at timestamptz not null default now(),
  is_legacy boolean not null default false,
  reversal_of text,
  unique (user_id, event_key)
);
create index if not exists xp_ledger_user_date_idx
  on public.xp_ledger(user_id, local_date desc, category);
alter table public.xp_ledger enable row level security;
alter table public.xp_ledger force row level security;
drop policy if exists "xp ledger owner read" on public.xp_ledger;
create policy "xp ledger owner read" on public.xp_ledger
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.xp_ledger from anon, authenticated;
grant select on public.xp_ledger to authenticated, service_role;

create table if not exists public.atlas_achievement_definitions (
  id text primary key,
  title text not null,
  description text not null,
  icon text not null,
  metric text not null,
  target bigint not null check (target > 0),
  tier text not null check (tier = any (array['standard','rare','epic']::text[])),
  secret boolean not null default false
);
create table if not exists public.atlas_achievement_unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null references public.atlas_achievement_definitions(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);
alter table public.atlas_achievement_definitions enable row level security;
alter table public.atlas_achievement_definitions force row level security;
drop policy if exists "achievement definitions authenticated read" on public.atlas_achievement_definitions;
create policy "achievement definitions authenticated read" on public.atlas_achievement_definitions
  for select to authenticated using (true);
alter table public.atlas_achievement_unlocks enable row level security;
alter table public.atlas_achievement_unlocks force row level security;
drop policy if exists "achievement unlocks owner read" on public.atlas_achievement_unlocks;
create policy "achievement unlocks owner read" on public.atlas_achievement_unlocks
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.atlas_achievement_definitions, public.atlas_achievement_unlocks from anon, authenticated;
grant select on public.atlas_achievement_definitions, public.atlas_achievement_unlocks to authenticated;

insert into public.atlas_achievement_definitions(id,title,description,icon,metric,target,tier,secret)
values
  ('first-finish','First things first','Complete your first task','✓','tasks_completed',1,'standard',false),
  ('task-ten','Getting things done','Complete 10 tasks','↗','tasks_completed',10,'standard',false),
  ('task-fifty','Reliable executor','Complete 50 tasks','◆','tasks_completed',50,'rare',false),
  ('focus-hour','One focused hour','Invest 60 minutes in focus','◷','focus_minutes',60,'standard',false),
  ('deep-work','Return to deep work','Complete 10 focus sessions','◎','focus_sessions',10,'standard',false),
  ('first-lesson','Curiosity in motion','Complete your first lesson','◇','learning_items_completed',1,'standard',false),
  ('five-lessons','A learner by practice','Complete 5 lessons','✦','learning_items_completed',5,'rare',false),
  ('first-goal','A promise kept','Complete your first goal','⌖','goals_completed',1,'standard',false),
  ('ritual-week','Small promises','Record 7 daily ritual check-ins','✳','habit_checkins',7,'standard',false),
  ('ritual-month','Consistency, compounded','Record 30 daily ritual check-ins','✧','habit_checkins',30,'rare',false)
on conflict (id) do update set
  title=excluded.title, description=excluded.description, icon=excluded.icon,
  metric=excluded.metric, target=excluded.target, tier=excluded.tier, secret=excluded.secret;

create schema if not exists atlas_private;
revoke all on schema atlas_private from public, anon, authenticated;

create or replace function atlas_private.prepare_activity_event_reversal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original_type text;
  v_original_key text;
begin
  if auth.uid() is distinct from new.user_id then
    raise exception 'event_owner_mismatch' using errcode = '42501';
  end if;

  v_original_type := case new.type
    when 'task.reopened' then 'task.completed'
    when 'goal.reopened' then 'goal.completed'
    when 'goal.milestone_unreached' then 'goal.milestone_reached'
    when 'habit.unchecked' then 'habit.checked'
    when 'learning.item_reopened' then 'learning.item_completed'
    when 'review.reopened' then 'review.submitted'
    when 'practice.unlogged' then 'practice.logged'
    else null
  end;
  if v_original_type is null then return new; end if;

  select e.event_key into v_original_key
    from public.activity_events e
   where e.user_id = new.user_id
     and e.type = v_original_type
     and e.entity_id is not distinct from new.entity_id
     and (
       new.type <> 'habit.unchecked'
       or e.payload ->> 'logDate' = new.payload ->> 'logDate'
     )
     and (
       new.type <> 'review.reopened'
       or e.payload ->> 'periodStart' = new.payload ->> 'periodStart'
     )
     and not exists (
       select 1 from public.activity_events reversal
        where reversal.user_id = e.user_id
          and reversal.payload ->> 'reversesEventKey' = e.event_key
     )
   order by e.occurred_at desc, e.created_at desc, e.id desc
   limit 1;

  if v_original_key is not null then
    new.payload := new.payload || jsonb_build_object('reversesEventKey', v_original_key);
  end if;
  return new;
end;
$$;

create or replace function atlas_private.reject_activity_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'activity_events_is_append_only' using errcode = '55000';
end;
$$;

create or replace function atlas_private.evaluate_achievements(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'achievement_owner_mismatch' using errcode = '42501';
  end if;

  insert into public.atlas_achievement_unlocks(user_id, achievement_id)
  select p_user_id, d.id
    from public.atlas_achievement_definitions d
    join (
      select metric, sum(value) as total
        from public.progress_daily
       where user_id = p_user_id
       group by metric
    ) totals on totals.metric = d.metric and totals.total >= d.target
  on conflict (user_id, achievement_id) do nothing;
end;
$$;

create or replace function atlas_private.apply_activity_event_projection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

create or replace function atlas_private.rebuild_progress_daily(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'progress_owner_mismatch' using errcode = '42501';
  end if;

  delete from public.progress_daily where user_id = p_user_id;

  insert into public.progress_daily(user_id,local_date,module,metric,value)
  with deltas as (
    select user_id,local_date,module,'tasks_completed'::text metric,1::bigint delta
      from public.activity_events where user_id=p_user_id and type='task.completed'
    union all
    select original.user_id,original.local_date,original.module,'tasks_completed',-1::bigint
      from public.activity_events reversal
      join public.activity_events original on original.user_id=reversal.user_id and original.event_key=reversal.payload->>'reversesEventKey'
     where reversal.user_id=p_user_id and reversal.type='task.reopened'
    union all
    select user_id,local_date,module,'goals_completed',1
      from public.activity_events where user_id=p_user_id and type='goal.completed'
    union all
    select original.user_id,original.local_date,original.module,'goals_completed',-1
      from public.activity_events reversal join public.activity_events original on original.user_id=reversal.user_id and original.event_key=reversal.payload->>'reversesEventKey'
     where reversal.user_id=p_user_id and reversal.type='goal.reopened'
    union all
    select user_id,local_date,module,'milestones_reached',1
      from public.activity_events where user_id=p_user_id and type='goal.milestone_reached'
    union all
    select original.user_id,original.local_date,original.module,'milestones_reached',-1
      from public.activity_events reversal join public.activity_events original on original.user_id=reversal.user_id and original.event_key=reversal.payload->>'reversesEventKey'
     where reversal.user_id=p_user_id and reversal.type='goal.milestone_unreached'
    union all
    select user_id,local_date,module,'habit_checkins',1
      from public.activity_events where user_id=p_user_id and type='habit.checked'
    union all
    select original.user_id,original.local_date,original.module,'habit_checkins',-1
      from public.activity_events reversal join public.activity_events original on original.user_id=reversal.user_id and original.event_key=reversal.payload->>'reversesEventKey'
     where reversal.user_id=p_user_id and reversal.type='habit.unchecked'
    union all
    select user_id,local_date,module,'learning_items_completed',1
      from public.activity_events where user_id=p_user_id and type='learning.item_completed'
    union all
    select original.user_id,original.local_date,original.module,'learning_items_completed',-1
      from public.activity_events reversal join public.activity_events original on original.user_id=reversal.user_id and original.event_key=reversal.payload->>'reversesEventKey'
     where reversal.user_id=p_user_id and reversal.type='learning.item_reopened'
    union all
    select user_id,local_date,module,'reviews_submitted',1
      from public.activity_events where user_id=p_user_id and type='review.submitted'
    union all
    select original.user_id,original.local_date,original.module,'reviews_submitted',-1
      from public.activity_events reversal join public.activity_events original on original.user_id=reversal.user_id and original.event_key=reversal.payload->>'reversesEventKey'
     where reversal.user_id=p_user_id and reversal.type='review.reopened'
    union all
    select user_id,local_date,module,'practices_logged',1
      from public.activity_events where user_id=p_user_id and type='practice.logged'
    union all
    select original.user_id,original.local_date,original.module,'practices_logged',-1
      from public.activity_events reversal join public.activity_events original on original.user_id=reversal.user_id and original.event_key=reversal.payload->>'reversesEventKey'
     where reversal.user_id=p_user_id and reversal.type='practice.unlogged'
    union all
    select user_id,local_date,module,'focus_minutes',greatest(0,coalesce((payload->>'minutes')::bigint,0))
      from public.activity_events where user_id=p_user_id and type='focus.ended'
    union all
    select user_id,local_date,module,'focus_sessions',1
      from public.activity_events where user_id=p_user_id and type='focus.ended'
    union all
    select user_id,local_date,module,'study_minutes',greatest(0,coalesce((payload->>'minutes')::bigint,0))
      from public.activity_events where user_id=p_user_id and type='learning.study_logged'
  )
  select user_id,local_date,module,metric,sum(delta)
    from deltas
   group by user_id,local_date,module,metric
  having sum(delta) > 0;

  perform atlas_private.evaluate_achievements(p_user_id);
end;
$$;

drop trigger if exists activity_events_append_only on public.activity_events;
create trigger activity_events_append_only
before update or delete on public.activity_events
for each row execute function atlas_private.reject_activity_event_mutation();
drop trigger if exists activity_events_prepare_reversal on public.activity_events;
create trigger activity_events_prepare_reversal
before insert on public.activity_events
for each row execute function atlas_private.prepare_activity_event_reversal();
drop trigger if exists activity_events_apply_projection on public.activity_events;
create trigger activity_events_apply_projection
after insert on public.activity_events
for each row execute function atlas_private.apply_activity_event_projection();

revoke all on function atlas_private.prepare_activity_event_reversal() from public, anon, authenticated;
revoke all on function atlas_private.reject_activity_event_mutation() from public, anon, authenticated;
revoke all on function atlas_private.evaluate_achievements(uuid) from public, anon, authenticated;
revoke all on function atlas_private.apply_activity_event_projection() from public, anon, authenticated;
revoke all on function atlas_private.rebuild_progress_daily(uuid) from public, anon, authenticated;

-- Preserve existing achievement unlocks from the workspace snapshot.
insert into public.atlas_achievement_unlocks(user_id,achievement_id,unlocked_at)
select w.user_id,a.value->>'achievement_id',
       coalesce(nullif(a.value->>'unlocked_at','')::timestamptz,w.updated_at)
from public.personal_os_workspaces w
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(w.data #> '{tables,achievement_unlocks}')='array'
       then w.data #> '{tables,achievement_unlocks}' else '[]'::jsonb end
) a(value)
join public.atlas_achievement_definitions d on d.id=a.value->>'achievement_id'
where coalesce(a.value->>'achievement_id','')<>''
on conflict (user_id,achievement_id) do nothing;

-- Backfill dated, non-faith activity as imported facts; imported facts never award XP.
alter table public.activity_events disable trigger activity_events_prepare_reversal;
alter table public.activity_events disable trigger activity_events_apply_projection;

insert into public.activity_events(user_id,event_key,type,module,entity_id,occurred_at,local_date,payload,source)
select w.user_id,'legacy:session:'||(x.value->>'id'),'focus.ended','actions',x.value->>'id',
       coalesce(nullif(x.value->>'created_at','')::timestamptz,(x.value->>'session_date')::date::timestamptz,w.updated_at),
       (x.value->>'session_date')::date,jsonb_build_object('minutes',(x.value->>'minutes')::integer),'import'
from public.personal_os_workspaces w
cross join lateral jsonb_array_elements(case when jsonb_typeof(w.data #> '{tables,sessions}')='array' then w.data #> '{tables,sessions}' else '[]'::jsonb end) x(value)
where coalesce(x.value->>'id','')<>'' and coalesce(x.value->>'session_kind','focus')='focus'
  and coalesce((x.value->>'minutes')::integer,0)>0 and (x.value->>'session_date') ~ '^\d{4}-\d{2}-\d{2}$'
on conflict (user_id,event_key) do nothing;

insert into public.activity_events(user_id,event_key,type,module,entity_id,occurred_at,local_date,payload,source)
select w.user_id,'legacy:habit:'||(x.value->>'habit_id')||':'||(x.value->>'log_date'),
       'habit.checked','habits',x.value->>'habit_id',
       coalesce(nullif(x.value->>'created_at','')::timestamptz,(x.value->>'log_date')::date::timestamptz,w.updated_at),
       (x.value->>'log_date')::date,jsonb_build_object('logDate',x.value->>'log_date'),'import'
from public.personal_os_workspaces w
cross join lateral jsonb_array_elements(case when jsonb_typeof(w.data #> '{tables,habit_logs}')='array' then w.data #> '{tables,habit_logs}' else '[]'::jsonb end) x(value)
where coalesce(x.value->>'habit_id','')<>'' and (x.value->>'log_date') ~ '^\d{4}-\d{2}-\d{2}$'
on conflict (user_id,event_key) do nothing;

insert into public.activity_events(user_id,event_key,type,module,entity_id,occurred_at,local_date,payload,source)
select w.user_id,'legacy:study:'||(x.value->>'id'),
       'learning.study_logged','learning',x.value->>'lesson_id',
       coalesce(nullif(x.value->>'created_at','')::timestamptz,(x.value->>'log_date')::date::timestamptz,w.updated_at),
       (x.value->>'log_date')::date,jsonb_build_object('minutes',(x.value->>'minutes')::integer),'import'
from public.personal_os_workspaces w
cross join lateral jsonb_array_elements(case when jsonb_typeof(w.data #> '{tables,learning_study_logs}')='array' then w.data #> '{tables,learning_study_logs}' else '[]'::jsonb end) x(value)
where coalesce(x.value->>'id','')<>'' and coalesce((x.value->>'minutes')::integer,0)>0
  and (x.value->>'log_date') ~ '^\d{4}-\d{2}-\d{2}$'
on conflict (user_id,event_key) do nothing;

insert into public.activity_events(user_id,event_key,type,module,entity_id,occurred_at,local_date,payload,source)
select w.user_id,'legacy:practice:'||(x.value->>'id'),
       'practice.logged','values',x.value->>'id',
       coalesce(nullif(x.value->>'created_at','')::timestamptz,(x.value->>'record_date')::date::timestamptz,w.updated_at),
       (x.value->>'record_date')::date,jsonb_build_object('practiceType',x.value->>'record_type'),'import'
from public.personal_os_workspaces w
cross join lateral jsonb_array_elements(case when jsonb_typeof(w.data #> '{tables,rhythm_records}')='array' then w.data #> '{tables,rhythm_records}' else '[]'::jsonb end) x(value)
where coalesce(x.value->>'id','')<>'' and x.value->>'tradition'='general'
  and x.value->>'status'='completed'
  and x.value->>'record_type'=any(array['daily_intention','wisdom_note','evening_reflection']::text[])
  and (x.value->>'record_date') ~ '^\d{4}-\d{2}-\d{2}$'
on conflict (user_id,event_key) do nothing;

insert into public.activity_events(user_id,event_key,type,module,entity_id,occurred_at,local_date,payload,source)
select w.user_id,'legacy:review:'||(x.value->>'period_type')||':'||(x.value->>'period_start'),
       'review.submitted','growth',(x.value->>'period_type')||':'||(x.value->>'period_start'),
       coalesce(nullif(x.value->>'updated_at','')::timestamptz,(x.value->>'period_start')::date::timestamptz,w.updated_at),
       coalesce((nullif(x.value->>'updated_at','')::timestamptz at time zone 'Africa/Lagos')::date,(x.value->>'period_start')::date),
       jsonb_build_object('periodType',x.value->>'period_type','periodStart',x.value->>'period_start'),'import'
from public.personal_os_workspaces w
cross join lateral jsonb_array_elements(case when jsonb_typeof(w.data #> '{tables,reviews}')='array' then w.data #> '{tables,reviews}' else '[]'::jsonb end) x(value)
where x.value->>'period_type'=any(array['daily','weekly']::text[])
  and coalesce(x.value->>'shutdown_complete','0')=any(array['1','true','t']::text[])
  and (x.value->>'period_start') ~ '^\d{4}-\d{2}-\d{2}$'
on conflict (user_id,event_key) do nothing;

alter table public.activity_events enable trigger activity_events_prepare_reversal;
alter table public.activity_events enable trigger activity_events_apply_projection;

do $$
declare workspace record;
begin
  for workspace in select distinct user_id from public.activity_events loop
    perform atlas_private.rebuild_progress_daily(workspace.user_id);
  end loop;
end;
$$;

-- Preserve existing XP exactly; these legacy awards do not originate from new events.
insert into public.xp_ledger(user_id,event_key,source_event_key,category,points,local_date,awarded_at,is_legacy)
select w.user_id,
       'legacy:'||(x.value->>'event_key'),
       x.value->>'event_key',
       case lower(coalesce(x.value->>'category','legacy'))
         when 'weekly challenge' then 'challenge'
         else left(lower(coalesce(x.value->>'category','legacy')),40)
       end,
       (x.value->>'points')::integer,
       coalesce(((nullif(x.value->>'awarded_at','')::timestamptz at time zone 'Africa/Lagos')::date),
                (w.updated_at at time zone 'Africa/Lagos')::date),
       coalesce(nullif(x.value->>'awarded_at','')::timestamptz,w.updated_at),
       true
from public.personal_os_workspaces w
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(w.data #> '{tables,xp_events}')='array'
       then w.data #> '{tables,xp_events}' else '[]'::jsonb end
) x(value)
where coalesce(x.value->>'event_key','')<>''
  and coalesce((x.value->>'points')::integer,0)>0
on conflict (user_id,event_key) do nothing;
