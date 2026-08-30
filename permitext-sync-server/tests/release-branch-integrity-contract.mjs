import assert from "node:assert/strict";
import { auditReleaseBranchIntegrity, parseGitPorcelainPaths, scanAddedLinesForCredentials } from "../release-branch-integrity.mjs";

const baseCommit = "a".repeat(40);
const headCommit = "b".repeat(40);

const clean = auditReleaseBranchIntegrity({
  expectedBranch: "codex/research-commercialization",
  actualBranch: "codex/research-commercialization",
  baseCommit,
  headCommit,
  mergeBase: baseCommit,
  aheadCount: 71,
  behindCount: 0,
  diffCheckPassed: true,
  dirtyPaths: ["NYC CC APP/permitext/Info.plist", "NYC CC APP/project-data/file.xcuserstate"],
  allowedDirtyPaths: ["NYC CC APP/permitext/Info.plist", "NYC CC APP/project-data"],
  changedPaths: ["docs/plan.md", "permitext-sync-server/app.mjs"],
  addedLineDiff: "diff --git a/docs/plan.md b/docs/plan.md\n+++ b/docs/plan.md\n@@ -0,0 +1 @@\n+safe line\n"
});
assert.equal(clean.sourceIntegrityReady, true);
assert.equal(clean.releaseAuthorized, false);
assert.equal(clean.manualSemanticReviewRequired, true);
assert.deepEqual(clean.unexpectedDirtyPaths, []);
assert.deepEqual(clean.allowedDirtyPathsPresent, [
  "NYC CC APP/permitext/Info.plist",
  "NYC CC APP/project-data/file.xcuserstate"
]);
assert.equal(clean.privacy.secretValuesEmitted, false);

const fakeSecret = `sk_live_${"x".repeat(24)}`;
const unsafe = auditReleaseBranchIntegrity({
  ...clean,
  expectedBranch: "codex/research-commercialization",
  actualBranch: "wrong-branch",
  baseCommit,
  headCommit,
  mergeBase: baseCommit,
  aheadCount: 1,
  behindCount: 0,
  diffCheckPassed: true,
  dirtyPaths: ["unexpected.txt"],
  allowedDirtyPaths: [],
  changedPaths: ["credentials.json", "app.mjs"],
  addedLineDiff: `diff --git a/app.mjs b/app.mjs\n+++ b/app.mjs\n@@ -0,0 +1 @@\n+const value = "${fakeSecret}";\n`
});
assert.equal(unsafe.sourceIntegrityReady, false);
assert.deepEqual(unsafe.unexpectedDirtyPaths, ["unexpected.txt"]);
assert.deepEqual(unsafe.credentialLikePaths, ["credentials.json"]);
assert.deepEqual(unsafe.credentialFindings, [{ path: "app.mjs", lineNumber: 1, kind: "provider-secret-key" }]);
assert.equal(JSON.stringify(unsafe).includes(fakeSecret), false);

assert.deepEqual(
  parseGitPorcelainPaths(" M first.txt\0?? folder/file.txt\0R  renamed.txt\0original.txt\0"),
  ["first.txt", "folder/file.txt", "original.txt", "renamed.txt"]
);
assert.deepEqual(scanAddedLinesForCredentials("+++ b/safe.mjs\n@@ -0,0 +1 @@\n+const safe = process.env.API_KEY;\n"), []);
assert.deepEqual(
  scanAddedLinesForCredentials(`+++ b/test.mjs\n@@ -0,0 +1 @@\n+const key = "${fakeSecret}"; // permitext-secret-scan-allow: synthetic contract fixture\n`),
  []
);

console.log("Permitext release branch-integrity contract passed.");
