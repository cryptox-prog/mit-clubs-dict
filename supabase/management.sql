-- ADDITIVE directory management migration. Run after init.sql + auth_functions.sql.
-- Keeps all data/icons. No Storage rows are deleted or modified with SQL.
-- All RPCs are callable ONLY by the Node service_role client. p_actor is always
-- the verified custom JWT subject supplied by Node, never accepted from a body.
begin;
create table if not exists public.project_managers (
  project_id uuid not null references public.student_projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  primary key(project_id,user_id)
);
create index if not exists project_managers_user_idx on public.project_managers(user_id);
alter table public.project_managers enable row level security;
revoke all on public.project_managers from public,anon,authenticated;
grant select,insert,update,delete on public.project_managers to service_role;

create or replace function public.directory_can_manage(p_actor uuid,p_kind text,p_id uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.users where id=p_actor and disabled_at is null)
 and (exists(select 1 from public.app_admins where user_id=p_actor) or case p_kind
 when 'clubs' then exists(select 1 from public.club_managers where club_id=p_id and user_id=p_actor)
 when 'student-projects' then exists(select 1 from public.project_managers where project_id=p_id and user_id=p_actor)
   or exists(select 1 from public.student_projects p join public.club_managers m on m.club_id=p.club_id where p.id=p_id and m.user_id=p_actor)
 when 'events' then exists(select 1 from public.events e join public.club_managers m on m.club_id=e.club_id where e.id=p_id and m.user_id=p_actor)
 else false end);
$$;

create or replace function public.manager_dashboard(p_actor uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'is_admin',exists(select 1 from public.app_admins where user_id=p_actor),
 'domains',(select coalesce(jsonb_agg(d order by d.name),'[]'::jsonb) from (select id,name from public.domains) d),
 'year_groups',(select coalesce(jsonb_agg(y order by y.id),'[]'::jsonb) from (select id,name from public.year_groups) y),
 'listings',(select coalesce(jsonb_agg(x order by x.kind,x.name),'[]'::jsonb) from (
   select 'clubs'::text as kind,c.id,c.name,c.description,c.club_kind,null::uuid as club_id,c.icon_path,
    c.application_start,c.registration_deadline,c.apply_link,null::timestamptz as event_start,null::timestamptz as event_end,null::text as participation_type,c.updated_at,
    coalesce((select jsonb_agg(domain_id) from public.club_domains where club_id=c.id),'[]'::jsonb) as domain_ids,
    coalesce((select jsonb_agg(year_group_id) from public.club_open_to where club_id=c.id),'[]'::jsonb) as year_group_ids
   from public.clubs c where public.directory_can_manage(p_actor,'clubs',c.id)
   union all
   select 'student-projects',p.id,p.title,p.description,null,p.club_id,p.icon_path,p.application_start,p.registration_deadline,p.apply_link,null,null,null,p.updated_at,
    coalesce((select jsonb_agg(domain_id) from public.project_domains where project_id=p.id),'[]'::jsonb),
    coalesce((select jsonb_agg(year_group_id) from public.project_open_to where project_id=p.id),'[]'::jsonb)
   from public.student_projects p where public.directory_can_manage(p_actor,'student-projects',p.id)
   union all
   select 'events',e.id,e.title,e.description,null,e.club_id,e.icon_path,e.application_start,e.registration_deadline,e.apply_link,e.event_start,e.event_end,e.participation_type,e.updated_at,
    coalesce((select jsonb_agg(domain_id) from public.event_domains where event_id=e.id),'[]'::jsonb),
    coalesce((select jsonb_agg(year_group_id) from public.event_open_to where event_id=e.id),'[]'::jsonb)
   from public.events e where public.directory_can_manage(p_actor,'events',e.id)
 ) x));
$$;

create or replace function public.manager_update_listing(
 p_actor uuid,p_kind text,p_id uuid,p_expected_updated_at timestamptz,p_patch jsonb
) returns timestamptz language plpgsql security invoker set search_path='' as $$
declare
 v_table text; v_join text; v_open text; v_fk text; v_current timestamptz; v_updated timestamptz;
