# Bounded load testing

This repository includes a protocol-level anonymous browsing simulation. It uses a
separate Express listener and the real configured Supabase, Redis and a small
PostHog sample. It does not launch thousands of browsers or modify the database.

Visitor targets are **gradually arriving total sessions**, as requested, not
simultaneous users. The tester admits only a bounded number of journeys and HTTP
requests at a time. Results therefore measure this traffic envelope; they do not
establish maximum server capacity.

## Resource and cloud safeguards

The Linux user systemd manager must be available. The supervisor checks that it can
create constrained units before generating traffic; there is no unconstrained
fallback. Test server and tester run in separate cgroups:

| Process | Hard memory limit | Maximum CPU | V8 heap |
| --- | --- | --- | --- |
| Test server | 384 MiB | 50% of one core | 192 MiB |
| Tester | 256 MiB | 50% of one core | 128 MiB |

Both use zero swap, low scheduling priority and a 64-task limit. The execution in
this session also caps the supervisor at 192 MiB and 20% of one core. Existing user
servers and browser processes are not stopped or changed by the test.

There are at most 12 admitted/in-flight requests and 18 HTTP requests per second.
The rate ceiling accounts for the Redis free plan's 100 operations/second; a rate
limiter request uses Lua plus Redis operations inside that script, not necessarily
one operation. Redis free also allows 30 connections and 30 MB of memory. This test
uses one shared Redis connection in its server and a separate expiring key prefix,
so it does not exhaust the normal application's client-IP quotas.

The default run stops at 128 MiB of decoded Supabase response bodies or 10,000
Supabase requests. The `--continuation` profile permits up to 384 MiB of additional
Supabase bodies, to finish a larger stage after measuring the pilot. Across the
pilot and continuation this is approximately 512 MiB of decoded upstream bodies;
headers, TLS and provider accounting can differ. Concurrent responses may overshoot
a byte stop by a small number of chunks. Storage downloads **and icon metadata
queries** are measured. Directories are not silently server-cached for this test.

The supervisor stops when host available memory falls below 1.5 GiB, the server
exits, its event-loop delay remains above 1.5 seconds, or time/traffic budgets are
reached. The tester also stops after sustained HTTP errors. Logs and periodic
checkpoints remain available even if a child hits its cgroup limit.

Supabase's free plan includes 5 GB uncached egress. This test cannot inspect the
project's remaining monthly Supabase quota with the service-role key; the additive
test budget is deliberately far smaller. PostHog's free analytics allowance is
1 million events/month. At most 500 synthetic events are sent per test run, sampled
from 1% of visitors; all carry `load_test=true` and `load_test_run_id`, and request no
person profiles. Exclude these events from real usage dashboards.

References: [Redis free limits](https://redis.io/docs/latest/operate/rc/subscriptions/view-essentials-subscription/essentials-plan-details/),
[Supabase egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress),
[PostHog pricing](https://posthog.com/pricing).

## Browsing model

- Every visitor starts on Clubs and makes an anonymous refresh-cookie request.
  A 401 from this request is expected, since the visitor has no login cookie.
- 35% are modeled as returning visitors with a fresh cached Clubs list and logos;
  the remainder fetch the list and 2–4 initially visible logos.
- 55% search and 30% use filters. These actions happen locally in the real frontend,
  so they generate modeled analytics rather than extra directory API requests.
- 35% scroll far enough to request two additional logos; already cached icons are
  skipped. 30% browse projects and 10% browse events.
- Short think times of about 0.3–3.2 seconds separate actions. Workers ramp in, reuse
  per-session cache state, then admit later visitors.
- Distinct loopback source addresses represent different client IPs. No proxy
  headers are spoofed and production rate limits remain enabled.

These percentages are explicit assumptions, not measured production traffic. HTTP
connections close after each request to prevent thousands of idle sockets on the
laptop. This differs from browser keepalive/HTTP2 and can add connection overhead.
The client-to-Node path is local; the Node-to-cloud network is real. Browser CPU,
rendering, password hashing, authenticated refresh rotation, management writes and
recruitment workflows are outside this scenario. No external application links are
loaded. Request percentiles exclude tester pacing/queue waits and are not full-page
load times.

## Run and stop

From the project root, with the existing backend and PostHog env configured:

```sh
node backend/scripts/load-test/run.js
```

The default plan attempts 100, 1,000 and 10,000 visits and stops at its budgets.
Running it uses real cloud quota. The continuation profile is explicitly larger:

```sh
node backend/scripts/load-test/run.js --continuation
```

The command prints its run directory under `docs/load-tests/`. To stop gracefully,
create `STOP` in that directory, or interrupt the supervisor. Linux cgroup limits
remain active until processes exit. All test processes are stopped on completion.
Only the test's Redis counters are created; they expire naturally after 15 minutes.
No Redis database flush, Supabase reset, account creation or logo upload is used.

Each run preserves `plan.json`, `summary.json`, `results.json`, resource samples and
logs. Expected anonymous 401 responses are separate from unexpected errors. Near a
quota stop, the test's guard can generate 503 responses; those are budget-control
responses and must not be presented as proof of application overload. Partial
stages are not passes and must never be described as their full visitor target.
