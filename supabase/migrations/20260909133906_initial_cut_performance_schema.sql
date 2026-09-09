-- CUT Performance — initial normalized cloud schema.
-- All application data is private to the authenticated owner through RLS.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  experience_years numeric(4,1) not null default 0 check (experience_years between 0 and 80),
  training_level text not null default 'intermediate' check (training_level in ('beginner', 'intermediate', 'advanced')),
  height_cm numeric(5,2) not null check (height_cm between 80 and 260),
  current_weight_kg numeric(6,2) not null check (current_weight_kg between 20 and 500),
  body_fat_percent numeric(5,2) not null check (body_fat_percent between 2 and 75),
  onboarding_complete boolean not null default false,
  weekly_strategy text not null default 'flexible' check (weekly_strategy in ('flexible', 'even', 'free-meal')),
  app_schema_version integer not null default 1 check (app_schema_version > 0),
  cloud_revision bigint not null default 0 check (cloud_revision >= 0),
  active_goal_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.goals (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_id text not null,
  name text not null check (char_length(name) between 1 and 160),
  type text not null check (type in ('fat-loss', 'lean-gain', 'maintenance', 'strength', 'endurance', 'event')),
  status text not null check (status in ('active', 'completed', 'cancelled')),
  start_date date not null,
  target_date date,
  ended_at date,
  reference_weight_kg numeric(6,2) not null check (reference_weight_kg between 20 and 500),
  target_weight_kg numeric(6,2) not null check (target_weight_kg between 20 and 500),
  reference_body_fat_percent numeric(5,2) not null check (reference_body_fat_percent between 2 and 75),
  target_body_fat_percent numeric(5,2) check (target_body_fat_percent between 2 and 75),
  max_body_fat_increase_percent numeric(5,2) check (max_body_fat_increase_percent between 0 and 30),
  height_cm numeric(5,2) not null check (height_cm between 80 and 260),
  training_level text not null check (training_level in ('beginner', 'intermediate', 'advanced')),
  target_weight_change_kg_per_week numeric(5,2) not null check (target_weight_change_kg_per_week between -3 and 3),
  priorities text[] not null default '{}',
  endurance_discipline text check (endurance_discipline in ('general', 'running', 'cycling', 'triathlon', 'ironman')),
  event_name text,
  strength_exercise text,
  strength_target_kg numeric(7,2) check (strength_target_kg > 0),
  objective_note text,
  sync_token uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id),
  unique (id, user_id),
  check (target_date is null or target_date >= start_date),
  check (ended_at is null or ended_at >= start_date),
  check (priorities <@ array['body-composition', 'strength', 'cardio', 'explosiveness', 'event']::text[])
);

alter table public.profiles
  add constraint profiles_active_goal_id_fkey
  foreign key (active_goal_id) references public.goals(id) on delete set null;

create table public.calculation_settings (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal_id bigint not null,
  calculation_version text not null,
  base_calories integer not null check (base_calories between 800 and 10000),
  target_steps integer not null check (target_steps between 0 and 100000),
  walk_kcal_per_1000 numeric(6,2) not null check (walk_kcal_per_1000 between 0 and 250),
  run_kcal_per_kg_km numeric(5,3) not null check (run_kcal_per_kg_km between 0 and 5),
  run_cadence_spm numeric(6,2) not null check (run_cadence_spm between 30 and 300),
  reintegration_rate numeric(4,3) not null check (reintegration_rate between 0 and 1),
  positive_cap integer not null check (positive_cap between 0 and 10000),
  negative_cap integer not null check (negative_cap between 0 and 10000),
  rounding_step integer not null check (rounding_step between 1 and 500),
  sync_token uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (goal_id, user_id),
  foreign key (goal_id, user_id) references public.goals(id, user_id) on delete cascade
);

create table public.goal_day_plans (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal_id bigint not null,
  day_type text not null check (day_type in ('upper', 'lower', 'shoulders-arms', 'rest')),
  calories integer not null check (calories between 800 and 10000),
  steps integer not null check (steps between 0 and 100000),
  sync_token uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (goal_id, day_type),
  foreign key (goal_id, user_id) references public.goals(id, user_id) on delete cascade
);

