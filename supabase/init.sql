-- MIT Clubs Dictionary: CUSTOM AUTH + SERVER-ONLY Supabase initialization.
-- Run ONCE as postgres in Supabase SQL Editor after undo_previous_init.sql,
-- or on a fresh Supabase project. Not an in-place migration; no tables dropped.
-- All app tables are in public. Supabase Auth is unused. Its built-in schemas
-- remain intact; this script creates NO auth.users links or signup triggers.
--
-- ARCHITECTURE:
-- Browser -> Node.js API (verifies OUR JWT) -> Supabase with service_role key.
-- RLS enabled, NO client policies, and no anon/authenticated/PUBLIC table grants.
-- service_role bypasses RLS; Node MUST authorize every operation, even reads.
-- Never forward the custom JWT as the Supabase client's Authorization header:
-- the server Supabase client always authenticates with its own service-role key.
-- Never expose that key in VITE_* variables or return credentials/password hashes.
-- JWT signing keys are separate from the Supabase service-role key, stored in
-- Node environment/secrets. SQL does not issue tokens or validate passwords.
--
-- PASSWORDS / SESSIONS:
-- Node hashes passwords with Argon2id and stores the encoded hash (salt/parameters
-- included) in password_hash. No plaintext passwords or access JWTs are stored.
-- Access JWT: short expiry, verified algorithm/signature/issuer/audience/exp,
-- sub = users.id, sid = auth_sessions.id. Node checks account/session status for
-- immediate revocation; otherwise issued access JWTs last until their expiry.
-- Refresh token: high-entropy random opaque secret in HttpOnly Secure cookie.
-- Only SHA-256 hex digest goes into refresh_tokens; never store raw refresh tokens.
-- Refresh atomically in a DB transaction: lock session+token, check active session,
-- expiry and consumed_at, consume old token, insert replacement. Reuse revokes
-- the entire session. Keep consumed token rows until session expiry for detection.
-- Multi-request supabase-js REST calls are NOT a transaction: use a server pg
-- connection/transaction (Supabase pooler) or a carefully implemented server RPC.
-- Revoke all sessions on password reset; rate limit auth endpoints with Redis.
-- Verification/reset secrets are hashed in auth_action_tokens, consumed once.
-- CSRF defenses for cookie endpoints, email delivery and JWT logic live in Node.
--
-- ICONS:
-- Private bucket assets: all uploads AND downloads pass through Node.
-- Keys: clubs/<club UUID>/<filename>, projects/<project UUID>/<filename>,
-- events/<event UUID>/<filename>. Store the key only in icon_path (no URL/bucket).
-- Node checks manager permissions, uploads via Storage API, then saves icon_path.
-- To serve: Node downloads with service_role and streams bytes. getPublicUrl
-- will NOT work for this private bucket. Signed URLs are an optional future
-- optimization but would allow downloads to bypass Node until they expire.
-- Use Storage API to delete bytes when replacing/deleting icons; SQL row deletion
-- does not clean up files. No FK to storage.objects. Use versioned filenames.
-- 5 MiB max, PNG/JPEG/WebP/GIF/AVIF; no SVG. Node also validates actual file bytes.
--
-- BOOTSTRAP: after Node signup creates a public.users row, run in SQL Editor:
-- insert into public.app_admins(user_id) values ('<public.users UUID>');
-- Signup never accepts admin/manager roles from user input.
-- Directory application dates are inclusive Asia/Kolkata calendar dates;
-- event and interview times are timestamptz. API enforces eligibility/deadlines.
-- Redis, PostHog, SMTP, Node endpoints and JWT signing need application code.

