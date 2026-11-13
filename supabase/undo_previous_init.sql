-- Undo ONLY the previous Supabase-Auth-based MIT Clubs initialization.
-- DESTRUCTIVE: deletes its directory, profiles, roles and recruitment data.
-- Run as postgres in SQL Editor, BEFORE init.sql. Back up needed data first.
-- Does not drop Supabase schemas, auth.users, or unrelated project objects.
-- Preserves the empty assets bucket: Supabase forbids direct SQL deletion.
-- init.sql reconfigures this existing bucket as private.
-- Existing Supabase login accounts were NOT created by the old init and remain.
-- Those accounts will NOT become custom public.users accounts automatically.
--
-- If assets has files: first empty it using Storage Dashboard/API. SQL cannot
-- safely delete file bytes. This script aborts BEFORE changing anything if files
-- remain. Stop concurrent uploads while performing this reset.
-- https://supabase.com/docs/guides/storage/management/delete-objects
begin;
do $$
begin
  if exists (select 1 from storage.objects where bucket_id = 'assets') then
    raise exception 'Empty assets through Storage Dashboard/API first, then rerun rollback. No changes were made.';
  end if;
end;
$$;

drop policy if exists clubs_dict_icons_select on storage.objects;
drop policy if exists clubs_dict_icons_insert on storage.objects;
drop policy if exists clubs_dict_icons_update on storage.objects;
drop policy if exists clubs_dict_icons_delete on storage.objects;
drop trigger if exists clubs_dict_auth_user_created on auth.users;
-- Remove cross-table policy dependencies BEFORE dropping any application table.
-- Explicit names limit cleanup to policies created by the previous init.
do $$
declare
  old_policy record;
begin
  for old_policy in
    select * from (values
      ('clubs', 'directory_read'),
      ('clubs', 'directory_insert'),
      ('clubs', 'directory_update'),
      ('clubs', 'directory_delete'),
      ('student_projects', 'directory_read'),
      ('student_projects', 'directory_insert'),
      ('student_projects', 'directory_update'),
      ('student_projects', 'directory_delete'),
      ('events', 'directory_read'),
      ('events', 'directory_insert'),
      ('events', 'directory_update'),
      ('events', 'directory_delete'),
      ('domains', 'directory_read'),
      ('domains', 'directory_insert'),
      ('domains', 'directory_update'),
      ('domains', 'directory_delete'),
      ('year_groups', 'directory_read'),
      ('year_groups', 'directory_insert'),
      ('year_groups', 'directory_update'),
      ('year_groups', 'directory_delete'),
      ('club_domains', 'directory_read'),
      ('club_domains', 'directory_insert'),
      ('club_domains', 'directory_update'),
      ('club_domains', 'directory_delete'),
      ('club_open_to', 'directory_read'),
      ('club_open_to', 'directory_insert'),
      ('club_open_to', 'directory_update'),
      ('club_open_to', 'directory_delete'),
      ('project_domains', 'directory_read'),
      ('project_domains', 'directory_insert'),
      ('project_domains', 'directory_update'),
      ('project_domains', 'directory_delete'),
      ('project_open_to', 'directory_read'),
      ('project_open_to', 'directory_insert'),
      ('project_open_to', 'directory_update'),
      ('project_open_to', 'directory_delete'),
      ('event_domains', 'directory_read'),
      ('event_domains', 'directory_insert'),
      ('event_domains', 'directory_update'),
      ('event_domains', 'directory_delete'),
      ('event_open_to', 'directory_read'),
      ('event_open_to', 'directory_insert'),
      ('event_open_to', 'directory_update'),
      ('event_open_to', 'directory_delete'),
      ('profiles', 'profile_read'),
      ('profiles', 'profile_update'),
      ('app_admins', 'admin_read'),
      ('club_managers', 'managers_read'),
      ('club_managers', 'managers_write'),
      ('recruitment_applications', 'application_read'),
      ('interview_slots', 'slots_read'),
      ('interviews', 'interview_read'),
      ('interview_notes', 'notes_read')
    ) as previous_policies(table_name, policy_name)
  loop
    if to_regclass(format('public.%I', old_policy.table_name)) is not null then
      execute format('drop policy if exists %I on public.%I',
                     old_policy.policy_name, old_policy.table_name);
    end if;
  end loop;
end;
$$;

drop table if exists public.interview_notes;
drop table if exists public.interviews;
drop table if exists public.interview_slots;
drop table if exists public.recruitment_applications;
drop table if exists public.event_open_to;
drop table if exists public.event_domains;
drop table if exists public.project_open_to;
drop table if exists public.project_domains;
drop table if exists public.club_open_to;
drop table if exists public.club_domains;
drop table if exists public.year_groups;
drop table if exists public.domains;
drop table if exists public.events;
drop table if exists public.student_projects;
drop table if exists public.club_managers;
drop table if exists public.clubs;
drop table if exists public.app_admins;
drop table if exists public.profiles;
drop function if exists public.can_manage_icon(text);
drop function if exists public.can_manage_club(uuid);
drop function if exists public.is_app_admin();
drop function if exists public.handle_new_user();
drop function if exists public.touch_updated_at();
-- No DELETE/TRUNCATE against storage tables: bucket is intentionally retained.
commit;