create table public.custom_exercises (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_id text not null,
  name text not null check (char_length(name) between 1 and 180),
  equipment_id text not null,
  load_convention text not null check (load_convention in ('total', 'per-dumbbell', 'machine', 'bodyweight', 'assisted', 'unknown')),
  muscle_group text,
  aliases text[] not null default '{}',
  movement_family text,
  muscle_contributions jsonb not null default '[]'::jsonb check (jsonb_typeof(muscle_contributions) = 'array'),
  laterality text check (laterality in ('bilateral', 'unilateral')),
  default_rest_seconds integer check (default_rest_seconds between 0 and 3600),
  favourite boolean not null default false,
  archived boolean not null default false,
  sync_token uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id),
  unique (id, user_id)
);

create table public.training_templates (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_id text not null,
  name text not null check (char_length(name) between 1 and 180),
  short_name text not null check (char_length(short_name) between 1 and 80),
  description text,
  day_type text not null check (day_type in ('upper', 'lower', 'shoulders-arms')),
  template_version integer not null default 1 check (template_version > 0),
  archived boolean not null default false,
  sync_token uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id),
  unique (id, user_id)
);

create table public.template_exercises (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  template_id bigint not null,
  local_id text not null,
  exercise_local_id text,
  position integer not null check (position >= 0),
  name text not null,
  target text not null default '',
  note text,
  equipment_id text,
  load_convention text check (load_convention in ('total', 'per-dumbbell', 'machine', 'bodyweight', 'assisted', 'unknown')),
  set_count integer check (set_count between 0 and 100),
  reps_min integer check (reps_min between 0 and 1000),
  reps_max integer check (reps_max between 0 and 1000),
  target_rir numeric(4,1) check (target_rir between -10 and 20),
  rest_seconds integer check (rest_seconds between 0 and 3600),
  movement_family text,
  muscle_contributions jsonb not null default '[]'::jsonb check (jsonb_typeof(muscle_contributions) = 'array'),
  laterality text check (laterality in ('bilateral', 'unilateral')),
  sync_token uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, local_id),
  foreign key (template_id, user_id) references public.training_templates(id, user_id) on delete cascade,
  check (reps_max is null or reps_min is null or reps_max >= reps_min)
);

create table public.daily_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null,
  planned_base_calories integer check (planned_base_calories between 0 and 10000),
  target_steps integer check (target_steps between 0 and 100000),
  total_steps integer check (total_steps between 0 and 200000),
  calories_consumed integer check (calories_consumed between 0 and 20000),
  weight_kg numeric(6,2) check (weight_kg between 20 and 500),
  strength_activity jsonb,
  sync_token uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date),
  unique (id, user_id),
  check (strength_activity is null or jsonb_typeof(strength_activity) = 'object')
);

create table public.activities (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  daily_log_id bigint not null,
  local_id text not null,
  type text not null check (type in ('running', 'cycling', 'jump-rope', 'rowing', 'elliptical', 'stair-climber', 'other')),
  duration_min numeric(8,2) not null check (duration_min between 0 and 10000),
  distance_km numeric(9,3) check (distance_km between 0 and 10000),
  met numeric(6,3) check (met between 0 and 100),
  average_watts numeric(8,2) check (average_watts between 0 and 3000),
  level integer check (level between 1 and 25),
  step_rate_spm numeric(7,2) check (step_rate_spm between 0 and 300),
  note text,
  sync_token uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id),
  foreign key (daily_log_id, user_id) references public.daily_logs(id, user_id) on delete cascade
);

