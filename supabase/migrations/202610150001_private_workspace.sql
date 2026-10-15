-- Run as the Supabase project administrator. No secret or user ID is hardcoded.
begin;
-- A singleton allowlist. Only the SQL administrator may designate the owner.
create table public.app_owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete cascade
);
create table public.workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{"annual":50000000,"monthly":4200000,"events":[],"meetings":[],"reports":[],"reviews":[],"sales":[]}'::jsonb,
  revision integer not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  constraint workspace_state_shape check (
    jsonb_typeof(state) = 'object' and
    state ?& array['annual','monthly','events','meetings','reports','reviews','sales'] and
    jsonb_typeof(state->'annual') = 'number' and
    jsonb_typeof(state->'monthly') = 'number' and
    (state->>'annual')::numeric > 0 and (state->>'monthly')::numeric > 0 and
    jsonb_typeof(state->'events') = 'array' and
    jsonb_typeof(state->'meetings') = 'array' and
    jsonb_typeof(state->'reports') = 'array' and
    jsonb_typeof(state->'reviews') = 'array' and
    jsonb_typeof(state->'sales') = 'array'
  )
);
alter table public.app_owner enable row level security;
alter table public.app_owner force row level security;
alter table public.workspaces enable row level security;
alter table public.workspaces force row level security;
revoke all on public.app_owner, public.workspaces from public, anon, authenticated;
grant select on public.app_owner to authenticated;
grant select, insert, update, delete on public.workspaces to authenticated;
create policy owner_can_read_membership on public.app_owner for select to authenticated
  using (user_id = (select auth.uid()));
create policy owner_workspace_select on public.workspaces for select to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.app_owner where user_id = (select auth.uid())));
create policy owner_workspace_insert on public.workspaces for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.app_owner where user_id = (select auth.uid())));
create policy owner_workspace_update on public.workspaces for update to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.app_owner where user_id = (select auth.uid())))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.app_owner where user_id = (select auth.uid())));
create policy owner_workspace_delete on public.workspaces for delete to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.app_owner where user_id = (select auth.uid())));
create function public.touch_workspace() returns trigger language plpgsql
  set search_path = '' as $$
begin
  new.updated_at = now();
  if new.revision <> old.revision + 1 then
    raise exception 'revision must increase by one';
  end if;
  return new;
end;
$$;
revoke all on function public.touch_workspace() from public, anon, authenticated;
create trigger workspace_updated before update on public.workspaces for each row execute function public.touch_workspace();
comment on table public.workspaces is 'One atomic document per owner: schedules, reports, goals, reviews, meetings, sales. Revision protects concurrent device edits.';
commit;
