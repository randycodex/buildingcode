import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { auditProductionMonitoringEntries } from "../production-monitoring-audit.mjs";

const auditScriptPath = fileURLToPath(new URL("../scripts/audit-production-monitoring.mjs", import.meta.url));

const structured = (message, overrides = {}) => ({
  environment: "production",
  level: "warning",
  message: JSON.stringify(message),
  ...overrides
});

const report = auditProductionMonitoringEntries([
  {
    environment: "production",
    requestPath: "/health?source=test",
    responseStatusCode: 200,
    message: ""
  },
  {
    environment: "preview",
    requestPath: "/billing/apple/notifications",
    responseStatusCode: 500
  },
  {
    environment: "production",
    requestPath: "/billing/stripe/webhook",
    responseStatusCode: 503,
    message: ""
  },
  structured({
    event: "client_error",
    message: "owner@example.com Bearer secret-token",
    fingerprint: "private-fingerprint"
  }),
  structured({
    event: "request_error",
    message: "Postgres connection timeout for owner@example.com",
    fingerprint: "database-private-fingerprint"
  }),
  structured({ event: "stripe_invoice_payment_failed", subscriptionID: "sub_private" }),
  structured({
    event: "research_spend_guardrail_rejection",
    user: "private-user-hash",
    operation: "private-operation-hash"
  }),
  structured({ event: "research_conversation_failure", operationID: "private-operation" }),
  structured({
    event: "dynamic_route_observation",
    route: "research/conversations",
    statusCode: 200,
    durationMilliseconds: 30_000
  }),
  structured({
    event: "dynamic_route_observation",
    route: "research/conversations",
    statusCode: 200,
    durationMilliseconds: 50_000
  })
]);

assert.equal(report.schema, "permitext-production-monitoring-audit-v1");
assert.equal(report.counts.productionEntries, 9);
assert.equal(report.counts.nonProductionEntriesIgnored, 1);
assert.equal(report.counts.healthRequests, 1);
assert.equal(report.counts.healthFailures, 0);
assert.equal(report.counts.serverErrors, 1);
assert.equal(report.counts.billingEndpointFailures, 1);
assert.equal(report.counts.clientErrors, 1);
assert.equal(report.counts.requestErrors, 1);
assert.equal(report.counts.databaseFailureEvents, 1);
assert.equal(report.counts.billingLifecycleWarnings, 1);
assert.equal(report.counts.researchSpendGuardrailRejections, 1);
assert.equal(report.counts.researchConversationFailures, 1);
assert.equal(report.healthCoverage.observed, true);
assert.equal(report.researchLatency.sampleCount, 2);
assert.equal(report.researchLatency.p95Milliseconds, 50_000);
assert.equal(report.researchLatency.overTarget, true);
assert.deepEqual(report.actionable.categories, [
  "server_error",
  "billing_endpoint_failure",
  "client_error",
  "request_error",
  "database_failure",
  "billing_lifecycle_warning",
  "research_spend_guardrail_rejection",
  "research_conversation_failure",
  "research_p95_latency"
]);
assert.equal(report.privacy.rawMessagesEmitted, false);
assert.equal(report.privacy.customerIdentifiersEmitted, false);

const serialized = JSON.stringify(report);
for (const forbidden of [
  "owner@example.com",
  "secret-token",
  "private-fingerprint",
  "sub_private",
  "private-user-hash",
  "private-operation"
]) {
  assert.equal(serialized.includes(forbidden), false, `Audit leaked ${forbidden}.`);
}

const clean = auditProductionMonitoringEntries([
  { environment: "production", requestPath: "/health", responseStatusCode: 200 }
]);
assert.equal(clean.actionable.count, 0);
assert.equal(clean.healthCoverage.observed, true);
assert.equal(clean.researchLatency.overTarget, null);

function runAuditCLI(input, argumentsList = []) {
  return spawnSync(process.execPath, [auditScriptPath, ...argumentsList], {
    input,
    encoding: "utf8"
  });
}

const invalidInput = runAuditCLI("not-json\n", ["--require-health", "--fail-on-actionable"]);
assert.equal(invalidInput.status, 3);
assert.equal(JSON.parse(invalidInput.stdout).input.invalidLineCount, 1);

const missingHealth = runAuditCLI(
  `${JSON.stringify({ environment: "production", requestPath: "/release", responseStatusCode: 200 })}\n`,
  ["--require-health"]
);
assert.equal(missingHealth.status, 2);

const actionable = runAuditCLI(
  `${JSON.stringify({ environment: "production", requestPath: "/health", responseStatusCode: 500 })}\n`,
  ["--require-health", "--fail-on-actionable"]
);
assert.equal(actionable.status, 1);
assert.deepEqual(JSON.parse(actionable.stdout).actionable.categories, ["health_failure", "server_error"]);

console.log("Permitext production monitoring audit contract passed.");
