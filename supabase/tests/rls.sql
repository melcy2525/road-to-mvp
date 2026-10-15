-- Local disposable PostgreSQL test setup supplies auth.uid() and auth.users.
-- This test is rolled back, and uses no production account.
begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.app_owner(user_id) values ('11111111-1111-4111-8111-111111111111');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
insert into public.workspaces(user_id) values ('11111111-1111-4111-8111-111111111111');
do $$ begin
 if (select count(*) from public.workspaces) <> 1 then raise exception 'owner select failed'; end if;
 if (select count(*) from public.app_owner) <> 1 then raise exception 'owner membership failed'; end if;
end $$;
update public.workspaces set revision=1,state=jsonb_set(state,'{annual}','60000000') where revision=0;
do $$ begin
 if (select revision from public.workspaces) <> 1 then raise exception 'owner update failed'; end if;
 -- Compare-and-swap must not replace a newer revision.
 update public.workspaces set revision=1 where revision=0;
 if found then raise exception 'stale update succeeded'; end if;
 begin
   insert into public.workspaces(user_id) values ('22222222-2222-4222-8222-222222222222');
   raise exception 'cross-user insert succeeded';
 exception when insufficient_privilege then null; end;
 begin
   update public.workspaces set user_id='22222222-2222-4222-8222-222222222222',revision=2;
   raise exception 'cross-user reassignment succeeded';
 exception when insufficient_privilege then null; end;
 begin
   update public.app_owner set user_id='22222222-2222-4222-8222-222222222222';
   raise exception 'owner allowlist update succeeded';
 exception when insufficient_privilege then null; end;
 begin
   delete from public.app_owner;
   raise exception 'owner allowlist delete succeeded';
 exception when insufficient_privilege then null; end;
 begin
   insert into public.app_owner(user_id) values ('22222222-2222-4222-8222-222222222222');
   raise exception 'owner self-enrollment succeeded';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$ begin
 if (select count(*) from public.workspaces) <> 0 then raise exception 'other user read data'; end if;
 if (select count(*) from public.app_owner) <> 0 then raise exception 'other user read membership'; end if;
 update public.workspaces set revision=2;
 if found then raise exception 'other user updated data'; end if;
 delete from public.workspaces;
 if found then raise exception 'other user deleted data'; end if;
 begin
   insert into public.workspaces(user_id) values ('22222222-2222-4222-8222-222222222222');
   raise exception 'unapproved user insert succeeded';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 begin perform * from public.workspaces;raise exception 'anonymous select succeeded';exception when insufficient_privilege then null;end;
 begin insert into public.workspaces(user_id) values ('11111111-1111-4111-8111-111111111111');raise exception 'anonymous insert succeeded';exception when insufficient_privilege then null;end;
 begin update public.workspaces set revision=2;raise exception 'anonymous update succeeded';exception when insufficient_privilege then null;end;
 begin delete from public.workspaces;raise exception 'anonymous delete succeeded';exception when insufficient_privilege then null;end;
 begin perform * from public.app_owner;raise exception 'anonymous membership read succeeded';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
delete from public.workspaces;
do $$ begin if (select count(*) from public.workspaces) <> 0 then raise exception 'owner delete failed';end if;end $$;
reset role;
do $$ begin
 if exists (select 1 from pg_tables where schemaname='public' and tablename in ('app_owner','workspaces') and not rowsecurity) then raise exception 'RLS not enabled';end if;
end $$;
rollback;
