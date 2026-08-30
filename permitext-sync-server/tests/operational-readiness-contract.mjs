import assert from "node:assert/strict";
import {
  operationalMonitoringReadiness,
  productionDeploymentReadiness,
  productionReleaseReadiness,
  releaseIdentity,
  sanitizedClientErrorReport,
  sanitizedRequestObservation,
  sanitizedResearchSpendGuardrailReport,
  sanitizedServerErrorReport
} from "../operational-readiness.mjs";

const release = releaseIdentity({
  VERCEL_ENV: "production",
  VERCEL_GIT_COMMIT_SHA: "0123456789abcdef0123456789abcdef01234567",
  VERCEL_URL: "permitext-git-main.example.vercel.app"
});
assert.equal(release.releaseID, "0123456789ab");
assert.equal(release.gitCommit, "0123456789abcdef0123456789abcdef01234567");
assert.equal(release.environment, "production");
assert.equal(release.deploymentHost, "permitext-git-main.example.vercel.app");

const explicit = releaseIdentity({
  PERMITEXT_RELEASE_ID: "beta1-24",
  VERCEL_GIT_COMMIT_SHA: "abcdef"
});
assert.equal(explicit.releaseID, "beta1-24");

const explicitCommit = releaseIdentity({
  PERMITEXT_GIT_COMMIT: "abcdef0123456789",
  VERCEL_GIT_COMMIT_SHA: "wrong",
  VERCEL_URL: "permitext.example.vercel.app"
});
assert.equal(explicitCommit.gitCommit, "abcdef0123456789");

const releaseReady = productionReleaseReadiness({
  VERCEL_ENV: "production",
  VERCEL_GIT_COMMIT_SHA: "0123456789abcdef",
  VERCEL_URL: "permitext.example.vercel.app"
});
assert.equal(releaseReady.ready, true);
assert.equal(productionReleaseReadiness({ VERCEL_ENV: "production" }).ready, false);

const monitoring = operationalMonitoringReadiness({
  PERMITEXT_MONITORING_PROVIDER: "vercel-observability",
  PERMITEXT_SLOW_REQUEST_MS: "3500"
});
assert.equal(monitoring.externalAlertsConfigured, true);
assert.equal(monitoring.slowRequestThresholdMilliseconds, 3500);

const deploymentReady = productionDeploymentReadiness({
  configuration: { ready: true },
  liveStripe: { ready: true },
  release: { ready: true },
  monitoring
});
assert.equal(deploymentReady.ready, true);
assert.deepEqual(deploymentReady.errors, []);

const missingMonitoring = productionDeploymentReadiness({
  configuration: { ready: true },
  liveStripe: { ready: true },
  release: { ready: true },
  monitoring: operationalMonitoringReadiness({})
});
assert.equal(missingMonitoring.ready, false);
assert.equal(missingMonitoring.checks.externalMonitoring, false);
assert.match(missingMonitoring.errors.join(" "), /PERMITEXT_MONITORING_PROVIDER/);

const incompleteDeployment = productionDeploymentReadiness();
assert.equal(incompleteDeployment.ready, false);
assert.deepEqual(incompleteDeployment.checks, {
  commercialConfiguration: false,
  liveStripe: false,
  releaseIdentity: false,
  externalMonitoring: false
});

const report = sanitizedClientErrorReport({
  kind: "unhandledrejection",
  name: "TypeError",
  message: "Failed for person@example.com?token=secret-value Bearer abc.def.ghi sk_live_private eyJabc.def.ghi",
  source: "https://permitext.com/web/app.js?v=sensitive",
  route: "/open/section/123?code=private",
  line: 42,
  column: 8
}, {
  VERCEL_ENV: "production",
  VERCEL_GIT_COMMIT_SHA: "0123456789abcdef"
});
assert.equal(report.message.includes("person@example.com"), false);
assert.equal(report.message.includes("secret-value"), false);
assert.equal(report.message.includes("abc.def.ghi"), false);
assert.equal(report.message.includes("sk_live_private"), false);
assert.equal(report.message.includes("eyJabc.def.ghi"), false);
assert.equal(report.source, "/web/app.js");
assert.equal(report.route, "/open/section/123");
assert.equal(report.releaseID, "0123456789ab");
assert.equal(report.fingerprint.length, 24);
assert.equal(report.line, 42);

const serverReport = sanitizedServerErrorReport(
  new Error("Database failed for admin@example.com?key=private"),
  { route: "research/conversations", method: "post", requestID: "iad1::abc" },
  { PERMITEXT_RELEASE_ID: "beta1-24" }
);
assert.equal(serverReport.event, "request_error");
assert.equal(serverReport.message.includes("admin@example.com"), false);
assert.equal(serverReport.message.includes("private"), false);
assert.equal(serverReport.method, "POST");
assert.equal(serverReport.releaseID, "beta1-24");

const requestObservation = sanitizedRequestObservation({
  route: "research/interpret",
  method: "post",
  statusCode: 503,
  durationMilliseconds: 2_450,
  requestID: "iad1::request"
}, {
  VERCEL_ENV: "production",
  VERCEL_GIT_COMMIT_SHA: "0123456789abcdef",
  VERCEL_URL: "permitext.example.vercel.app"
});
assert.equal(requestObservation.event, "dynamic_route_observation");
assert.equal(requestObservation.severity, "error");
assert.equal(requestObservation.statusCode, 503);
assert.equal(requestObservation.durationMilliseconds, 2450);
assert.equal(requestObservation.gitCommit, "0123456789abcdef");
assert.equal(requestObservation.deploymentHost, "permitext.example.vercel.app");

const customThresholdObservation = sanitizedRequestObservation({
  route: "client-errors",
  method: "post",
  statusCode: 202,
  durationMilliseconds: 25
}, {
  PERMITEXT_SLOW_REQUEST_MS: "20",
  PERMITEXT_RELEASE_ID: "beta1-monitoring"
});
assert.equal(customThresholdObservation.severity, "warning");

const belowCustomThresholdObservation = sanitizedRequestObservation({
  route: "client-errors",
  method: "post",
  statusCode: 202,
  durationMilliseconds: 19
}, {
  PERMITEXT_SLOW_REQUEST_MS: "20"
});
assert.equal(belowCustomThresholdObservation.severity, "info");

const guardrailReport = sanitizedResearchSpendGuardrailReport({
  code: "RESEARCH_SPEND_CAP<script>",
  route: "research/conversations/message",
  userID: "apple:monitoring-owner@example.com",
  operationID: "conversation-secret",
  reason: "Guardrail blocked person@example.com?token=secret-value Bearer abc.def.ghi"
}, {
  PERMITEXT_RELEASE_ID: "beta1-monitoring",
  VERCEL_ENV: "preview"
});
assert.equal(guardrailReport.event, "research_spend_guardrail_rejection");
assert.equal(guardrailReport.code, "RESEARCH_SPEND_CAP");
assert.equal(guardrailReport.user.length, 16);
assert.equal(guardrailReport.operation.length, 16);
assert.equal(JSON.stringify(guardrailReport).includes("monitoring-owner@example.com"), false);
assert.equal(JSON.stringify(guardrailReport).includes("conversation-secret"), false);
assert.equal(JSON.stringify(guardrailReport).includes("secret-value"), false);
assert.equal(JSON.stringify(guardrailReport).includes("abc.def.ghi"), false);

console.log("operational readiness contract passed");
