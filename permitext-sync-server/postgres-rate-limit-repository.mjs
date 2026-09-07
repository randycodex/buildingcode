import { createHash } from "node:crypto";
import { rateLimitBucketKey } from "./rate-limit.mjs";

function principalHash(principal) {
  return createHash("sha256").update(String(principal || "")).digest("hex");
}

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

export function createPostgresRateLimitRepository(sql) {
  let initializationPromise = null;

  async function initialize() {
    if (!initializationPromise) {
      initializationPromise = (async () => {
        await sql`
          CREATE TABLE IF NOT EXISTS permitext_rate_limit_buckets (
            bucket_key TEXT PRIMARY KEY,
            scope TEXT NOT NULL,
            principal_hash TEXT NOT NULL,
            request_count INTEGER NOT NULL,
            reset_at TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT permitext_rate_limit_buckets_count_positive
              CHECK (request_count > 0)
          )
        `;
        await sql`
          CREATE INDEX IF NOT EXISTS permitext_rate_limit_buckets_reset_idx
          ON permitext_rate_limit_buckets (reset_at)
        `;
      })().catch((error) => {
        initializationPromise = null;
        throw error;
      });
    }
    await initializationPromise;
  }

  return {
    kind: "postgres",
    initialize,
    async consume({ scope, principal, limit, windowMs, now = Date.now() }) {
      positiveInteger(limit, "Rate limit");
      positiveInteger(windowMs, "Rate-limit window");
      await initialize();

      const observedAt = new Date(now);
      if (!Number.isFinite(observedAt.getTime())) {
        throw new Error("Rate-limit observation time is invalid.");
      }
      const resetAt = new Date(observedAt.getTime() + windowMs);
      const bucketKey = rateLimitBucketKey(scope, principal);
      const rows = await sql`
        INSERT INTO permitext_rate_limit_buckets (
          bucket_key,
          scope,
          principal_hash,
          request_count,
          reset_at,
          updated_at
        )
        VALUES (
          ${bucketKey},
          ${scope},
          ${principalHash(principal)},
          1,
          ${resetAt},
          ${observedAt}
        )
        ON CONFLICT (bucket_key) DO UPDATE SET
          request_count = CASE
            WHEN permitext_rate_limit_buckets.reset_at <= ${observedAt} THEN 1
            ELSE permitext_rate_limit_buckets.request_count + 1
          END,
          reset_at = CASE
            WHEN permitext_rate_limit_buckets.reset_at <= ${observedAt} THEN ${resetAt}
            ELSE permitext_rate_limit_buckets.reset_at
          END,
          updated_at = ${observedAt}
        RETURNING
          request_count,
          (extract(epoch FROM reset_at) * 1000)::bigint AS reset_at_ms
      `;
      // The increment must commit before maintenance acquires any other bucket
      // locks. Combining both writes lets two expired buckets deadlock as each
      // request deletes the other's bucket and then upserts its own.
      try {
        await sql`
          WITH expired AS (
            SELECT bucket_key FROM permitext_rate_limit_buckets
            WHERE reset_at <= ${observedAt} AND bucket_key <> ${bucketKey}
            ORDER BY reset_at ASC, bucket_key ASC
            LIMIT 32
            FOR UPDATE SKIP LOCKED
          )
          DELETE FROM permitext_rate_limit_buckets AS buckets
          USING expired
          WHERE buckets.bucket_key = expired.bucket_key
        `;
      } catch (error) {
        // Cleanup is best effort; the authoritative count above already committed.
        // Counter failures still reject the request. Do not log private bucket IDs.
        console.warn("Rate-limit bucket cleanup failed.", { code: String(error?.code || "UNKNOWN") });
      }
      const count = Number(rows[0]?.request_count || 0);
      const returnedResetAt = Number(rows[0]?.reset_at_ms || resetAt.getTime());
      return {
        allowed: count <= limit,
        count,
        limit,
        resetAt: returnedResetAt,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((returnedResetAt - observedAt.getTime()) / 1000)
        )
      };
    }
  };
}
