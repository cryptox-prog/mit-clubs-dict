# MIT Manipal directory seed

Run **`supabase/seed_directory.sql`** in Supabase SQL Editor after the custom-auth
initialization. Do not rerun init or rollback to import data. The seed transaction
adds **59 clubs/chapters/organizations and 20 independent student projects**.
It does not create events, users or fictional manager assignments.

All new entries have null recruitment dates, application links and icon paths.
There are no eligibility associations: eligibility has not been verified. Treat
missing recruitment dates as **“Recruitment not announced”**, not an open campaign
or proof a team is currently inactive. This is the requested initial state, not a
claim that every organization has been checked for current recruitment.

The seed also drops NOT NULL from `student_projects.club_id`, matching the updated
init: independent teams are not children of invented clubs. Projects still retain
a foreign key when a genuine parent club is supplied. Do not assume every project
has a joined club in future API queries or manager checks.

## Research and scope

Researched 13 November 2026. Every entity has a source URL and stable UUID in
[`backend/data/directory-seed.json`](../backend/data/directory-seed.json).
Sources include:

- [Institutional MIT technical club listing](https://smude.edu.in/mit/mit-experience/student-welfare/technical-clubs.html)
- [Institutional major projects listing](https://www.manipal.edu/mit/mit-experience/mit-videos/major-student-projects.html.html)
- [MTTN technical clubs](https://freshers.manipalthetalk.org/articles/clubs-manipal-technical)
- [MTTN nontechnical clubs](https://freshers.manipalthetalk.org/articles/clubs-mit-non-technical)
- [MTTN student projects](https://freshers.manipalthetalk.org/articles/clubs-manipal-technical-teams)
- [MTTN directory](https://freshers.manipalthetalk.org/clubs)

Some institutional legacy URLs now redirect or render inconsistently; the
institutional technical listing remains accessible through its SMU-hosted mirror.
MTTN describes its material as archive-based. This is a curated starting dataset,
not an exhaustive or confirmed-current official registry. Older names such as
Google Developer Student Clubs are retained as listed, pending branding checks.
RnC, S.W.A.R.M and Combat Robotics appear as projects here based on the project
article; the MTTN directory's categories are inconsistent with that article.
Team Synergy is listed by the institutional project source. Newer teams may be
missing. MAHE-wide organizations (e.g. VSO/AIESEC) are included as campus community
options, not represented as exclusive to MIT.

Descriptions are deliberately short, with null where only identity was checked.
Domain labels are editorial discovery tags, not advertised recruitment positions.
The current two-value `club_kind` groups social/media/literary activities under
Cultural; richer categories can be introduced later.

## Reruns and logos

Seed UUIDs are deterministic. Existing rows with those IDs are not overwritten,
so rerunning does not erase edited descriptions, recruitment dates or uploaded
logos. Domain associations are inserted without duplicates. Same-name manually
created records with different IDs are not merged automatically; seed first.

Logos cannot be inserted as file bytes through SQL. Leave `icon_path` null until a
real upload succeeds. See [`backend/assets/logos/README.md`](../backend/assets/logos/README.md)
for naming and the uploader. All 79 entries have suggested filenames in the
manifest. 67 logo images are now bundled locally; none have been uploaded to
Supabase automatically. Source URLs and the 12 missing entries are recorded in
`backend/data/logo-sources.json`. See [the contact sheet](logo-preview.jpg).

Official team pages useful for checking logo identity:
[Cryptonite](https://cryptonitemit.in/),
[Mars Rover Manipal](https://www.marsrovermanipal.org/),
[Formula Manipal](https://formulamanipal.com/page/).
The private bucket requires a future Node icon-serving endpoint. Never set a
remote image URL into `icon_path`: it must be a Storage object key.
