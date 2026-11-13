# MIT Clubs API

Requires Node.js 22+. Run from `backend/`:

```sh
npm install
cp .env.example .env
# Fill .env locally, then:
npm run dev
```

`npm start` runs `server.js`; `npm test` runs HTTP and configuration checks.
The entry point validates environment variables before listening. Bind to
`HOST=0.0.0.0` when deploying to a container/host that requires it.

## Configuration

Get the project URL and backend service-role/secret key from Supabase project
settings. Keep the key exclusively in `backend/.env` or your hosting secret store.
Generate a separate JWT secret using the command in `.env.example`. Actual keys
never need to be pasted into chat. No separate AWS keys are needed for the
Supabase Storage API. Optional variables are documented for later integrations.

## Structure

- `server.js`: startup, configuration, listening, graceful shutdown.
- `app.js`: Express composition, independent of listening for tests.
- `config/`: environment validation and dedicated Supabase admin client.
- `route/`: URL mapping; `controller/`: HTTP handlers.
- `middleware/`: request IDs, 404s, central error handling.
- `utils/`: shared errors; `test/`: Node built-in test runner.

## Current endpoints

- `GET /api/health`: process liveness, no database request.
- `GET /api/health/ready`: database connectivity/schema check; 503 if unavailable.
  Uses a five-second timeout and does not return database error details.

- `GET /api/clubs?page=1&limit=100`: public club directory.
- `GET /api/student-projects?page=1&limit=100`: public projects, including independent teams.
- `GET /api/events?page=1&limit=100`: public events; an empty list is valid.
- `GET /api/{clubs|student-projects|events}/:id/icon`: streams that record's
  image from the private bucket. Missing icons return 404. Only image MIME types
  up to 5 MiB are served. Content-hash-named icons have a one-year immutable browser cache
  when requested with their current version URL; unversioned/manually named icons
  have a five-minute cache. ETags are emitted for content-addressed icons; public directory icons are intentionally readable through Node.

List endpoints return `{ data, pagination: { page, limit, total, totalPages } }`.
Pagination limit is 1–200. Relations are returned as flat `domains`/`open_to`
arrays; dates remain strings or null. No user/auth/recruitment-private tables
are exposed. The frontend fetches all pages for local search/filtering.

Custom signup/login, JWT verification, refresh rotation, logout and role middleware
are implemented. Redis-backed auth rate limiting is supported (in-memory locally).
Listing management and manager assignments are implemented below. PostHog runs
in the frontend; recruitment interview workflows are not implemented yet.
CORS is a browser boundary, not authentication. The service-role client bypasses
RLS, so future controllers must enforce authorization before querying private data.
Use atomic PostgreSQL RPCs for transactions; separate Supabase REST requests do not
form a transaction. Refresh rotation and listing edits already use these RPCs.


Directory JSON uses `Cache-Control: no-store` at the HTTP layer; the frontend
manages its own five-minute memory/localStorage cache and revalidation policy.
Icon URL versions derive from the Storage path. A stale `v` redirects to the
current canonical URL with `no-store`, preventing new images being cached under
an old immutable version. Replace icons using new content-hash object names.


## Custom authentication

Run **`supabase/auth_functions.sql`** in Supabase SQL Editor once after the existing
initialization. It is additive and can be reapplied: no reset or seed rerun is
needed. It restricts account creation, session creation, refresh rotation and
revocation RPCs to `service_role`. Node uses these atomic functions through the
existing Supabase client, so `DATABASE_URL` is not required. Supabase Auth remains
unused. The RPC migration is executed in embedded PostgreSQL by `npm test`.

Endpoints (all auth responses use `Cache-Control: no-store`):

| Method | Endpoint | Behavior |
| --- | --- | --- |
| POST | `/api/auth/signup` | Name, email, 12–128 character password, optional year 1–4; returns access JWT and safe user |
| POST | `/api/auth/login` | Email/password; returns access JWT and sets refresh cookie |
| POST | `/api/auth/refresh` | Rotates refresh cookie atomically and returns a new access JWT |
| POST | `/api/auth/logout` | Revokes the cookie's session and clears cookie |
| POST | `/api/auth/logout-all` | Requires Bearer JWT; revokes every session belonging to the caller |
| GET | `/api/auth/me` | Requires Bearer JWT; safe profile plus current admin/manager assignments |

All POST auth requests must include `X-Requested-With: mit-clubs-web`, JSON content
type when sending JSON, and an allowed browser Origin. Fetch uses
`credentials: 'include'`. The server rejects untrusted Origins and missing custom
headers. Cookies are HttpOnly, restricted to `/api/auth`, SameSite=Lax by default,
and Secure with a `__Secure-` name in production. Cross-site deployments can set
`AUTH_COOKIE_SAME_SITE=none` only with secure cookies, but browsers may block
third-party cookies; a same-origin reverse proxy is preferable. Behind a reverse
proxy, configure trusted proxy behavior deliberately before relying on client-IP
limits; the default trusts no forwarded IP headers.

