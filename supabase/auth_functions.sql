-- CUSTOM NODE AUTH: additive migration. Run once AFTER init.sql in SQL Editor.
-- Does not reset tables, seeded data or storage. Functions may be safely replaced.
-- Atomic account/session creation and refresh rotation over the service-role RPC.
-- No additional database password/connection URL is required by the Node API.
-- No JWT/password verification here: Node verifies passwords and signs JWTs.
-- All calls restricted to service_role; never grant browser-role EXECUTE.
-- Consumed refresh tokens remain until session cleanup to detect replay.
begin;

create or replace function public.auth_create_account(
  p_email text, p_password_hash text, p_full_name text, p_year_group_id smallint,
  p_session_id uuid, p_refresh_hash text, p_expires_at timestamptz
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_user public.users%rowtype;
begin
  if p_expires_at <= now() or p_expires_at > now() + interval '31 days' then
    raise exception 'Invalid session expiry';
  end if;
  insert into public.users(email,password_hash,full_name,year_group_id)
    values(p_email,p_password_hash,p_full_name,p_year_group_id) returning * into v_user;
  insert into public.auth_sessions(id,user_id,expires_at)
    values(p_session_id,v_user.id,p_expires_at);
  insert into public.refresh_tokens(session_id,token_hash,expires_at)
    values(p_session_id,p_refresh_hash,p_expires_at);
  return jsonb_build_object('id',v_user.id,'email',v_user.email,
    'full_name',v_user.full_name,'year_group_id',v_user.year_group_id,
    'email_verified_at',v_user.email_verified_at);
end;
$$;

create or replace function public.auth_create_session(
  p_user_id uuid, p_expected_password_hash text, p_session_id uuid,
  p_refresh_hash text, p_expires_at timestamptz
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  v_user public.users%rowtype;
begin
  if p_expires_at <= now() or p_expires_at > now() + interval '31 days' then
    raise exception 'Invalid session expiry';
  end if;
  select * into v_user from public.users where id=p_user_id for update;
  if not found or v_user.disabled_at is not null or v_user.password_hash <> p_expected_password_hash then
    return false;
  end if;
  insert into public.auth_sessions(id,user_id,expires_at) values(p_session_id,p_user_id,p_expires_at);
  insert into public.refresh_tokens(session_id,token_hash,expires_at)
    values(p_session_id,p_refresh_hash,p_expires_at);
  return true;
end;
$$;

create or replace function public.auth_rotate_refresh(p_old_hash text,p_new_hash text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_session_id uuid;
  v_session public.auth_sessions%rowtype;
  v_token public.refresh_tokens%rowtype;
  v_user public.users%rowtype;
begin
  select session_id into v_session_id from public.refresh_tokens where token_hash=p_old_hash;
  if not found then return jsonb_build_object('status','invalid'); end if;
  -- Lock session FIRST: all refreshes for the family serialize on the same row.
  select * into v_session from public.auth_sessions where id=v_session_id for update;
  if not found then return jsonb_build_object('status','invalid'); end if;
  if v_session.revoked_at is not null or v_session.expires_at <= now() then
    return jsonb_build_object('status','invalid');
  end if;
  select * into v_token from public.refresh_tokens where token_hash=p_old_hash for update;
  if not found then return jsonb_build_object('status','invalid'); end if;
  if v_token.consumed_at is not null then
    update public.auth_sessions set revoked_at=now() where id=v_session_id;
    -- Return, don't raise: the revocation MUST COMMIT before Node returns 401.
    return jsonb_build_object('status','reused');
  end if;
  if v_token.expires_at <= now() then return jsonb_build_object('status','invalid'); end if;
  select * into v_user from public.users where id=v_session.user_id;
  if not found then return jsonb_build_object('status','invalid'); end if;
  if v_user.disabled_at is not null then
    update public.auth_sessions set revoked_at=now() where id=v_session_id;
    return jsonb_build_object('status','invalid');
  end if;
  update public.refresh_tokens set consumed_at=now() where id=v_token.id;
  insert into public.refresh_tokens(session_id,token_hash,expires_at)
    values(v_session_id,p_new_hash,v_session.expires_at);
  return jsonb_build_object('status','ok','session_id',v_session_id,
    'expires_at',v_session.expires_at,'user',jsonb_build_object(
      'id',v_user.id,'email',v_user.email,'full_name',v_user.full_name,
      'year_group_id',v_user.year_group_id,'email_verified_at',v_user.email_verified_at));
end;
$$;

create or replace function public.auth_revoke_refresh(p_token_hash text)
returns void language sql security invoker set search_path = '' as $$
  update public.auth_sessions set revoked_at=coalesce(revoked_at,now())
  where id=(select session_id from public.refresh_tokens where token_hash=p_token_hash);
$$;

revoke all on function public.auth_create_account(text,text,text,smallint,uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.auth_create_session(uuid,text,uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.auth_rotate_refresh(text,text) from public,anon,authenticated;
revoke all on function public.auth_revoke_refresh(text) from public,anon,authenticated;
grant execute on function public.auth_create_account(text,text,text,smallint,uuid,text,timestamptz) to service_role;
grant execute on function public.auth_create_session(uuid,text,uuid,text,timestamptz) to service_role;
grant execute on function public.auth_rotate_refresh(text,text) to service_role;
grant execute on function public.auth_revoke_refresh(text) to service_role;

commit;