create table public.meals (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  daily_log_id bigint not null,
  local_id text not null,
  name text not null check (char_length(name) between 1 and 300),
  calories numeric(9,2) not null check (calories between 0 and 20000),
  protein_g numeric(9,3) check (protein_g >= 0),
  carbohydrates_g numeric(9,3) check (carbohydrates_g >= 0),
  fat_g numeric(9,3) check (fat_g >= 0),
  fiber_g numeric(9,3) check (fiber_g >= 0),
  quantity numeric(10,3) check (quantity >= 0),
  quantity_unit text check (quantity_unit in ('g', 'ml')),
  meal_slot text check (meal_slot in ('breakfast', 'lunch', 'snack', 'dinner')),
  barcode text,
  brand text,
  image_url text,
  source text check (source in ('open-food-facts', 'manual')),
  calories_per_100 numeric(9,3) check (calories_per_100 >= 0),
  protein_per_100_g numeric(9,3) check (protein_per_100_g >= 0),
  carbohydrates_per_100_g numeric(9,3) check (carbohydrates_per_100_g >= 0),
  fat_per_100_g numeric(9,3) check (fat_per_100_g >= 0),
  fiber_per_100_g numeric(9,3) check (fiber_per_100_g >= 0),
  sync_token uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id),
  foreign key (daily_log_id, user_id) references public.daily_logs(id, user_id) on delete cascade
);

create table public.food_products (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  barcode text not null,
  name text not null,
  brand text,
  image_url text,
  source text not null default 'open-food-facts' check (source in ('open-food-facts', 'manual')),
  calories_per_100 numeric(9,3) check (calories_per_100 >= 0),
  protein_per_100_g numeric(9,3) check (protein_per_100_g >= 0),
  carbohydrates_per_100_g numeric(9,3) check (carbohydrates_per_100_g >= 0),
  fat_per_100_g numeric(9,3) check (fat_per_100_g >= 0),
  fiber_per_100_g numeric(9,3) check (fiber_per_100_g >= 0),
  sync_token uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, barcode)
);

create table public.planned_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_date date not null,
  template_local_id text not null,
  day_type text not null check (day_type in ('upper', 'lower', 'shoulders-arms', 'rest')),
  template_snapshot jsonb,
  type_base_calories integer not null check (type_base_calories between 0 and 10000),
  type_target_steps integer not null check (type_target_steps between 0 and 100000),
  sync_token uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, session_date),
  check (template_snapshot is null or jsonb_typeof(template_snapshot) = 'object')
);

create table public.training_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  daily_log_id bigint not null,
  local_id text not null,
  template_local_id text not null,
  name text not null,
  status text not null check (status in ('planned', 'in-progress', 'completed')),
  template_version integer,
  started_at timestamptz,
  completed_at timestamptz,
  running_since timestamptz,
  elapsed_ms bigint check (elapsed_ms >= 0),
  rest_until timestamptz,
  rest_remaining_ms bigint check (rest_remaining_ms >= 0),
  auto_rest boolean,
  sync_token uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id),
  unique (daily_log_id),
  unique (id, user_id),
  foreign key (daily_log_id, user_id) references public.daily_logs(id, user_id) on delete cascade
);

create table public.session_exercises (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id bigint not null,
  local_id text not null,
  template_line_id text,
  exercise_local_id text,
  position integer not null check (position >= 0),
  name text not null,
  target text not null default '',
  note text,
  equipment_id text,
  load_convention text check (load_convention in ('total', 'per-dumbbell', 'machine', 'bodyweight', 'assisted', 'unknown')),
  set_count integer check (set_count between 0 and 100),
  reps_min integer check (reps_min between 0 and 1000),
  reps_max integer check (reps_max between 0 and 1000),
  target_rir numeric(4,1) check (target_rir between -10 and 20),
  rest_seconds integer check (rest_seconds between 0 and 3600),
  movement_family text,
  muscle_contributions jsonb not null default '[]'::jsonb check (jsonb_typeof(muscle_contributions) = 'array'),
  laterality text check (laterality in ('bilateral', 'unilateral')),
  replaces_id text,
  replaced_by_id text,
  sync_token uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, local_id),
  unique (id, user_id),
  foreign key (session_id, user_id) references public.training_sessions(id, user_id) on delete cascade,
  check (reps_max is null or reps_min is null or reps_max >= reps_min)
);

create table public.training_sets (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_exercise_id bigint not null,
  local_id text not null,
  position integer not null check (position >= 0),
  reps numeric(7,2) check (reps between 0 and 10000),
  load_kg numeric(8,3) check (load_kg between -1000 and 5000),
  rir numeric(5,2) check (rir between -20 and 100),
  completed boolean not null default false,
  kind text not null default 'work' check (kind in ('work', 'warmup')),
  sync_token uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_exercise_id, local_id),
  foreign key (session_exercise_id, user_id) references public.session_exercises(id, user_id) on delete cascade
);