The access JWT is HS256 with fixed issuer/audience, expiry, user `sub`, session
`sid`, and token-use checks. Middleware also checks session revocation/expiry and
account disabled status on each protected request. Roles are read from the DB,
never trusted from signup input or long-lived claims. Reuse
`createAuthMiddleware(...).requireAuth`, `.requireAdmin`, `.requireClubManager`
for future management routes; the latter expects a validated `:clubId` parameter.

Passwords use Argon2id (19 MiB, two iterations, parallelism one). Refresh tokens
are random 48-byte secrets; only SHA-256 digests are stored. Sessions have an
absolute lifetime (default 30 days, configurable 1–30). Refreshes lock the session
and consume/replace its token in one transaction. Replaying a consumed token
commits family revocation before returning 401. Do not delete consumed tokens
while their session can still be refreshed. A lost rotation response can require
signing in again; no insecure replay grace period is added.

Frontend access JWTs stay in memory; cookies restore sessions on reload. Concurrent
refreshes share a promise; Web Locks serialize rotation across tabs. BroadcastChannel
propagates sign-in/out events without broadcasting tokens. Browsers without Web
Locks can require re-login if simultaneous refresh requests trigger replay
protection. Auth data never enters the directory/localStorage cache.

Local development uses per-process in-memory IP limits (signup 5, login 20,
refresh 120 per 15 minutes). Set `REDIS_URL=redis://...` or `rediss://...` for shared
limits. **Production requires REDIS_URL** and secure cookies. Redis outages fail
closed. Shared limits, script reloading and recovery after an outage have been
tested with a disposable real Redis server. Readiness includes Redis when configured.
Set the deployment's HTTPS/reverse proxy correctly.

Email verification delivery, forgotten-password email flows and account editing
are not implemented. Accounts start with `email_verified_at = null`; the UI does
not claim verification. No admin privileges are inferred from an email address.
For bootstrap, sign up normally, then insert that custom user's UUID into
`public.app_admins` through SQL Editor. Existing club manager assignments remain
valid. Run the additive `supabase/management.sql` migration before using the new
project-manager roles or management endpoints; it also preserves existing data.

## Listing management

Apply `auth_functions.sql`, then `management.sql` in Supabase SQL Editor. Do not
rerun the reset/init scripts on the populated database. The root README includes
administrator bootstrap SQL. After registration and bootstrap, the floating account
menu exposes **Manage listings**. No new environment variables are required.

| Method | Endpoint | Behavior |
| --- | --- | --- |
| GET | `/api/manage/access` | Current admin/club/project assignments |
| GET | `/api/manage/dashboard` | Editable listings and filter metadata |
| PATCH | `/api/manage/:kind/:id` | Update full editable fields and filters atomically |
| POST | `/api/manage/:kind/:id/icon` | Multipart `icon` and `expected_updated_at` |
| GET | `/api/manage/:kind/:id/managers` | Admin-only direct manager assignments |
| PUT | `/api/manage/:kind/:id/managers` | Admin-only `{ email, assign }` |

Kinds are `clubs`, `student-projects`, `events`. All routes require a valid custom
access JWT; writes require the custom request header and allowed Origin. Writes
are limited to 60 per 15 minutes per IP, using Redis when configured. SQL functions
are executable only by `service_role`, repeat authorization using Node's verified
JWT subject and enforce optimistic concurrency with `expected_updated_at`.
Ownership and role fields cannot be supplied in listing edits. Domains/eligibility
update in the same database transaction as listing details.

Club managers inherit edit rights for their club's linked events/projects.
`project_managers` supports independent project assignments. Only admins assign
managers, using an existing active account's email. Permission removal takes effect
on subsequent requests. Management responses use `no-store`; private dashboard data
is not persisted in browser storage.

Uploads use Multer (5 MiB limit), signature checks and Sharp decoding with pixel/time
limits. Images become PNGs fitting 512×512; animated images use the first frame.
Node uploads to the existing private bucket, then links the content-hash key to the
listing after another permission/version check. A failed or conflicting link can
leave an unused object; old/unused objects are retained for deliberate cleanup via
the Storage API. Details and logo uploads are separate operations; the UI reports
when details saved but the logo failed. Never delete `storage.objects` with SQL.

`npm test` covers the real additive SQL in embedded PostgreSQL, permissions,
transaction rollback, stale versions, assignment revocation and normalized uploads.