begin;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null check (
    email = lower(btrim(email)) and length(email) between 3 and 254
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ),
  password_hash text not null check (password_hash like '$argon2id$%'),
  full_name text not null default '' check (length(full_name) <= 150),
  year_group_id smallint check (year_group_id between 1 and 4),
  email_verified_at timestamptz,
  disabled_at timestamptz,
  password_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email)
);
-- Browser responses must select safe user columns explicitly; never select *.
create table public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > created_at)
);
create index auth_sessions_user_idx on public.auth_sessions(user_id);
create index auth_sessions_expiry_idx on public.auth_sessions(expires_at);
create table public.refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.auth_sessions(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  check (expires_at > created_at),
  check (consumed_at is null or consumed_at >= created_at)
);
create index refresh_tokens_session_idx on public.refresh_tokens(session_id);
-- At most one unconsumed refresh token per session. In the same transaction,
-- mark the old one consumed BEFORE inserting its replacement.
create unique index refresh_tokens_one_active_idx
  on public.refresh_tokens(session_id) where consumed_at is null;
create table public.auth_action_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  purpose text not null check (purpose in ('verify_email', 'reset_password')),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  check (expires_at > created_at),
  check (consumed_at is null or consumed_at >= created_at)
);
create index auth_action_tokens_user_idx on public.auth_action_tokens(user_id);
create index auth_action_tokens_expiry_idx on public.auth_action_tokens(expires_at);

