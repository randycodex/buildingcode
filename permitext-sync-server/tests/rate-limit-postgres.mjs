import { randomUUID } from "node:crypto";
import { createPostgresRateLimitRepository } from "../postgres-rate-limit-repository.mjs";
import { rateLimitBucketKey } from "../rate-limit.mjs";

const databaseURL =
  process.env.PERMITEXT_SYNC_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.STORAGE_URL ||
  process.env.POSTGRES_URL ||
  process.env.NEON_DATABASE_URL;

if (!databaseURL) {
  console.log("permitext postgres rate-limit integration skipped: no database URL configured");
  process.exit(0);
}
if (process.env.PERMITEXT_RUN_POSTGRES_RATE_LIMIT_TESTS !== "1") {
  console.log(
    "permitext postgres rate-limit integration skipped: set PERMITEXT_RUN_POSTGRES_RATE_LIMIT_TESTS=1 to use the configured test database"
  );
  process.exit(0);
}

const { neon } = await import("@neondatabase/serverless");
const sql = neon(databaseURL);
const leftRepository = createPostgresRateLimitRepository(sql);
const rightRepository = createPostgresRateLimitRepository(sql);
const runID = randomUUID();
const scope = `contract/postgres/${runID}`;
const principal = `account:${runID}`;
const bucketKey = rateLimitBucketKey(scope, principal);
const now = Date.now();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const results = await Promise.all(
    Array.from({ length: 50 }, (_, index) =>
      (index % 2 === 0 ? leftRepository : rightRepository).consume({
        scope,
        principal,
        limit: 30,
        windowMs: 60_000,
        now
      })
    )
  );
  assert(
    results.filter((result) => result.allowed).length === 30 &&
      results.filter((result) => !result.allowed).length === 20,
    "PostgreSQL did not preserve the exact allowance across repository instances."
  );
  assert(
    results.map((result) => result.count).sort((left, right) => left - right)
      .every((count, index) => count === index + 1),
    "PostgreSQL atomic increments lost or duplicated a concurrent request."
  );

  const reset = await leftRepository.consume({
    scope,
    principal,
    limit: 30,
    windowMs: 60_000,
    now: now + 60_000
  });
  assert(reset.allowed && reset.count === 1, "PostgreSQL did not reset an expired bucket.");
  console.log("permitext postgres rate-limit integration passed");
} finally {
  await sql`
    DELETE FROM permitext_rate_limit_buckets
    WHERE bucket_key = ${bucketKey}
  `;
}
