begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.app_owner(user_id) values ('11111111-1111-4111-8111-111111111111');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
insert into public.workspaces(user_id) values ('11111111-1111-4111-8111-111111111111');
update public.workspaces set state=jsonb_set(state,'{annual}','60000000'),revision=1;
insert into public.zoom_requests(user_id,id,payload) values ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','{}');
do $$begin
 begin
   perform public.save_zoom_meeting('33333333-3333-4333-8333-333333333333');
   raise exception 'processing request was saved';
 exception when raise_exception then
   if sqlerrm <> 'meeting not ready' then raise; end if;
 end;
end$$;
update public.zoom_requests set status='ready',meeting='{"id":"33333333-3333-4333-8333-333333333333","date":"2026-12-01","time":"10:00","title":"商談","url":"https://zoom.us/j/123456789","memo":""}';
select public.save_zoom_meeting('33333333-3333-4333-8333-333333333333');
select public.save_zoom_meeting('33333333-3333-4333-8333-333333333333');
do $$begin
 if (select jsonb_array_length(state->'meetings') from public.workspaces) <> 1 then raise exception 'duplicate meeting';end if;
 if (select revision from public.workspaces) <> 2 then raise exception 'incorrect revision';end if;
 if (select (state->>'annual')::numeric from public.workspaces) <> 60000000 then raise exception 'overwrote goal';end if;
end$$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$begin
 if (select count(*) from public.zoom_requests) <> 0 then raise exception 'other user can read requests';end if;
 update public.zoom_requests set status='unknown';if found then raise exception 'other user can update';end if;
 begin
  insert into public.zoom_requests(user_id,id,payload) values ('22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','{}');
  raise exception 'other user can insert';
 exception when insufficient_privilege then null;end;
 begin perform public.save_zoom_meeting('33333333-3333-4333-8333-333333333333');raise exception 'other user can save';exception when insufficient_privilege then null;end;
end$$;
reset role;
set local role anon;
do $$begin
 begin perform * from public.zoom_requests;raise exception 'anonymous read';exception when insufficient_privilege then null;end;
 begin perform public.save_zoom_meeting('33333333-3333-4333-8333-333333333333');raise exception 'anonymous execute';exception when insufficient_privilege then null;end;
end$$;
rollback;
