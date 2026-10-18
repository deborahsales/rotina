-- Rotina: private per-user records. Public clients only receive a publishable key.
create table public.routine_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade deferrable initially immediate,
  display_name text not null default '' check (char_length(display_name)<=100),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings)='object' and octet_length(settings::text)<=16000),
  initialized boolean not null default false,
  revision integer not null default 1 check (revision>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.routine_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade deferrable initially immediate,
  type text not null check (type in ('task','habit','habit_log','water','meal','goal','study','activity','checkin','resource','shopping','atelier','block','block_log','favorite')),
  entry_date date,
  data jsonb not null check (jsonb_typeof(data)='object' and octet_length(data::text)<=64000),
  revision integer not null default 1 check (revision>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routine_daily_date check (type not in ('habit_log','water','meal','study','activity','checkin','shopping','block_log') or entry_date is not null),
  constraint routine_habit_reference check (type<>'habit_log' or (data ? 'habitId' and jsonb_typeof(data->'habitId')='string')),
  constraint routine_block_reference check (type<>'block_log' or (data ? 'blockId' and jsonb_typeof(data->'blockId')='string')),
  constraint routine_meal_slot check (type<>'meal' or (data ? 'slot' and data->>'slot' in ('breakfast','lunch','snack','dinner'))),
  constraint routine_water_amount check (case when type='water' then
    case when jsonb_typeof(data->'ml')='number' then (data->>'ml')::numeric>0 and (data->>'ml')::numeric<=5000 else false end
    else true end),
  constraint routine_shopping_key check (type<>'shopping' or (data ? 'key' and jsonb_typeof(data->'key')='string')),
  constraint routine_favorite_recipe check (type<>'favorite' or (data ? 'recipeId' and jsonb_typeof(data->'recipeId')='string'))
);
create index routine_entries_owner_date on public.routine_entries(user_id,entry_date);
create index routine_entries_owner_type on public.routine_entries(user_id,type);
create unique index routine_one_habit_log on public.routine_entries(user_id,entry_date,(data->>'habitId')) where type='habit_log';
create unique index routine_one_block_log on public.routine_entries(user_id,entry_date,(data->>'blockId')) where type='block_log';
create unique index routine_one_meal_slot on public.routine_entries(user_id,entry_date,(data->>'slot')) where type='meal';
create unique index routine_one_checkin on public.routine_entries(user_id,entry_date) where type='checkin';
create unique index routine_one_favorite on public.routine_entries(user_id,(data->>'recipeId')) where type='favorite';
create unique index routine_one_shopping_key on public.routine_entries(user_id,entry_date,(data->>'key')) where type='shopping';

create function public.routine_touch_record() returns trigger
language plpgsql security invoker set search_path=pg_catalog as $$
begin
  new.revision := old.revision+1;
  new.updated_at := statement_timestamp();
  new.created_at := old.created_at;
  return new;
end;
$$;
revoke all on function public.routine_touch_record() from public, anon, authenticated;
create trigger routine_profiles_touch before update on public.routine_profiles for each row execute function public.routine_touch_record();
create trigger routine_entries_touch before update on public.routine_entries for each row execute function public.routine_touch_record();

alter table public.routine_profiles enable row level security;
alter table public.routine_entries enable row level security;
revoke all on public.routine_profiles,public.routine_entries from anon,authenticated;
grant usage on schema public to authenticated;
grant select,insert,update,delete on public.routine_profiles,public.routine_entries to authenticated;

create policy routine_profile_select on public.routine_profiles for select to authenticated using ((select auth.uid())=user_id);
create policy routine_profile_insert on public.routine_profiles for insert to authenticated with check ((select auth.uid())=user_id);
create policy routine_profile_update on public.routine_profiles for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy routine_profile_delete on public.routine_profiles for delete to authenticated using ((select auth.uid())=user_id);
create policy routine_entry_select on public.routine_entries for select to authenticated using ((select auth.uid())=user_id);
create policy routine_entry_insert on public.routine_entries for insert to authenticated with check ((select auth.uid())=user_id);
create policy routine_entry_update on public.routine_entries for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy routine_entry_delete on public.routine_entries for delete to authenticated using ((select auth.uid())=user_id);

comment on table public.routine_profiles is 'Personal settings for Rotina. RLS isolates every authenticated user.';
comment on table public.routine_entries is 'Versioned personal records. A flexible module payload is stored per record, never as a shared whole-account document.';
