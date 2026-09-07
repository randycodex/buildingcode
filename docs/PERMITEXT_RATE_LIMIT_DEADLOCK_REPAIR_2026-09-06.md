# PostgreSQL rate-limit deadlock repair

## Production finding and local result

During the original Beta 1 B1 acceptance check, Production `2e4f7db2d` returned
503 for `/admin/accounts/export` at `2026-09-07T02:06:34Z` (September 6 in New
York). The deployment log reported `Rate-limit enforcement failed` with
PostgreSQL `deadlock detected`; request ID
`iad1::ngpfn-1788746794063-2329f14dafd3`. A later export and health check passed,
but that did not resolve the concurrency defect.

The actual repository reproduced SQLSTATE `40P01` against disposable local
PostgreSQL 18.6. The old statement deleted other expired counters and updated
its own counter in one transaction. Two requests could lock counters that the
other request needed, creating a circular wait.

The repair commits the atomic increment first. A separate bounded cleanup
statement selects at most 32 expired counters with `FOR UPDATE SKIP LOCKED` and
deletes only those locked rows. Cleanup cannot hold another bucket's lock while
its request still needs the increment lock. A maintenance error emits a warning
containing only the error code and returns the already-committed allowance;
counter errors still reject the request. Limits and windows are unchanged.

This follows PostgreSQL's documented [row-lock behavior](https://www.postgresql.org/docs/18/explicit-locking.html)
and [SKIP LOCKED semantics](https://www.postgresql.org/docs/18/sql-select.html#SQL-FOR-UPDATE-SHARE).
It adds one database statement per consumed counter. Hosted latency remains a
B4 measurement; no Production performance improvement is claimed.

## Verification and release boundary

`tests/rate-limit-local-postgres.mjs` uses the shipped repository and Neon query
encoder, replacing transport with independent connections to a fresh loopback
database. A test-only deletion trigger holds a lock to overlap expired-counter
work. The pre-repair run returned counts/error codes `[1, "40P01"]`; the repaired
run returned `[1, 1]`. The final run also verified:

- 40 simultaneous increments return exactly counts 1–40, with exactly 3 allowed.
- Cleanup skips an expired row held by another transaction, so an unrelated
  request completes before that lock is released.
- A subsequent request removes the expired row after release.
- 98 SQL transport requests; zero external database/provider requests.

`npm run test:rate-limit` passes schema readiness, rate-limit behavior and the
new maintenance-failure contract. That contract verifies the exact allowance
survives cleanup failure, counter failures remain fail-closed and warnings omit
private error details. The separate cloud integration test skips without a
configured database; it was not run against Production. Syntax and
`git diff --check` pass.

The local harness uses the verified Postgres.app 2.9.6 PostgreSQL 18.6 image
(SHA-256 `9fc7d0dc08cf46dfd94bb32cbaaad81b41b37847a42d6dcb2f9fbd292813defb`),
validates its signature, and uses `pg` 8.23.0 installed only in the temporary
task directory with package scripts disabled. Cluster port: 53885. The cluster
was stopped, its image detached and its task runtime removed. Evidence is in
`/private/tmp/permitext-b1-live-20260906/rate-limit-{before,after}.txt`,
`rate-limit-verification.json` and the retained synthetic PostgreSQL log.

The owner approved PR #61 after local and preview checks passed. It published as
`aed30262742d1888f94555997c4140cbdcaa7b71`, READY at
`2026-09-07T02:49:39.298Z`. Both canonical origins report that exact release;
Production health and one read-only exact-test-account export passed. A scan
through `02:51:51Z` found no deployment 5xx rows or rate-limit warnings/errors.
This is early hosted verification, not sustained monitoring or a cloud stress
test. See [publication evidence](./PERMITEXT_RESEARCH_CONTEXT_RECOVERY_2026-09-06.md#approved-follow-up-publication).
The remaining B2–B5 scope is unchanged apart from the separately passed B2
controlled public-cleanup failure check.

## Reproduction

Use the temporary-runtime setup in
[local PostgreSQL acceptance](./PERMITEXT_LOCAL_POSTGRES_READINESS_2026-09-04.md#reproduction).
With its fresh empty database and environment variables, run
`node tests/rate-limit-local-postgres.mjs`. It rejects external/default-port
targets and existing databases. It removes only its own test table/function at
the end. Stop the temporary cluster and detach its image even after a failure.