create table public.app_admins (
  user_id uuid primary key references public.users(id) on delete cascade
);
create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  description text,
  club_kind text not null check (club_kind in ('Technical', 'Cultural')),
  icon_path text,
  application_start date,
  registration_deadline date,
  apply_link text check (apply_link is null or apply_link ~ '^https://[^[:space:]]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (registration_deadline >= application_start),
  check (icon_path is null or icon_path ~ ('^clubs/' || id::text || '/[^/]+$'))
);
create table public.club_managers (
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  primary key (club_id, user_id)
);
create index club_managers_user_idx on public.club_managers(user_id);
create table public.student_projects (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references public.clubs(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  description text,
  icon_path text,
  application_start date,
  registration_deadline date,
  apply_link text check (apply_link is null or apply_link ~ '^https://[^[:space:]]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (registration_deadline >= application_start),
  check (icon_path is null or icon_path ~ ('^projects/' || id::text || '/[^/]+$'))
);
create index student_projects_club_idx on public.student_projects(club_id);
create table public.events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  description text,
  icon_path text,
  application_start date,
  registration_deadline date,
  event_start timestamptz,
  event_end timestamptz,
  participation_type text check (participation_type in ('INDIVIDUAL', 'TEAM')),
  apply_link text check (apply_link is null or apply_link ~ '^https://[^[:space:]]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (registration_deadline >= application_start),
  check (event_end >= event_start),
  check (icon_path is null or icon_path ~ ('^events/' || id::text || '/[^/]+$'))
);
create index events_club_idx on public.events(club_id);
create index events_start_idx on public.events(event_start);
create table public.domains (
  id uuid primary key default gen_random_uuid(),
  name text unique not null check (length(trim(name)) between 1 and 100)
);
create table public.year_groups (
  id smallint primary key check (id between 1 and 5),
  name text unique not null
);
insert into public.domains(name) values
 ('AI'), ('Web Development'), ('Robotics'), ('Cyber Security'), ('UI/UX');
insert into public.year_groups(id,name) values
 (1,'FIRST_YEAR'), (2,'SECOND_YEAR'), (3,'THIRD_YEAR'), (4,'FOURTH_YEAR'), (5,'EVERYONE');
-- EVERYONE is a directory eligibility label, never a student's academic year.

create table public.club_domains (
  club_id uuid not null references public.clubs(id) on delete cascade,
  domain_id uuid not null references public.domains(id),
  primary key (club_id, domain_id)
);
create index club_domains_reverse_idx on public.club_domains(domain_id);
create table public.club_open_to (
  club_id uuid not null references public.clubs(id) on delete cascade,
  year_group_id smallint not null references public.year_groups(id),
  primary key (club_id, year_group_id)
);
create index club_open_to_reverse_idx on public.club_open_to(year_group_id);
create table public.project_domains (
  project_id uuid not null references public.student_projects(id) on delete cascade,
  domain_id uuid not null references public.domains(id),
  primary key (project_id, domain_id)
);
create index project_domains_reverse_idx on public.project_domains(domain_id);
create table public.project_open_to (
  project_id uuid not null references public.student_projects(id) on delete cascade,
  year_group_id smallint not null references public.year_groups(id),
  primary key (project_id, year_group_id)
);
create index project_open_to_reverse_idx on public.project_open_to(year_group_id);
create table public.event_domains (
  event_id uuid not null references public.events(id) on delete cascade,
  domain_id uuid not null references public.domains(id),
  primary key (event_id, domain_id)
);
create index event_domains_reverse_idx on public.event_domains(domain_id);
create table public.event_open_to (
  event_id uuid not null references public.events(id) on delete cascade,
  year_group_id smallint not null references public.year_groups(id),
  primary key (event_id, year_group_id)
);
create index event_open_to_reverse_idx on public.event_open_to(year_group_id);

-- Basic recruitment workflow: one application per student per club.
-- Project/event participation currently uses the external apply_link; no claim of
-- team registration, calendar integration or automatic scheduling is made here.
create table public.recruitment_applications (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  applicant_id uuid not null references public.users(id) on delete cascade,
  statement text check (length(statement) <= 10000),
  status text not null default 'submitted' check
    (status in ('submitted','shortlisted','interview_scheduled','accepted','rejected','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, applicant_id),
  unique (id, club_id)
);
create index recruitment_applicant_idx on public.recruitment_applications(applicant_id);
create table public.interview_slots (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text not null check (length(trim(location)) > 0),
  capacity integer not null default 1 check (capacity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (id, club_id)
);
create index interview_slots_club_time_idx on public.interview_slots(club_id, starts_at);
create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  application_id uuid not null unique,
  slot_id uuid not null,
  status text not null default 'scheduled' check
    (status in ('scheduled','completed','cancelled','no_show')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (application_id, club_id)
    references public.recruitment_applications(id, club_id) on delete cascade,
  foreign key (slot_id, club_id)
    references public.interview_slots(id, club_id) on delete cascade
);
create index interviews_slot_idx on public.interviews(slot_id);
create index interviews_club_idx on public.interviews(club_id);
-- Separate notes so applicants cannot read internal evaluations.
create table public.interview_notes (
  interview_id uuid primary key references public.interviews(id) on delete cascade,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- Default-deny direct Data API access. No permissive RLS policies are created.
alter table public.users enable row level security;
revoke all on table public.users from public, anon, authenticated;
grant select, insert, update, delete on table public.users to service_role;
alter table public.auth_sessions enable row level security;
revoke all on table public.auth_sessions from public, anon, authenticated;
grant select, insert, update, delete on table public.auth_sessions to service_role;
alter table public.refresh_tokens enable row level security;
revoke all on table public.refresh_tokens from public, anon, authenticated;
grant select, insert, update, delete on table public.refresh_tokens to service_role;
alter table public.auth_action_tokens enable row level security;
revoke all on table public.auth_action_tokens from public, anon, authenticated;
grant select, insert, update, delete on table public.auth_action_tokens to service_role;
alter table public.app_admins enable row level security;
revoke all on table public.app_admins from public, anon, authenticated;
grant select, insert, update, delete on table public.app_admins to service_role;
alter table public.clubs enable row level security;
revoke all on table public.clubs from public, anon, authenticated;
grant select, insert, update, delete on table public.clubs to service_role;
alter table public.club_managers enable row level security;
revoke all on table public.club_managers from public, anon, authenticated;
grant select, insert, update, delete on table public.club_managers to service_role;
alter table public.student_projects enable row level security;
revoke all on table public.student_projects from public, anon, authenticated;
grant select, insert, update, delete on table public.student_projects to service_role;
alter table public.events enable row level security;
revoke all on table public.events from public, anon, authenticated;
grant select, insert, update, delete on table public.events to service_role;
alter table public.domains enable row level security;
revoke all on table public.domains from public, anon, authenticated;
grant select, insert, update, delete on table public.domains to service_role;
alter table public.year_groups enable row level security;
revoke all on table public.year_groups from public, anon, authenticated;
grant select, insert, update, delete on table public.year_groups to service_role;
alter table public.club_domains enable row level security;
revoke all on table public.club_domains from public, anon, authenticated;
grant select, insert, update, delete on table public.club_domains to service_role;
alter table public.club_open_to enable row level security;
revoke all on table public.club_open_to from public, anon, authenticated;
grant select, insert, update, delete on table public.club_open_to to service_role;
alter table public.project_domains enable row level security;
revoke all on table public.project_domains from public, anon, authenticated;
grant select, insert, update, delete on table public.project_domains to service_role;
alter table public.project_open_to enable row level security;
revoke all on table public.project_open_to from public, anon, authenticated;
grant select, insert, update, delete on table public.project_open_to to service_role;
alter table public.event_domains enable row level security;
revoke all on table public.event_domains from public, anon, authenticated;
grant select, insert, update, delete on table public.event_domains to service_role;
alter table public.event_open_to enable row level security;
revoke all on table public.event_open_to from public, anon, authenticated;
grant select, insert, update, delete on table public.event_open_to to service_role;
alter table public.recruitment_applications enable row level security;
revoke all on table public.recruitment_applications from public, anon, authenticated;
grant select, insert, update, delete on table public.recruitment_applications to service_role;
alter table public.interview_slots enable row level security;
revoke all on table public.interview_slots from public, anon, authenticated;
grant select, insert, update, delete on table public.interview_slots to service_role;
alter table public.interviews enable row level security;
revoke all on table public.interviews from public, anon, authenticated;
grant select, insert, update, delete on table public.interviews to service_role;
alter table public.interview_notes enable row level security;
revoke all on table public.interview_notes from public, anon, authenticated;
grant select, insert, update, delete on table public.interview_notes to service_role;
create trigger users_updated before update on public.users
for each row execute function public.touch_updated_at();
create trigger clubs_updated before update on public.clubs
for each row execute function public.touch_updated_at();
create trigger student_projects_updated before update on public.student_projects
for each row execute function public.touch_updated_at();
create trigger events_updated before update on public.events
for each row execute function public.touch_updated_at();
create trigger recruitment_applications_updated before update on public.recruitment_applications
for each row execute function public.touch_updated_at();
create trigger interview_slots_updated before update on public.interview_slots
for each row execute function public.touch_updated_at();
create trigger interviews_updated before update on public.interviews
for each row execute function public.touch_updated_at();
create trigger interview_notes_updated before update on public.interview_notes
for each row execute function public.touch_updated_at();

revoke all on function public.touch_updated_at() from public, anon, authenticated;
grant usage on schema public to service_role;

-- Reuse the bucket retained by rollback, or create it on a fresh project.
-- Updating bucket configuration does not delete/move any object bytes.
-- Private bucket: no storage policies grant direct client access.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('assets','assets',false,5242880,
  array['image/png','image/jpeg','image/webp','image/gif','image/avif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
-- Restrictive policies scope the deny to this bucket, even if unrelated
-- permissive Storage policies already exist. service_role bypasses these too.
create policy clubs_dict_assets_server_only on storage.objects
as restrictive for all to anon, authenticated
using (bucket_id <> 'assets') with check (bucket_id <> 'assets');
create policy clubs_dict_bucket_server_only on storage.buckets
as restrictive for all to anon, authenticated
using (id <> 'assets') with check (id <> 'assets');

commit;

-- AFTER RUNNING:
-- 1. Configure SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY only in Node environment.
-- 2. Configure a SEPARATE JWT signing key + issuer/audience in Node environment.
-- 3. Implement signup/login/refresh/logout, password reset, and email verification.
-- 4. Bootstrap an admin after signup; API enforces admin/club-manager permissions.
-- 5. Implement slot booking in a transaction with SELECT ... FOR UPDATE on slot;
--    capacity and state transitions are NOT enforced by these tables alone.
-- 6. Implement icon proxy/upload routes. Storage credentials never leave Node.
-- 7. Verify anonymous/authenticated clients cannot query tables or access assets;
--    verify Node service_role client can. Never attach user JWTs to that client.
-- Existing Supabase Auth accounts are unrelated: users must register through Node.
