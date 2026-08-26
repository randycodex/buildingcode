import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const [appSource, internalSource, accountRepositorySource] = await Promise.all([
  readFile(join(root, "../app.mjs"), "utf8"),
  readFile(join(root, "../internal/app.js"), "utf8"),
  readFile(join(root, "../postgres-account-repository.mjs"), "utf8")
]);

assert.match(
  appSource,
  /CREATE TABLE IF NOT EXISTS permitext_research_operations[\s\S]*operation JSONB NOT NULL[\s\S]*created_at TIMESTAMPTZ/,
  "PostgreSQL does not persist private Research operation telemetry."
);
assert.match(
  appSource,
  /async saveResearchOperationMetric\(userID, metric\)[\s\S]*INSERT INTO permitext_research_operations[\s\S]*ON CONFLICT \(id\) DO UPDATE/,
  "Research operation telemetry is not idempotently persisted."
);
assert.match(
  appSource,
  /const providerSpend = endResearchSpendReservation\(\);[\s\S]*conservativeProviderCostUSD[\s\S]*durationMilliseconds[\s\S]*saveResearchOperationMetricBestEffort/,
  "The Research handler does not record provider spend and duration after every terminal outcome."
);
assert.match(
  appSource,
  /status: "replayed"[\s\S]*charged: false/,
  "Durable replay telemetry does not preserve its no-charge state."
);
assert.match(
  appSource,
  /status: \["RESEARCH_CANCELLED", "AbortError"\][\s\S]*charged: false/,
  "Failed or cancelled Research telemetry can be recorded as charged."
);
assert.match(
  appSource,
  /DELETE FROM permitext_research_operations WHERE user_id = \$\{userID\}/,
  "Account deletion does not remove Research operation telemetry."
);
assert.match(
  accountRepositorySource,
  /UPDATE permitext_research_operations SET user_id = \$\{targetUserID\}/,
  "Account continuity does not transfer Research operation telemetry."
);
assert.match(
  accountRepositorySource,
  /DELETE FROM permitext_research_operations WHERE user_id LIKE 'passkey:%'/,
  "Legacy-account cleanup does not remove Research operation telemetry."
);
assert.match(
  internalSource,
  /Projected cost per 100 completed turns[\s\S]*Turn cost p50 \/ p90[\s\S]*Latency p50 \/ p90[\s\S]*Charging integrity/,
  "The owner console does not render the hybrid economics gates."
);

console.log("permitext Research economics persistence contract passed");
