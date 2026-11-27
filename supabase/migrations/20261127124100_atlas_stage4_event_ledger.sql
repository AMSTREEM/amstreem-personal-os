-- Stage 4: append-only event ledger and shared progress/XP projections.
-- Staging-first. No workspace snapshot sections are removed or rewritten.

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
    'practice.logged',
    'challenge.completed'
  ]::text[])),
  module text not null check (module = any (array[
    'residence','actions','goals','calendar','habits','learning','growth','values'
  ]::text[])),
  entity_id text,
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
create policy "activity events owner append" on public.activity_events
  for insert to authenticated with check ((select auth.uid()) = user_id);
revoke all on public.activity_events from anon, authenticated;
grant select, insert on public.activity_events to authenticated;
grant usage, select on sequence public.activity_events_id_seq to authenticated;

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
  on public.xp_ledger(user_id, local_date desc, awarded_at desc);
create index if not exists xp_ledger_user_source_event_idx
  on public.xp_ledger(user_id, source_event_key);
alter table public.xp_ledger enable row level security;
alter table public.xp_ledger force row level security;
drop policy if exists "xp ledger owner read" on public.xp_ledger;
create policy "xp ledger owner read" on public.xp_ledger
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.xp_ledger from anon, authenticated;
grant select on public.xp_ledger to authenticated;

create table if not exists public.atlas_achievement_definitions (
  id text primary key,
  title text not null,
  description text not null,
  icon text not null,
  metric text not null,
  target bigint not null check (target > 0),
  tier text not null default 'standard',
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
alter table public.atlas_achievement_unlocks enable row level security;
alter table public.atlas_achievement_unlocks force row level security;
drop policy if exists "achievement definitions authenticated read" on public.atlas_achievement_definitions;
create policy "achievement definitions authenticated read" on public.atlas_achievement_definitions
  for select to authenticated using (true);
drop policy if exists "achievement unlocks owner read" on public.atlas_achievement_unlocks;
create policy "achievement unlocks owner read" on public.atlas_achievement_unlocks
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.atlas_achievement_definitions from anon, authenticated;
revoke all on public.atlas_achievement_unlocks from anon, authenticated;
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
    else null
  end;

  if v_original_type is null then
    return new;
  end if;

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
       select 1 from public.activity_events r
        where r.user_id = e.user_id
          and r.payload ->> 'reversesEventKey' = e.event_key
     )
   order by e.occurred_at desc, e.created_at desc, e.id desc
   limit 1;

  if v_original_key is not null then
    new.payload := new.payload || jsonb_build_object('reversesEventKey', v_original_key);
  end if;
  return new;
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
    else null
  end;

  if v_metric is not null then
    v_delta := case
      when new.type in ('task.reopened','goal.reopened','goal.milestone_unreached','habit.unchecked','learning.item_reopened','review.reopened') then -1
      else 1
    end;
    insert into public.progress_daily(user_id,local_date,module,metric,value)
    values (new.user_id,v_projection_date,new.module,v_metric,greatest(0,v_delta))
    on conflict (user_id,local_date,module,metric) do update
      set value = greatest(0, public.progress_daily.value + v_delta),
          updated_at = now();
  end if;

  if new.type = 'focus.ended' then
    insert into public.progress_daily(user_id,local_date,module,metric,value)
    values
      (new.user_id,new.local_date,new.module,'focus_minutes',greatest(0,coalesce((new.payload->>'minutes')::bigint,0))),
      (new.user_id,new.local_date,new.module,'focus_sessions',1)
    on conflict (user_id,local_date,module,metric) do update
      set value = public.progress_daily.value + excluded.value,
          updated_at = now();
  elsif new.type = 'learning.study_logged' then
    insert into public.progress_daily(user_id,local_date,module,metric,value)
    values (new.user_id,new.local_date,new.module,'study_minutes',greatest(0,coalesce((new.payload->>'minutes')::bigint,0)))
    on conflict (user_id,local_date,module,metric) do update
      set value = public.progress_daily.value + excluded.value,
          updated_at = now();
  end if;

  -- Imported facts contribute to progress, but never award XP.
  if new.source = 'import' then
    perform atlas_private.evaluate_achievements(new.user_id);
    return new;
  end if;

  -- Reversals create a compensating XP row; the original award is never edited.
  if v_reverses_key is not null then
    select category, points, local_date
      into v_original_xp_category, v_original_xp_points, v_original_xp_date
      from public.xp_ledger
     where user_id = new.user_id
       and source_event_key = v_reverses_key
       and points > 0
       and is_legacy = false
     order by awarded_at desc, id desc
     limit 1;

    if v_original_xp_points is not null then
      insert into public.xp_ledger(
        user_id,event_key,source_event_key,category,points,local_date,awarded_at,is_legacy,reversal_of
      ) values (
        new.user_id,'reversal:' || new.event_key,v_reverses_key,
        v_original_xp_category,-v_original_xp_points,v_original_xp_date,now(),false,v_reverses_key
      ) on conflict (user_id,event_key) do nothing;
    end if;
  else
    v_category := case new.type
      when 'task.completed' then 'tasks'
      when 'focus.ended' then 'focus'
      when 'habit.checked' then 'habits'
      when 'learning.item_completed' then 'learning'
      when 'review.submitted' then 'review'
      when 'challenge.completed' then 'challenge'
      else null
    end;

    v_points := case new.type
      when 'task.completed' then case when coalesce((new.payload->>'goalLinked')::boolean,false) then 10 else 5 end
      when 'focus.ended' then greatest(0,coalesce((new.payload->>'minutes')::integer,0) / 5)
      when 'habit.checked' then 3
      when 'learning.item_completed' then 8
      when 'review.submitted' then 15
      when 'challenge.completed' then 50
      else 0
    end;

    v_cap := case new.type
      when 'task.completed' then 100
      when 'focus.ended' then 120
      when 'habit.checked' then 60
      when 'learning.item_completed' then 80
      when 'review.submitted' then 30
      when 'challenge.completed' then 50
      else 0
    end;

    if v_points > 0 and v_category is not null then
      select coalesce(sum(points),0)::integer into v_earned
        from public.xp_ledger
       where user_id = new.user_id and category = v_category and local_date = new.local_date;
      v_points := least(v_points,greatest(0,v_cap-v_earned));
      if v_points > 0 then
        insert into public.xp_ledger(
          user_id,event_key,source_event_key,category,points,local_date,awarded_at,is_legacy
        ) values (
          new.user_id,new.event_key,new.event_key,v_category,v_points,new.local_date,now(),false
        ) on conflict (user_id,event_key) do nothing;
      end if;
    end if;
  end if;

  perform atlas_private.evaluate_achievements(new.user_id);
  return new;
