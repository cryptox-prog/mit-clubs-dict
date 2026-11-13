# Redis and PostHog setup

No SQL migration is needed. These integrations reuse the existing API and accounts.

## Redis

Add your provider's Redis connection URL to **backend/.env**:

```dotenv
REDIS_URL=rediss://USERNAME:PASSWORD@YOUR_REDIS_HOST:PORT
```

Use the Redis TCP/TLS URL, not an HTTPS REST URL. Copy the credentials locally;
do not put this URL in a Vite variable or paste it into chat. A locally running
Redis server can use `redis://127.0.0.1:6379`. Restart the backend; startup should
print `Request limits: Redis (shared)`. Startup fails if a configured Redis service
cannot connect within ten seconds. Without REDIS_URL, development uses memory;
production requires Redis. Use a dedicated Redis database for this application's
counters and retain keys until their expiry.

| Requests | Limit per IP per 15 minutes |
| --- | --- |
| Signup | 5 |
| Login | 20 |
| Refresh | 120 |
| Management writes | 60 |
| Directory lists and icon requests combined | 600 |

Each limiter has its own Redis key prefix. Atomic Lua scripts update counters and
expiry together, so multiple Node processes share the same quota. Responses include
RateLimit headers and excess requests return 429 with Retry-After. Redis connection
loss returns 503 on limited routes rather than switching to fresh memory counters.
Clients reconnect automatically and reload scripts after a Redis restart. Each
command has a two-second deadline. Health liveness stays available; readiness
(`/api/health/ready`) checks both Supabase and Redis. Cached browser images do not
make requests and therefore do not consume API quotas.

The server deliberately does not trust forwarded IP headers. If you later add a
reverse proxy, configure trust for that specific deployment so limits use the real
client IP; otherwise requests through the proxy share its IP quota.

To reproduce the isolated real Redis test, install Redis locally and run:

```sh
cd backend
REDIS_TEST_SERVER=/absolute/path/to/redis-server node --test test/redis.integration.test.js
```

This starts a disposable localhost Redis with no persistence, verifies limits across
two API instances, flushes only that test instance's scripts and tests outage recovery.
The test never connects to REDIS_URL or the hosted database. Regular `npm test` skips
it unless REDIS_TEST_SERVER is set.

## PostHog

Create/select a PostHog project and open its JavaScript setup instructions. Put the
**public project token** (`phc_...`) and the ingestion host into the **root .env**:

```dotenv
VITE_POSTHOG_KEY=phc_YOUR_PROJECT_TOKEN
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

Use your project's host; EU Cloud uses `https://eu.i.posthog.com`. Do not use a
personal API key, Redis URL, JWT secret or Supabase secret in frontend variables.
Keep the existing VITE_API_BASE_URL if already configured. Restart Vite after editing
the root .env, or rebuild the frontend for deployment. Vite embeds these public
settings at build time. A missing token or invalid host leaves analytics disabled.

| Event | Properties supplied by the app |
| --- | --- |
| `$pageview` | Initial page load, once outside React effects |
| `directory_tab_viewed` | Category |
| `directory_searched` | Category, query length, result count; debounced 700 ms |
| `directory_filters_changed` | Category, filter count |
| `application_link_clicked` | Listing UUID, category, recruitment status |
| `account_signed_up` / `account_signed_in` | Successful action only |
| `account_signed_out` | Whether all sessions were revoked |

PostHog identifies signed-in users by their custom account UUID and resets identity
on logout/session loss or account switches. Refreshing a session does not record a
new login. Anonymous activity uses the SDK's anonymous ID. PostHog's localStorage
holds analytics identifiers separately from the directory cache; it does not hold
authentication tokens. Normal SDK browser/session metadata is included.

Autocapture, session recordings, surveys, performance/error capture and feature flag
requests are disabled. The app does not pass names, emails, passwords, JWTs, raw
search text, application URLs or management form contents to analytics. URL query
strings/fragments and automatic person properties are stripped before delivery.
Do Not Track and the SDK's bot filtering are respected. SDK loading is lazy; missing
configuration, blocked requests or a failed import do not block app functionality.

Open PostHog's live events view, then visit the site, change tabs, search and apply
filters. An Apply event appears only when clicking an available Apply link; closed
recruitment does not expose one. Confirm the events and their properties in live
events. This integration was checked with the real browser SDK and mocked ingestion;
delivery to your hosted project still requires your project's token/host.

Implementation references: [PostHog JavaScript configuration](https://posthog.com/docs/libraries/js/config)
and [Node Redis production usage](https://redis.io/docs/latest/develop/clients/nodejs/produsage/).
