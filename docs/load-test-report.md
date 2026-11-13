# Load-test results — 13 November 2026

Tests ran on the local laptop, approximately 12:19–12:28 IST. Targets mean total
gradually arriving visits, as requested, **not simultaneous users**. Traffic went
through a dedicated Node listener to the configured live Supabase and Redis.

| Target | Completed journeys | HTTP requests | Request p95 | Request p99 | Outcome |
| --- | --- | --- | --- | --- | --- |
| 100 | 99/100 | 528 | 666.91 ms | 1112.65 ms | One 503; remaining journeys completed |
| 1,000 | 993/1,000 | 5382 | 657.01 ms | 1057.78 ms | All 1,000 started; the 384 MiB traffic guard stopped the last 7 journeys |
| 10,000 | Not started | — | — | — | Skipped after the traffic guard stopped the preceding stage |

The first pilot also began a 1,000-visitor stage and stopped at its initial
128 MiB budget after 317 starts and 269 completions. A separate continuation used
a 384 MiB budget and admitted all 1,000 visitors. That partial pilot is recorded
in the raw results, but is not combined with the continuation to manufacture a
1,000-visitor pass.

## What these results establish

Under this specific browsing model, the API sustained approximately
17.2 requests/second for
313.2 seconds, with a 293.93 ms median request
time and 657.01 ms p95. No unexpected HTTP errors were observed in the
continuation before the budget stop. Its two 503 responses occurred at the
traffic guard. The 100-visitor pilot had one 503 before reaching a budget limit;
that upstream failure was not traced to a specific provider error. There were no
transport failures or 429 responses.

The 1,000-visitor stage peaked at 48 active journeys, with
at most 12 admitted/in-flight HTTP requests. Anonymous refresh requests correctly
returned 401: 1000 such responses in the continuation are
expected guest behavior, not failed logins. Other than those and the guard's two
503s, the continuation recorded 4380 successful HTTP responses.
Request percentiles exclude tester pacing/queue delays and are not full-page load
times. Protocol-level simulated visitors do not benchmark frontend rendering.

**This is an initial bounded integration/load test, not a maximum-capacity
benchmark. It does not establish support for 1,000 or 10,000 concurrent users,
and the 1,000-visit journey target did not fully complete.**

## Laptop resource protection

| Process | Enforced RAM cap | Enforced CPU cap | Peak cgroup-accounted memory |
| --- | --- | --- | --- |
| Server | 384 MiB | Half of one core | 105.3 MiB |
| Tester | 256 MiB | Half of one core | 43.3 MiB |
| Supervisor | 192 MiB | One fifth of one core | Not sampled |

The test processes had zero swap allocation, low scheduling priority and bounded
tasks. Server peak sampled RSS was about
160 MiB; RSS includes
shared pages and differs from cgroup-accounted memory. At least
5154 MiB of host memory
remained available in the resource samples. All four server/tester units were
confirmed inactive afterward. No resource-cap failure or sustained event-loop
stall stopped either run.

## Cloud quota impact and the 10,000-visit decision

Both runs together read **512.03 MiB of decoded Supabase
response bodies**, across 10,420 upstream requests.
The counts include directory queries, icon metadata queries and icon downloads.
They are application measurements, not the provider's billing meter; headers, TLS,
compression and in-flight chunks can make billed transfer differ.

At the continuation's measured average, 10,000 comparable visits project to about
**4.03 GB** of Supabase
response bodies, before other site usage. This is an extrapolation, not a completed
10,000-user result. Supabase Free includes 5 GB uncached egress, and the remaining
monthly allowance was not independently verified. Spending most of that allowance
on a single test would leave little room for normal use. The test therefore
stopped at its smaller budget.

Redis's free plan permits 100 operations/second, 30 connections and 30 MB memory.
The test capped HTTP traffic at 18 requests/second, because Lua rate-limit calls
also execute internal Redis operations. A single Redis connection was reused,
with isolated test prefixes and normal 15-minute expiry. No production counter
was flushed or reset.

PostHog accepted **45 sampled synthetic events**, all tagged
`load_test=true` and a run ID, with person processing disabled. Full-volume
analytics ingestion was not stress-tested. Exclude these tags from actual product
usage reports. No Supabase accounts, listings, recruitment records or storage
objects were created or edited.

## Practical conclusion

The stack works under the tested, paced browsing load and stayed within the
laptop resource limits. Further testing should use a separate staging project
and an explicit provider quota budget. Optimize and measure cold-logo delivery
first: current icon downloads dominate the projected transfer, and each uncached
icon also requires a metadata database read. Existing browser caches help repeat
visits; the run modeled a 35% warm-returning probability (30.7% occurred in the
continuation). These percentages were assumptions rather than production data.

Reproduction and caveats: [bounded load-testing guide](load-testing.md).
Raw data: [pilot summary](load-tests/20261113064912/summary.json),
[continuation summary](load-tests/20261113065257/summary.json),
[continuation resource samples](load-tests/20261113065257/resources.csv).

Limits checked against [Supabase egress documentation](https://supabase.com/docs/guides/platform/manage-your-usage/egress),
[Redis Cloud free-plan limits](https://redis.io/docs/latest/operate/rc/subscriptions/view-essentials-subscription/essentials-plan-details/),
and [PostHog pricing](https://posthog.com/pricing).