create table public.sync_runs (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  sync_token uuid not null,
  source text not null check (source in ('local-import', 'automatic', 'manual')),
  status text not null check (status in ('started', 'completed', 'failed')),
  source_revision bigint not null default 0,
  backup_payload jsonb,
  entity_counts jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, sync_token),
  check (backup_payload is null or jsonb_typeof(backup_payload) = 'object'),
  check (entity_counts is null or jsonb_typeof(entity_counts) = 'object')
);

-- Foreign-key and common access-path indexes.
create index profiles_active_goal_id_idx on public.profiles (active_goal_id) where active_goal_id is not null;
create unique index goals_one_active_per_user_idx on public.goals (user_id) where status = 'active';
create index goals_user_dates_idx on public.goals (user_id, start_date desc, target_date);
create index calculation_settings_user_id_idx on public.calculation_settings (user_id);
create index goal_day_plans_user_id_idx on public.goal_day_plans (user_id);
create index custom_exercises_user_archived_idx on public.custom_exercises (user_id, archived, name);
create index training_templates_user_archived_idx on public.training_templates (user_id, archived, name);
create index template_exercises_template_order_idx on public.template_exercises (template_id, user_id, position);
create index daily_logs_user_date_idx on public.daily_logs (user_id, log_date desc);
create index activities_daily_log_idx on public.activities (daily_log_id, user_id);
create index meals_daily_log_idx on public.meals (daily_log_id, user_id);
create index food_products_user_name_idx on public.food_products (user_id, name);
create index planned_sessions_user_date_idx on public.planned_sessions (user_id, session_date desc);
create index training_sessions_daily_log_idx on public.training_sessions (daily_log_id, user_id);
create index training_sessions_user_status_idx on public.training_sessions (user_id, status, updated_at desc);
create index session_exercises_session_order_idx on public.session_exercises (session_id, user_id, position);
create index training_sets_exercise_order_idx on public.training_sets (session_exercise_id, user_id, position);
create index sync_runs_user_started_idx on public.sync_runs (user_id, started_at desc);

-- Keep updated_at reliable regardless of which client performs the write.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'goals', 'calculation_settings', 'goal_day_plans',
    'custom_exercises', 'training_templates', 'template_exercises',
    'daily_logs', 'activities', 'meals', 'food_products', 'planned_sessions',
    'training_sessions', 'session_exercises', 'training_sets'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function private.set_updated_at()',
      table_name || '_set_updated_at', table_name
    );
  end loop;
end;
$$;

-- The public Data API exposes only authenticated, RLS-filtered rows.
revoke all on all tables in schema public from public, anon;
revoke all on all sequences in schema public from public, anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter table public.profiles enable row level security;
alter table public.goals enable row level security;
alter table public.calculation_settings enable row level security;
alter table public.goal_day_plans enable row level security;
alter table public.custom_exercises enable row level security;
alter table public.training_templates enable row level security;
alter table public.template_exercises enable row level security;
alter table public.daily_logs enable row level security;
alter table public.activities enable row level security;
alter table public.meals enable row level security;
alter table public.food_products enable row level security;
alter table public.planned_sessions enable row level security;
alter table public.training_sessions enable row level security;
alter table public.session_exercises enable row level security;
alter table public.training_sets enable row level security;
alter table public.sync_runs enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy profiles_delete_own on public.profiles for delete to authenticated using ((select auth.uid()) = id);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'goals', 'calculation_settings', 'goal_day_plans', 'custom_exercises',
    'training_templates', 'template_exercises', 'daily_logs', 'activities',
    'meals', 'food_products', 'planned_sessions', 'training_sessions',
    'session_exercises', 'training_sets', 'sync_runs'
  ] loop
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name || '_select_own', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', table_name || '_insert_own', table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name || '_update_own', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', table_name || '_delete_own', table_name);
  end loop;
end;
$$;

comment on table public.profiles is 'Private application profile and cloud synchronization revision.';
comment on table public.sync_runs is 'Auditable local import and synchronization attempts; backup_payload allows recovery.';
