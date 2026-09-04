import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mergeContinuityRecords } from "../continuity-merge.mjs";
import { createResearchOperationMetric } from "../research-economics.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [manifest, nativeContinuity, server, syncRepository, checklist] = await Promise.all([
  read("../../NYC CC APP/permitext/PrivacyInfo.xcprivacy"),
  read("../../NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift"),
  read("../app.mjs"),
  read("../postgres-sync-repository.mjs"),
  read("../../NYC CC APP/docs/app-store/privacy-review-and-submission.md")
]);

const correctedCategories = ["SearchHistory", "PerformanceData", "OtherDiagnosticData"];

// Inspect leaf declaration dictionaries, not unrelated flags elsewhere in the plist.
// XML syntax is also checked with plutil on macOS; this is a bounded contract,
// not a general plist parser or an automatic certification of privacy practices.
function validateDeclarations(source) {
  const dictionaries = Array.from(
    source.matchAll(/<dict>((?:(?!<\/?dict>)[\s\S])*)<\/dict>/g),
    (match) => match[1]
  );
  for (const category of correctedCategories) {
    const type = `NSPrivacyCollectedDataType${category}`;
    const entries = dictionaries.filter((entry) =>
      entry.includes(`<string>${type}</string>`)
    );
    assert.equal(entries.length, 1, `${type} must have one declaration.`);
    const entry = entries[0];
    assert.match(entry, new RegExp(`<key>NSPrivacyCollectedDataType</key>\\s*<string>${type}</string>`));
    for (const [key, value] of [
      ["NSPrivacyCollectedDataTypeLinked", "true"],
      ["NSPrivacyCollectedDataTypeTracking", "false"]
    ]) {
      assert.equal(entry.split(`<key>${key}</key>`).length - 1, 1, `${type}: duplicate ${key}.`);
      assert.match(entry, new RegExp(`<key>${key}</key>\\s*<${value}\\s*/>`), `${type}: incorrect ${key}.`);
    }
    assert.match(entry, /<key>NSPrivacyCollectedDataTypePurposes<\/key>\s*<array>\s*<string>NSPrivacyCollectedDataTypePurposeAppFunctionality<\/string>\s*<\/array>/);
  }
}

validateDeclarations(manifest);
for (const category of correctedCategories) {
  assert.throws(() => validateDeclarations(manifest.replace(
    `NSPrivacyCollectedDataType${category}`, `MISSING_${category}`
  )), /must have one declaration/);
}
assert.throws(() => validateDeclarations(manifest.replaceAll(
  /(<key>NSPrivacyCollectedDataTypeLinked<\/key>\s*)<true\/>/g, "$1<false/>"
)), /incorrect NSPrivacyCollectedDataTypeLinked/);
assert.throws(() => validateDeclarations(manifest.replaceAll(
  /(<key>NSPrivacyCollectedDataTypeTracking<\/key>\s*)<false\/>/g, "$1<true/>"
)), /incorrect NSPrivacyCollectedDataTypeTracking/);
assert.throws(() => validateDeclarations(manifest.replaceAll(
  "NSPrivacyCollectedDataTypePurposeAppFunctionality",
  "NSPrivacyCollectedDataTypePurposeThirdPartyAdvertising"
)));

// The native continuity payload contains real query strings, not just counts.
assert.match(nativeContinuity, /JSONEncoder\(\)\.encode\(recentSearches\)[\s\S]*?values\["recentSearchesJSON"\] = json/);
assert.match(nativeContinuity, /queueContinuityContext\([\s\S]*?values: continuitySyncValues\(from: context\)/);
assert.match(syncRepository, /mergeContinuityMutations/);
const continuity = {
  userID: "apple:privacy-synthetic",
  codeVersion: "2022 Construction Codes",
  updatedAt: "2026-09-03T12:00:00.000Z",
  values: { recentSearchesJSON: JSON.stringify(["synthetic egress query"]) }
};
const merged = mergeContinuityRecords(continuity, continuity);
assert.equal(merged.userID, continuity.userID);
assert.deepEqual(JSON.parse(merged.values.recentSearchesJSON), ["synthetic egress query"]);

// Content-free metrics retain duration/failure information and are persisted
// beside user_id; excluding prose does not make this collection unlinked.
const metric = createResearchOperationMetric({
  id: "privacy-synthetic-operation",
  createdAt: "2026-09-03T12:00:00.000Z",
  status: "failed",
  durationMilliseconds: 34900,
  failureCode: "RESEARCH_VERIFICATION_FAILED",
  verificationAttemptCount: 2,
  providerRequestCount: 2,
  question: "must not enter operation metrics",
  answer: "must not enter operation metrics",
  email: "synthetic@example.invalid"
});
assert.equal(metric.durationMilliseconds, 34900);
assert.equal(metric.failureCode, "RESEARCH_VERIFICATION_FAILED");
assert.equal(metric.verificationAttemptCount, 2);
assert.equal(metric.providerRequestCount, 2);
for (const key of ["question", "answer", "email"]) assert.equal(Object.hasOwn(metric, key), false);
assert.match(server, /INSERT INTO permitext_research_operations \(id, user_id, operation, created_at\)[\s\S]*?\$\{metric\.id\}, \$\{userID\}, \$\{JSON\.stringify\(metric\)\}/);
assert.match(server, /saveResearchOperationMetricBestEffort\(context\.userID, researchOperation\)/);
assert.match(server, /DELETE FROM permitext_research_operations WHERE user_id = \$\{userID\}/);

for (const label of ["Search History", "Performance Data", "Other Diagnostic Data"]) {
  assert.ok(checklist.includes(`${label}: collected, linked to identity, App Functionality`));
}
assert.doesNotMatch(checklist, /Search History outside Permitext/);
assert.doesNotMatch(checklist, /Performance Data: not currently declared/);
assert.match(checklist, /Device ID: unresolved provider declaration/);
assert.match(checklist, /Coarse Location: unresolved provider declaration/);

console.log("Permitext iOS privacy manifest/data-flow contract passed (synthetic data, no network).");
