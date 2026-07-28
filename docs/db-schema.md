# Database Schema

This model keeps clubs and student projects as independent entities, while events are hosted by at least one club, student project, department, or external organization.

## Core Tables

```sql
create type entity_kind as enum ('club', 'student_project', 'organization');
create type event_host_kind as enum ('entity', 'external_organization');
create type audience_scope as enum ('everyone', 'mit_students', 'custom');

create table entities (
  id uuid primary key default gen_random_uuid(),
  kind entity_kind not null,
  name text not null,
  slug text not null unique,
  subtitle text,
  description text not null,
  icon_url text,
  website_url text,
  application_url text,
  application_start_at timestamptz,
  application_end_at timestamptz not null,
  default_eligibility_rule_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null,
  icon_url text,
  event_start_at timestamptz,
  event_end_at timestamptz,
  venue text,
  application_url text,
  application_start_at timestamptz,
  application_end_at timestamptz not null,
  eligibility_rule_id uuid,
  min_team_size integer,
  max_team_size integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table external_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  website_url text
);

create table event_hosts (
  event_id uuid not null references events(id) on delete cascade,
  host_kind event_host_kind not null,
  entity_id uuid references entities(id) on delete cascade,
  external_organization_id uuid references external_organizations(id) on delete cascade,
  primary key (event_id, host_kind, entity_id, external_organization_id),
  check (
    (host_kind = 'entity' and entity_id is not null and external_organization_id is null)
    or
    (host_kind = 'external_organization' and external_organization_id is not null and entity_id is null)
  )
);
```

## Eligibility

Use one eligibility rule per application surface. This avoids hard-coding every possible phrase like "only first and second years" as separate enum values.

```sql
create table eligibility_rules (
  id uuid primary key default gen_random_uuid(),
  scope audience_scope not null,
  label text not null,
  created_at timestamptz not null default now()
);

create table eligibility_rule_years (
  eligibility_rule_id uuid not null references eligibility_rules(id) on delete cascade,
  study_year smallint not null check (study_year between 1 and 4),
  primary key (eligibility_rule_id, study_year)
);

create table eligibility_rule_branches (
  eligibility_rule_id uuid not null references eligibility_rules(id) on delete cascade,
  branch_code text not null,
  primary key (eligibility_rule_id, branch_code)
);

alter table entities
  add constraint entities_default_eligibility_rule_id_fkey
  foreign key (default_eligibility_rule_id) references eligibility_rules(id);

alter table events
  add constraint events_eligibility_rule_id_fkey
  foreign key (eligibility_rule_id) references eligibility_rules(id);
```

Example meanings:

```text
everyone: label = "Everybody", no year rows.
mit_students: label = "Only MIT Students", no year rows.
custom + years 1: label = "Only First Years".
custom + years 1,2: label = "Only First and Second Years".
custom + years 3: label = "Only Third Years".
custom + years 4: label = "Only Fourth Years".
```

## Discovery Metadata

```sql
create table domains (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table entity_domains (
  entity_id uuid not null references entities(id) on delete cascade,
  domain_id uuid not null references domains(id) on delete cascade,
  primary key (entity_id, domain_id)
);

create table event_domains (
  event_id uuid not null references events(id) on delete cascade,
  domain_id uuid not null references domains(id) on delete cascade,
  primary key (event_id, domain_id)
);
```

## Notes

- `entities.kind = 'club'` represents clubs.
- `entities.kind = 'student_project'` represents student projects.
- `entities.kind = 'organization'` is for MIT departments or official bodies that can host events but are not clubs or student projects.
- `application_end_at` is required on both `entities` and `events`, because every card needs an application deadline.
- Team size lives on `events`, because it generally describes event participation. Add a separate recruitment/application table later if clubs or student projects need role-specific team/group constraints.
- Eligibility lives in `eligibility_rules`, so the UI can render a friendly `label` while filters can still query structured year/branch/scope rows.
- Events should have at least one row in `event_hosts`; enforce that in service code or with a deferred database trigger.
