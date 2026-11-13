# MIT Clubs Directory

## What

This will serve as a central repository of all clubs and event going on in Manipal. Its main focus wull be to be a collected source of information for ongoing recruitments.

## Future Work

- The current theming is temprory will shift to material dark or smth later on
- Maybe create a truly centralized system, i.e., have clubs putting there information here, then the interviews and like also being schedued here. seems like a reach.


## Run the connected directory

Use two terminals (Node.js 22.18+ for the TypeScript test runner):

```sh
# Terminal 1
cd backend
npm install
# Configure backend/.env using backend/.env.example if not done yet.
npm run dev
```

```sh
# Terminal 2, repository root
npm install
npm run dev
```

Open the Vite URL (normally http://localhost:5173). Vite forwards `/api` requests
to Node at `127.0.0.1:3000`, including private-bucket icons. If you change the API
port, update `vite.config.ts` too. Supabase URL/secret keys stay in backend/.env;
React never talks directly to Supabase.

For separate-origin production hosting, set public `VITE_API_BASE_URL` (see root
`.env.example`) before building, and add the frontend origin to backend
`CORS_ORIGINS`. Otherwise configure your host to proxy `/api` to Node. Vite's
proxy is for local dev/preview only; `dist/` alone does not host the Node API.

Directory cards use API data and display loading, retry and empty states.
Domains come from the selected category. Search and selected filters apply
locally to that category; filters match any selected domain/type. Entries with
missing recruitment dates show “Recruitment not announced” and have no Apply
button. Recruitment deadlines include the entire final day in Asia/Kolkata.
Missing or failed logo images fall back to initials.

Validation: `npm test`, `npm run build`; API checks: `cd backend && npm test`.
Data/logo setup is documented in [docs/directory-seed.md](docs/directory-seed.md).


## Browser caching

Public directory responses are cached in memory and `localStorage`, separately
for each category and API origin. Fresh data is reused for five minutes, including
across reloads. Older saved data (up to 24 hours) renders immediately while a
background request updates it. The active tab checks freshness every minute,
when the window regains focus, and when connectivity returns. Concurrent loads
share one request, including React StrictMode remounts. Failed refreshes keep
saved results visible with a refresh notice; no successful cache is replaced by
an error. Blocked/full storage gracefully falls back to in-memory caching.

Only public directory fields are persisted. No credentials or private user data
are stored by this cache. The data-format version and backend origin namespace
prevent sharing records across incompatible deployments. Cached JSON is validated;
corrupt or expired records are discarded. The app shell itself is not an offline
PWA, so caching directory data does not promise full offline page loads.

Uploaded logos use content-hash object names. Their API URLs now change only when
the icon path changes (not on unrelated club edits), and are HTTP-cached by the
browser for up to one year with `immutable`. Old versions redirect to the current
URL on a cache miss; manually named icons have a five-minute cache instead. Use
the existing importer to replace a logo with a new content-hash filename; do not
overwrite different bytes under an existing hash. Browser storage eviction can
remove cached data/images at any time. No service worker is installed.


## Authentication

Run the additive [supabase/auth_functions.sql](supabase/auth_functions.sql)
migration once in Supabase SQL Editor, then restart the backend if it is not
running in watch mode. Existing backend JWT/Supabase settings still apply; no
new key or database password is needed locally. The bottom-right **Account menu** person button opens an animated menu: Sign in
and Create account while signed out; account details and sign-out actions while
signed in. The menu supports outside-click dismissal, Escape and arrow keys.

Access tokens stay in memory; HttpOnly refresh cookies restore sessions on reload.
Authentication does not cache accounts, credentials or tokens in localStorage.
Production requires HTTPS and `REDIS_URL` for shared auth rate limits. Email
verification/password-reset delivery are separate work.
See [backend/README.md](backend/README.md) for the API and security behavior.

## Directory management

Run [supabase/management.sql](supabase/management.sql) in Supabase SQL Editor
after the auth migration. This is additive; keep the existing data and icons.
Restart the backend after installing its dependencies (`cd backend && npm install`).
Sign up, then bootstrap your administrator in SQL Editor using your registered email:

```sql
insert into public.app_admins(user_id)
select id from public.users where email = 'your-registered-email@example.com'
on conflict do nothing;
```

Open the bottom-right account menu → **Manage listings**. Administrators can edit
all existing listings and assign/remove registered managers by email. Club managers
can edit their club and its linked projects/events; direct project managers can edit
their assigned projects. The editor supports descriptions, domains, eligibility,
recruitment dates, application links, event times and logo replacement. Leave
recruitment dates empty when recruitment is not announced. Saves refresh the public
directory cache. Conflicting edits require reloading before saving again.

Logo uploads go through authenticated Node endpoints to the private Supabase
Storage bucket; no browser Storage credentials or additional AWS keys are needed.
PNG/JPEG/WebP/GIF/AVIF inputs up to 5 MiB are decoded and resized into PNG files
with content-hash paths. Old objects remain intact. Creating/deleting listings and
recruitment interview workflows are not part of this dashboard yet.

## Redis and analytics

Set `REDIS_URL` in `backend/.env` for shared Redis rate limits. Set
`VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST` in the root `.env` for browser analytics,
then restart the backend and Vite. No database changes are needed.
See [Redis and PostHog setup](docs/analytics-and-redis.md) for keys, tracked events,
limits, verification and deployment behavior.

Resource-capped load testing is documented in [the test guide](docs/load-testing.md).
See the [13 November 2026 results](docs/load-test-report.md) for measured latency,
resource use and quota-related limits; these are gradual visits, not concurrent-user claims.