begin
 case p_kind
 when 'clubs' then v_table:='clubs';v_join:='club_domains';v_open:='club_open_to';v_fk:='club_id';
 when 'student-projects' then v_table:='student_projects';v_join:='project_domains';v_open:='project_open_to';v_fk:='project_id';
 when 'events' then v_table:='events';v_join:='event_domains';v_open:='event_open_to';v_fk:='event_id';
 else raise exception 'Invalid listing type' using errcode='22023'; end case;
 if not public.directory_can_manage(p_actor,p_kind,p_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 execute format('select updated_at from public.%I where id=$1 for update',v_table) into v_current using p_id;
 if v_current is null then raise exception 'Listing not found' using errcode='P0002'; end if;
 if p_expected_updated_at is null or v_current<>p_expected_updated_at then
   raise exception 'Listing changed; reload before saving' using errcode='40001'; end if;
 if p_kind='clubs' then
   update public.clubs set name=p_patch->>'name',description=p_patch->>'description',club_kind=p_patch->>'club_kind',
    application_start=(p_patch->>'application_start')::date,registration_deadline=(p_patch->>'registration_deadline')::date,apply_link=p_patch->>'apply_link'
    where id=p_id returning updated_at into v_updated;
 elsif p_kind='student-projects' then
   update public.student_projects set title=p_patch->>'name',description=p_patch->>'description',
    application_start=(p_patch->>'application_start')::date,registration_deadline=(p_patch->>'registration_deadline')::date,apply_link=p_patch->>'apply_link'
    where id=p_id returning updated_at into v_updated;
 else
   update public.events set title=p_patch->>'name',description=p_patch->>'description',
    application_start=(p_patch->>'application_start')::date,registration_deadline=(p_patch->>'registration_deadline')::date,apply_link=p_patch->>'apply_link',
    event_start=(p_patch->>'event_start')::timestamptz,event_end=(p_patch->>'event_end')::timestamptz,participation_type=p_patch->>'participation_type'
    where id=p_id returning updated_at into v_updated;
 end if;
 execute format('delete from public.%I where %I=$1',v_join,v_fk) using p_id;
 execute format('insert into public.%I(%I,domain_id) select $1,value::uuid from jsonb_array_elements_text($2) on conflict do nothing',v_join,v_fk)
   using p_id,coalesce(p_patch->'domain_ids','[]'::jsonb);
 execute format('delete from public.%I where %I=$1',v_open,v_fk) using p_id;
 execute format('insert into public.%I(%I,year_group_id) select $1,value::smallint from jsonb_array_elements_text($2) on conflict do nothing',v_open,v_fk)
   using p_id,coalesce(p_patch->'year_group_ids','[]'::jsonb);
 return v_updated;
end;
$$;

create or replace function public.manager_set_icon(
 p_actor uuid,p_kind text,p_id uuid,p_expected_updated_at timestamptz,p_icon_path text
) returns timestamptz language plpgsql security invoker set search_path='' as $$
declare v_table text;v_current timestamptz;v_updated timestamptz;
begin
 v_table:=case p_kind when 'clubs' then 'clubs' when 'student-projects' then 'student_projects' when 'events' then 'events' else null end;
 if v_table is null then raise exception 'Invalid listing type' using errcode='22023'; end if;
 if not public.directory_can_manage(p_actor,p_kind,p_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 execute format('select updated_at from public.%I where id=$1 for update',v_table) into v_current using p_id;
 if v_current is null then raise exception 'Listing not found' using errcode='P0002'; end if;
 if p_expected_updated_at is null or v_current<>p_expected_updated_at then raise exception 'Listing changed; reload before saving' using errcode='40001'; end if;
 execute format('update public.%I set icon_path=$1 where id=$2 returning updated_at',v_table) into v_updated using p_icon_path,p_id;
 return v_updated;
end;
$$;

create or replace function public.manager_assignments(p_actor uuid,p_kind text,p_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_result jsonb;
begin
 if not exists(select 1 from public.app_admins a join public.users u on u.id=a.user_id where a.user_id=p_actor and u.disabled_at is null)
 then raise exception 'Administrator required' using errcode='42501'; end if;
 if p_kind='clubs' then
  select coalesce(jsonb_agg(jsonb_build_object('user_id',u.id,'email',u.email,'full_name',u.full_name) order by u.email),'[]'::jsonb)
   into v_result from public.club_managers m join public.users u on u.id=m.user_id where m.club_id=p_id;
 elsif p_kind='student-projects' then
  select coalesce(jsonb_agg(jsonb_build_object('user_id',u.id,'email',u.email,'full_name',u.full_name) order by u.email),'[]'::jsonb)
   into v_result from public.project_managers m join public.users u on u.id=m.user_id where m.project_id=p_id;
 else raise exception 'Assign managers to a club or project' using errcode='22023'; end if;
 return v_result;
end;
$$;

create or replace function public.manager_set_assignment(p_actor uuid,p_kind text,p_id uuid,p_email text,p_assign boolean)
returns void language plpgsql security invoker set search_path='' as $$
declare v_user uuid;
begin
 if not exists(select 1 from public.app_admins a join public.users u on u.id=a.user_id where a.user_id=p_actor and u.disabled_at is null)
 then raise exception 'Administrator required' using errcode='42501'; end if;
 select id into v_user from public.users where email=lower(btrim(p_email)) and (disabled_at is null or not p_assign);
 if not found then raise exception 'Registered active user not found' using errcode='P0002'; end if;
 if p_kind='clubs' then
  if not exists(select 1 from public.clubs where id=p_id) then raise exception 'Club not found' using errcode='P0002'; end if;
  if p_assign then insert into public.club_managers(club_id,user_id) values(p_id,v_user) on conflict do nothing;
  else delete from public.club_managers where club_id=p_id and user_id=v_user; end if;
 elsif p_kind='student-projects' then
  if not exists(select 1 from public.student_projects where id=p_id) then raise exception 'Project not found' using errcode='P0002'; end if;
  if p_assign then insert into public.project_managers(project_id,user_id) values(p_id,v_user) on conflict do nothing;
  else delete from public.project_managers where project_id=p_id and user_id=v_user; end if;
 else raise exception 'Assign managers to a club or project' using errcode='22023'; end if;
end;
$$;

revoke all on function public.directory_can_manage(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.manager_dashboard(uuid) from public,anon,authenticated;
revoke all on function public.manager_update_listing(uuid,text,uuid,timestamptz,jsonb) from public,anon,authenticated;
revoke all on function public.manager_set_icon(uuid,text,uuid,timestamptz,text) from public,anon,authenticated;
revoke all on function public.manager_assignments(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.manager_set_assignment(uuid,text,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.directory_can_manage(uuid,text,uuid),public.manager_dashboard(uuid),
 public.manager_update_listing(uuid,text,uuid,timestamptz,jsonb),public.manager_set_icon(uuid,text,uuid,timestamptz,text),
 public.manager_assignments(uuid,text,uuid),public.manager_set_assignment(uuid,text,uuid,text,boolean) to service_role;
commit;
