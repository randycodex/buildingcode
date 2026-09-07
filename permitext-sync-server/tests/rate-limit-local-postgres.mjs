// Opt-in: real PostgreSQL concurrency using the shipped repository and Neon
// encoder, with transport restricted to a fresh disposable loopback database.
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { neon, neonConfig } from "@neondatabase/serverless";
import { createPostgresRateLimitRepository } from "../postgres-rate-limit-repository.mjs";
import { rateLimitBucketKey } from "../rate-limit.mjs";

assert.equal(process.env.PERMITEXT_RUN_LOCAL_POSTGRES_READINESS, "1");
const connectionString = process.env.PERMITEXT_LOCAL_POSTGRES_URL;
const database = new URL(connectionString);
assert.equal(database.protocol, "postgresql:");
assert.equal(database.hostname, "127.0.0.1");
assert.equal(database.username, "permitext_readiness");
assert.equal(database.pathname, "/permitext_readiness_temp");
assert.equal(database.search, ""); assert.equal(database.hash, "");
assert.ok(Number(database.port) > 1024 && database.port !== "5432");
const driverPath = process.env.PERMITEXT_LOCAL_PG_DRIVER;
assert.match(driverPath, /^\/private\/tmp\/permitext-pg-acceptance\.[^/]+\/transport\/node_modules\/pg\/lib\/index\.js$/);
const { default: pg } = await import(pathToFileURL(driverPath));
let requests = 0;
neonConfig.fetchEndpoint = "http://127.0.0.1/permitext-rate-limit-test";
neonConfig.fetchFunction = async (url, options) => {
  assert.equal(url, neonConfig.fetchEndpoint);
  assert.equal(options.headers["Neon-Connection-String"], connectionString);
  const query = JSON.parse(options.body);
  assert.ok(!query.queries, "Each rate-limit statement must commit independently.");
  const client = new pg.Client({ connectionString, application_name: "permitext-rate-limit-test",
    statement_timeout: 10000, types: { getTypeParser: () => value => value } });
  requests += 1;
  try {
    await client.connect();
    const result = await client.query({ text: query.query, values: query.params, rowMode: "array" });
    return new Response(JSON.stringify({ fields: result.fields.map(field => ({ name: field.name, dataTypeID: field.dataTypeID })),
      rows: result.rows, command: result.command, rowCount: result.rowCount }));
  } catch (error) {
    return new Response(JSON.stringify({ message: error.message, code: error.code }), { status: 400 });
  } finally { await client.end(); }
};
const control = new pg.Client({ connectionString, application_name: "permitext-rate-limit-control", statement_timeout: 10000 });
await control.connect();
assert.equal((await control.query("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'")).rows[0].count, 0,
  "Only a fresh, empty disposable database is accepted.");
const sql = neon(connectionString);
const left = createPostgresRateLimitRepository(sql), right = createPostgresRateLimitRepository(sql);
const scope = "contract/cleanup-race", now = Date.now();
const consume = (repository, principal, observedAt = now) => repository.consume({ scope, principal, limit: 3, windowMs: 60000, now: observedAt });
try {
  await left.initialize(); await right.initialize();
  for (const principal of ["left", "right"]) await consume(left, principal, now - 120000);
  // Pause expired-row deletion after it owns the row lock. In the old combined
  // statement each request deletes the other's bucket, then tries to upsert its
  // own: releasing both deletes together exposes the circular wait.
  await control.query(`CREATE FUNCTION rate_limit_test_barrier() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN PERFORM pg_advisory_xact_lock_shared(76348211); RETURN OLD; END $$`);
  await control.query(`CREATE TRIGGER rate_limit_test_barrier AFTER DELETE ON permitext_rate_limit_buckets
    FOR EACH ROW EXECUTE FUNCTION rate_limit_test_barrier()`);
  await control.query("SELECT pg_advisory_lock(76348211)");
  let settled = false;
  const overlapping = Promise.allSettled([consume(left, "left"), consume(right, "right")]).then(result => { settled = true; return result; });
  let waiting = 0;
  try {
    for (let attempt = 0; attempt < 150; attempt += 1) {
      waiting = (await control.query(`SELECT count(*)::int AS count FROM pg_stat_activity
        WHERE application_name='permitext-rate-limit-test' AND wait_event='advisory'`)).rows[0].count;
      if (waiting === 2 || settled) break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  } finally { await control.query("SELECT pg_advisory_unlock(76348211)"); }
  const results = await overlapping;
  console.log(JSON.stringify({ expiredDeletionBarrierWaiters: waiting,
    outcomes: results.map(result => result.status === "fulfilled" ? result.value.count : result.reason.code) }));
  assert.deepEqual(results.map(result => result.status === "fulfilled" ? result.value.count : result.reason.code), [1, 1],
    "Two expired buckets must reset concurrently without deadlocking or losing a count.");
  await control.query("DROP TRIGGER rate_limit_test_barrier ON permitext_rate_limit_buckets");
  await control.query("DROP FUNCTION rate_limit_test_barrier()");

  const counts = await Promise.all(Array.from({ length: 40 }, (_, index) => consume(index % 2 ? left : right, "shared")));
  assert.deepEqual(counts.map(value => value.count).sort((a, b) => a - b), Array.from({ length: 40 }, (_, index) => index + 1));
  assert.equal(counts.filter(value => value.allowed).length, 3, "Concurrent maintenance must preserve the exact allowance.");

  // A locked expired bucket must not stall cleanup or prevent another request.
  await consume(left, "locked-expired", now - 120000);
  await control.query("BEGIN");
  await control.query("SELECT bucket_key FROM permitext_rate_limit_buckets WHERE bucket_key=$1 FOR UPDATE",
    [rateLimitBucketKey(scope, "locked-expired")]);
  try {
    assert.equal((await consume(right, "other-request")).count, 1);
    assert.equal((await control.query("SELECT count(*)::int AS count FROM permitext_rate_limit_buckets WHERE bucket_key=$1",
      [rateLimitBucketKey(scope, "locked-expired")])).rows[0].count, 1);
  } finally { await control.query("ROLLBACK"); }
  await consume(left, "cleanup-after-unlock");
  assert.equal((await control.query("SELECT count(*)::int AS count FROM permitext_rate_limit_buckets WHERE reset_at <= $1", [new Date(now)])).rows[0].count, 0);
  console.log(JSON.stringify({ result: "passed", overlappingExpiredResets: 2, concurrentIncrements: 40,
    exactAllowance: 3, lockedCleanupSkipped: true, expiredRowsRemovedAfterUnlock: true, sqlRequests: requests,
    externalDatabaseRequests: 0, providerRequests: 0 }));
} finally {
  await control.query("ROLLBACK");
  await control.query("SELECT pg_advisory_unlock_all()");
  await control.query("DROP TABLE IF EXISTS permitext_rate_limit_buckets CASCADE");
  await control.query("DROP FUNCTION IF EXISTS rate_limit_test_barrier()");
  await control.end();
}
