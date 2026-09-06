-- Row level security.
--
-- A user reads and writes their own rows and nobody else's. Everything below
-- ties back to `auth.uid()` through `profiles.user_id`; there is no policy
-- anywhere that grants access on any other basis.
--
-- `tests/db/rls.test.ts` attempts cross-user access against a live project and
-- asserts it fails. RLS that has not been tested is RLS that might be off.

alter table public.profiles        enable row level security;
alter table public.inputs          enable row level security;
alter table public.results         enable row level security;
alter table public.factor_versions enable row level security;

-- Force RLS even for the table owner, so a mistake in a server-side role does
-- not quietly bypass every policy below.
alter table public.profiles        force row level security;
alter table public.inputs          force row level security;
alter table public.results         force row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create policy profiles_select_own on public.profiles
  for select using (auth.uid() = user_id);

create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = user_id);

create policy profiles_update_own on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy profiles_delete_own on public.profiles
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- inputs and results
--
-- Both hang off profiles. `with check` as well as `using` on the write policies
-- is what stops a user moving one of their own rows onto someone else's profile.
-- ---------------------------------------------------------------------------

create or replace function public.owns_profile(target uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = target and p.user_id = auth.uid()
  );
$$;

create policy inputs_select_own on public.inputs
  for select using (public.owns_profile(profile_id));

create policy inputs_insert_own on public.inputs
  for insert with check (public.owns_profile(profile_id));

create policy inputs_update_own on public.inputs
  for update using (public.owns_profile(profile_id))
  with check (public.owns_profile(profile_id));

create policy inputs_delete_own on public.inputs
  for delete using (public.owns_profile(profile_id));

create policy results_select_own on public.results
  for select using (public.owns_profile(profile_id));

create policy results_insert_own on public.results
  for insert with check (public.owns_profile(profile_id));

create policy results_delete_own on public.results
  for delete using (public.owns_profile(profile_id));

-- Results are an append-only record of what the app said and when. Nothing
-- updates them, so there is deliberately no update policy.

-- ---------------------------------------------------------------------------
-- factor_versions: readable by everyone, written only by a service role
-- ---------------------------------------------------------------------------

create policy factor_versions_select_all on public.factor_versions
  for select to authenticated, anon using (true);
