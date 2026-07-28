# Query Optimization — Measurement Report

**Date:** 2026-07-28
**Project:** `dyajmgddsiqcnlehqbhl` (Postgres 17.6, us-east-2)
**Conclusion: no query optimization is warranted. Do not add indexes.**

## Why this report exists

A query-optimization pass was requested. The prerequisite for that work is confirming
the database is the dominant cost. It is not — measurably, and by a wide margin. This
document records the measurement so the check does not have to be repeated, and so the
297 advisor findings below are not mistaken for a work queue.

## What was measured

Source: `pg_stat_statements` (v1.11, enabled) and `pg_stat_user_tables`, read from the
live project. These cover the database's entire lifetime since creation on 2026-07-27.

### Application query cost, all time

| Metric | Value |
|---|---|
| Application statements ever executed | 13 |
| Application calls ever executed | 13 |
| **Total application query time, all time** | **26.8 ms** |

Twenty-seven milliseconds. That is the entire measured cost of application queries
against this database since it was created.

### Data volume

| Metric | Value |
|---|---|
| Tables in `public` | 162 |
| Empty tables | 111 |
| **Total live rows, whole database** | **556** |
| Largest table | `rsg_audit_log`, 88 rows |
| Tables never analyzed | 152 |

### What actually consumes time

The top 20 statements by total execution time contain **zero application queries**.
Every entry is Supabase platform activity — dashboard introspection, extension listing,
migration DDL, and backup operations:

| Total ms | Calls | Statement |
|---|---|---|
| 16,239 | 47 | `SELECT name FROM pg_timezone_names` (dashboard timezone picker) |
| 7,551 | 15 | `pg_available_extensions` introspection |
| 3,696 | 47 | pg-meta type-introspection CTE |
| 2,097 | 1 | pg-meta table introspection |
| 1,962 | 11 | pg-meta function introspection |

The single most expensive query against this database is the dashboard populating a
timezone dropdown. It costs 600× more than all application queries combined.

## Why no index should be added

At 556 rows spread over 162 tables, every table fits in a single page or two and is
fully cached. A sequential scan of the largest table reads 88 rows. No index can improve
on that — Postgres will frequently decline to use one at this size regardless, because
a seq scan is genuinely cheaper than an index lookup plus heap fetch.

Adding indexes now would buy nothing readable and cost write throughput permanently.

### The schema is already over-indexed

| Metric | Value |
|---|---|
| Existing indexes | 419 |
| Never scanned | 344 |
| Indexes per table | 2.59 |
| Rows per index | 1.33 |

There are already roughly as many indexes as there are rows of data.

## The advisor findings are not a work queue

`get_advisors(type: performance)` returns **297 findings**. All three categories are
misleading in this specific context:

**176 × `unused_index` (INFO) — false signal, ignore.**
These indexes are reported unused because *nothing has ever queried this database*.
This is not evidence they are unnecessary. Dropping them based on this report would
remove indexes that a real workload may need. Re-run this check only after the
application has served genuine production traffic for a meaningful period.

**108 × `unindexed_foreign_keys` (INFO) — real but latent, do not bulk-apply.**
Structurally valid: an unindexed FK makes cascade deletes and parent-side joins scan the
child table. At 556 rows this costs nothing measurable. Bulk-applying all 108 would push
the schema to ~527 indexes against 556 rows, permanently taxing every write to fix a
problem no measurement shows. Add these individually, when a real query plan shows one
is needed — starting with FKs that carry `ON DELETE CASCADE` on tables expected to grow.

**13 × `multiple_permissive_policies` (WARN) — worth fixing on structural grounds.**
This is the only category with a genuine per-row cost that scales: Postgres evaluates
every permissive policy for a role/action and ORs the results, so each redundant policy
is extra work on every row returned, forever. Affected tables include
`rsg_business_hours` (`rsg_business_hours_admin_write` + `rsg_business_hours_staff_read`
both permissive for `authenticated`/`SELECT`). Consolidating overlapping policies is
worth doing as a correctness-and-clarity matter — RLS policy sprawl is also a security
review concern — but it is not currently a performance problem.

Notably **absent**: `auth_rls_initplan`. The common Supabase mistake of calling
`auth.uid()` unwrapped in a policy — forcing per-row re-evaluation — does not appear.
The policies are written correctly in that respect.

## What to do when there is real traffic

Do not pre-optimize against these notes. When the applications are live and carrying
production data, run this in order:

1. **Reset the baseline** so platform noise does not drown the signal:
   `SELECT pg_stat_statements_reset();`
2. **Let real traffic accumulate** — at least a representative day.
3. **Sort by `total_exec_time`, never by `mean_exec_time`.** A 12 ms query called 4,000
   times per page costs far more than one 900 ms query, and only the second one looks
   slow in a list sorted by duration. This ordering is what surfaces N+1 patterns.
4. **Read plans with `EXPLAIN (ANALYZE, BUFFERS)`**, not bare `EXPLAIN`. The gap between
   estimated and actual rows is usually the whole diagnosis.
5. **Run `ANALYZE`** before trusting any plan. 152 of 162 tables have never been
   analyzed, so the planner is currently working from default statistics. This costs
   nothing today at 556 rows, but a plan read before the first `ANALYZE` on a populated
   table tells you nothing reliable.
6. Only then consider indexes — and prefer fetching less and fixing access patterns
   first, since both are free and neither taxes writes.

## Verdict

The database is not the bottleneck and cannot currently be one. If a page in any of
these applications is slow, the cause is in the render, network, or application layer,
and `performance-profiling-and-optimization` is the correct place to start.
