-- Apply after 202610150001_private_workspace.sql.
begin;
create table public.zoom_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status text not null default 'processing' check (status in ('processing','ready','saved','failed','unknown')),
  meeting jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint zoom_meeting_shape check (
    (status in ('ready','saved') and meeting is not null and jsonb_typeof(meeting) = 'object'
      and meeting ?& array['id','date','time','title','url','memo'] and meeting->>'id' = id::text)
    or (status not in ('ready','saved') and meeting is null)
  )
);
alter table public.zoom_requests enable row level security;
alter table public.zoom_requests force row level security;
revoke all on public.zoom_requests from public, anon, authenticated;
grant select, insert, update on public.zoom_requests to authenticated;
create policy owner_zoom_requests on public.zoom_requests for all to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.app_owner where user_id = (select auth.uid())))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.app_owner where user_id = (select auth.uid())));

-- Save the link and revision in one transaction, preserving concurrent edits.
-- Invoker security retains all RLS checks; no service_role key is needed.
create function public.save_zoom_meeting(p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  request_row public.zoom_requests%rowtype;
begin
  select * into request_row from public.zoom_requests
    where user_id = (select auth.uid()) and id = p_request_id for update;
  if not found then raise exception 'request not found' using errcode = '42501'; end if;
  if request_row.status = 'saved' then return request_row.meeting; end if;
  if request_row.status <> 'ready' then raise exception 'meeting not ready'; end if;
  insert into public.workspaces(user_id) values ((select auth.uid())) on conflict (user_id) do nothing;
  -- Row locks plus a single UPDATE merge safely with the existing document.
  update public.workspaces
    set state = jsonb_set(state, '{meetings}', (state->'meetings') || jsonb_build_array(request_row.meeting)),
        revision = revision + 1
    where user_id = (select auth.uid())
      and not exists (select 1 from jsonb_array_elements(state->'meetings') m where m->>'id' = p_request_id::text);
  update public.zoom_requests set status = 'saved'
    where user_id = (select auth.uid()) and id = p_request_id;
  return request_row.meeting;
end;
$$;
revoke all on function public.save_zoom_meeting(uuid) from public, anon;
grant execute on function public.save_zoom_meeting(uuid) to authenticated;
commit;
