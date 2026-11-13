# Database Schema

This schema models clubs, student projects, and events as separate Supabase/PostgreSQL tables. Domains and year groups are normalized through join tables so filtering can stay structured without duplicating labels across records.

## Clubs

```sql
create table clubs (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  description text,

  icon_path text,

  application_start date,
  registration_deadline date,

  apply_link text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## Student Projects

```sql
create table student_projects (
  id uuid primary key default gen_random_uuid(),

  club_id uuid references clubs(id) on delete cascade,

  title text not null,
  description text,

  icon_path text,

  application_start date,
  registration_deadline date,

  apply_link text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## Events

```sql
create table events (
  id uuid primary key default gen_random_uuid(),

  club_id uuid references clubs(id) on delete cascade,

  title text not null,
  description text,

  icon_path text,

  application_start date,
  registration_deadline date,

  event_start timestamptz,
  event_end timestamptz,

  participation_type text check (
    participation_type in ('INDIVIDUAL', 'TEAM')
  ),

  apply_link text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## Domains

```sql
create table domains (
  id uuid primary key default gen_random_uuid(),

  name text unique not null
);
```

Example domain rows:

```text
AI
Web Development
Robotics
Cyber Security
UI/UX
```

## Year Groups

```sql
create table year_groups (
  id smallint primary key,

  name text unique not null
);
```

Initial rows:

| id | name |
| --- | --- |
| 1 | FIRST_YEAR |
| 2 | SECOND_YEAR |
| 3 | THIRD_YEAR |
| 4 | FOURTH_YEAR |
| 5 | EVERYONE |

## Club Domains

```sql
create table club_domains (
  club_id uuid references clubs(id) on delete cascade,
  domain_id uuid references domains(id) on delete cascade,

  primary key (club_id, domain_id)
);
```

## Project Domains

```sql
create table project_domains (
  project_id uuid references student_projects(id) on delete cascade,
  domain_id uuid references domains(id) on delete cascade,

  primary key (project_id, domain_id)
);
```

## Event Domains

```sql
create table event_domains (
  event_id uuid references events(id) on delete cascade,
  domain_id uuid references domains(id) on delete cascade,

  primary key (event_id, domain_id)
);
```

## Club Open To

```sql
create table club_open_to (
  club_id uuid references clubs(id) on delete cascade,
  year_group_id smallint references year_groups(id),

  primary key (club_id, year_group_id)
);
```

## Project Open To

```sql
create table project_open_to (
  project_id uuid references student_projects(id) on delete cascade,
  year_group_id smallint references year_groups(id),

  primary key (project_id, year_group_id)
);
```

## Event Open To

```sql
create table event_open_to (
  event_id uuid references events(id) on delete cascade,
  year_group_id smallint references year_groups(id),

  primary key (event_id, year_group_id)
);
```

## Supabase Storage

Create one bucket named `assets`.

```text
assets/
  clubs/
  projects/
  events/
```

Store only the relative path in `icon_path`.

```text
clubs/acm.png
projects/ai-bot.png
events/hackathon-2026.png
```

## Relationships

```text
Club
 ├──< Club Domains >── Domain
 ├──< Club Open To >── Year Group
 │
 ├── Student Projects
 │      ├──< Project Domains >── Domain
 │      └──< Project Open To >── Year Group
 │
 └── Events
        ├──< Event Domains >── Domain
        └──< Event Open To >── Year Group
```

## Notes

- Clubs use `name`; student projects and events use `title`.
- `icon_path` should store the Supabase Storage path, not a duplicated public URL.
- `registration_deadline` is the application close date shown on cards.
- `participation_type` only applies to events and is limited to `INDIVIDUAL` or `TEAM`.
- Domains and open-to year groups are many-to-many so each card can support multiple filters.
- This structure leaves room for future tables such as tags, organizers, gallery images, registrations, and club members.
