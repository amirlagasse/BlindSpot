-- Blind Spot: initial schema.
--
-- Four tables. Everything a user tells us, everything we computed from it, and
-- the version of the factor data that was current when we computed it.
--
-- The design constraint that shapes all of this: a result must stay reproducible
-- after the factor tables change. That is why `results` stores the whole
-- EngineResult as jsonb alongside an engine version string, rather than storing
-- inputs and recomputing on read. When a source publishes a new year and a
-- number moves, last month's dashboard still says what it said, and the user can
-- see the trend rather than having it silently rewritten underneath them.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  age         smallint,
  sex         text,
  zip         text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- One profile per user in v1. Lifting this later means dropping the
  -- constraint, not restructuring anything.
  constraint profiles_user_id_key unique (user_id),
  constraint profiles_age_check check (age is null or (age between 18 and 110)),
  constraint profiles_sex_check check (sex is null or sex in ('male', 'female')),
  constraint profiles_zip_check check (zip is null or zip ~ '^\d{5}$')
);

create index profiles_user_id_idx on public.profiles (user_id);

-- ---------------------------------------------------------------------------
-- inputs: one row per intake step, so the form is resumable
-- ---------------------------------------------------------------------------

create table public.inputs (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  step          text not null,
  payload       jsonb not null default '{}'::jsonb,
  completed_at  timestamptz,
  updated_at    timestamptz not null default now(),

  -- A step is written once and updated in place. Upsert on this key.
  constraint inputs_profile_step_key unique (profile_id, step),
  constraint inputs_step_check check (
    step in ('baseline', 'location', 'work', 'mobility', 'activities', 'habits', 'health')
  )
);

create index inputs_profile_id_idx on public.inputs (profile_id);

-- ---------------------------------------------------------------------------
-- results: every compute, kept
-- ---------------------------------------------------------------------------

create table public.results (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  -- 'engine@0.1.0;activity@0.0.0,chronic@1.0.0,...'. Stamped by the engine, and
  -- the reason a stored result can be explained a year from now.
  engine_version  text not null,
  computed_at     timestamptz not null default now(),
  result          jsonb not null
);

create index results_profile_id_computed_at_idx
  on public.results (profile_id, computed_at desc);

-- ---------------------------------------------------------------------------
-- factor_versions: the changelog for the numbers themselves
-- ---------------------------------------------------------------------------

create table public.factor_versions (
  version       text primary key,
  published_at  timestamptz not null default now(),
  changelog     text not null
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger inputs_touch_updated_at
  before update on public.inputs
  for each row execute function public.touch_updated_at();