end;
$$;

create trigger activity_events_prepare_reversal
before insert on public.activity_events
for each row execute function atlas_private.prepare_activity_event_reversal();

create trigger activity_events_apply_projection
after insert on public.activity_events
for each row execute function atlas_private.apply_activity_event_projection();

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
      join public.activity_events original
        on original.user_id=reversal.user_id
       and original.event_key=reversal.payload->>'reversesEventKey'
     where reversal.user_id=p_user_id and reversal.type='task.reopened'
    union all
    select user_id,local_date,module,'goals_completed',1
      from public.activity_events where user_id=p_user_id and type='goal.completed'
    union all
    select original.user_id,original.local_date,original.module,'goals_completed',-1
      from public.activity_events reversal join public.activity_events original
        on original.user_id=reversal.user_id and original.event_key=reversal.payload->>'reversesEventKey'
     where reversal.user_id=p_user_id and reversal.type='goal.reopened'
    union all
    select user_id,local_date,module,'milestones_reached',1
      from public.activity_events where user_id=p_user_id and type='goal.milestone_reached'
    union all
    select original.user_id,original.local_date,original.module,'milestones_reached',-1
      from public.activity_events reversal join public.activity_events original
        on original.user_id=reversal.user_id and original.event_key=reversal.payload->>'reversesEventKey'
     where reversal.user_id=p_user_id and reversal.type='goal.milestone_unreached'
    union all
    select user_id,local_date,module,'habit_checkins',1
      from public.activity_events where user_id=p_user_id and type='habit.checked'
    union all
    select original.user_id,original.local_date,original.module,'habit_checkins',-1
      from public.activity_events reversal join public.activity_events original
        on original.user_id=reversal.user_id and original.event_key=reversal.payload->>'reversesEventKey'
     where reversal.user_id=p_user_id and reversal.type='habit.unchecked'
    union all
    select user_id,local_date,module,'learning_items_completed',1
      from public.activity_events where user_id=p_user_id and type='learning.item_completed'
    union all
    select original.user_id,original.local_date,original.module,'learning_items_completed',-1
      from public.activity_events reversal join public.activity_events original
        on original.user_id=reversal.user_id and original.event_key=reversal.payload->>'reversesEventKey'
     where reversal.user_id=p_user_id and reversal.type='learning.item_reopened'
    union all
    select user_id,local_date,module,'reviews_submitted',1
      from public.activity_events where user_id=p_user_id and type='review.submitted'
    union all
    select original.user_id,original.local_date,original.module,'reviews_submitted',-1
      from public.activity_events reversal join public.activity_events original
        on original.user_id=reversal.user_id and original.event_key=reversal.payload->>'reversesEventKey'
     where reversal.user_id=p_user_id and reversal.type='review.reopened'
    union all
    select user_id,local_date,module,'practices_logged',1
      from public.activity_events where user_id=p_user_id and type='practice.logged'
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

create or replace function public.commit_workspace_with_events(
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
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_events is null or jsonb_typeof(p_events) <> 'array' then
    raise exception 'invalid_event_batch' using errcode = '22023';
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

revoke all on function public.commit_workspace_with_events(bigint,jsonb,integer,text,text,boolean,text,jsonb) from public, anon;
grant execute on function public.commit_workspace_with_events(bigint,jsonb,integer,text,text,boolean,text,jsonb) to authenticated;

-- Preserve existing workspace XP exactly; these are legacy awards, not new events.
insert into public.xp_ledger(
  user_id,event_key,source_event_key,category,points,local_date,awarded_at,is_legacy
)
select
  w.user_id,
  'legacy:' || (x.value->>'event_key'),
  x.value->>'event_key',
  left(lower(coalesce(x.value->>'category','legacy')),40),
  (x.value->>'points')::integer,
  coalesce(
    ((nullif(x.value->>'awarded_at','')::timestamptz at time zone 'Africa/Lagos')::date),
    (w.updated_at at time zone 'Africa/Lagos')::date
  ),
  coalesce(nullif(x.value->>'awarded_at','')::timestamptz,w.updated_at),
  true
from public.personal_os_workspaces w
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(w.data #> '{tables,xp_events}') = 'array'
      then w.data #> '{tables,xp_events}'
    else '[]'::jsonb
  end
) as x(value)
where coalesce(x.value->>'event_key','') <> ''
  and coalesce((x.value->>'points')::integer,0) > 0
on conflict (user_id,event_key) do nothing;

-- Revoke any accidental default exposure of the new tables from anonymous users.
revoke all on public.activity_events, public.progress_daily, public.xp_ledger,
  public.atlas_achievement_definitions, public.atlas_achievement_unlocks from anon;
