import assert from "node:assert/strict";
import {
  releaseIdentity,
  sanitizedClientErrorReport,
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

console.log("operational readiness contract passed");
