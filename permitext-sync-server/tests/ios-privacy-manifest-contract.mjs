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

const declaredCategories = [
  "Name", "EmailAddress", "PhysicalAddress", "UserID", "PurchaseHistory",
  "PhotosorVideos", "OtherUserContent", "ProductInteraction", "SearchHistory",
  "PerformanceData", "OtherDiagnosticData", "DeviceID", "CoarseLocation"
];
const analyticsCategories = new Set(["UserID", "ProductInteraction"]);

// Inspect leaf declaration dictionaries, not unrelated flags elsewhere in the plist.
// XML syntax is also checked with plutil on macOS; this is a bounded contract,
// not a general plist parser or an automatic certification of privacy practices.
function validateDeclarations(source) {
  const dictionaries = Array.from(
    source.matchAll(/<dict>((?:(?!<\/?dict>)[\s\S])*)<\/dict>/g),
    (match) => match[1]
  );
  const collectionEntries = dictionaries.filter((entry) =>
    entry.includes("<key>NSPrivacyCollectedDataType</key>")
  );
  assert.equal(collectionEntries.length, declaredCategories.length, "Unexpected collected-data category.");
  for (const category of declaredCategories) {
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
    const purposeEntries = Array.from(entry.matchAll(
      /<key>NSPrivacyCollectedDataTypePurposes<\/key>\s*<array>([\s\S]*?)<\/array>/g
    ));
    assert.equal(purposeEntries.length, 1, `${type}: missing or duplicate purpose array.`);
    const purposes = Array.from(purposeEntries[0][1].matchAll(/<string>([^<]+)<\/string>/g), (match) => match[1]);
    const expectedPurposes = ["NSPrivacyCollectedDataTypePurposeAppFunctionality"];
    if (analyticsCategories.has(category)) expectedPurposes.push("NSPrivacyCollectedDataTypePurposeAnalytics");
    assert.deepEqual(purposes.sort(), expectedPurposes.sort(), `${type}: incorrect purposes.`);
  }
  assert.match(source, /<key>NSPrivacyTracking<\/key>\s*<false\s*\/>/);
  assert.match(source, /<key>NSPrivacyTrackingDomains<\/key>\s*<array\s*\/>/);
}

validateDeclarations(manifest);
for (const category of declaredCategories) {
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
)), /incorrect purposes/);
assert.throws(() => validateDeclarations(manifest.replaceAll(
  "<string>NSPrivacyCollectedDataTypePurposeAnalytics</string>", ""
)), /incorrect purposes/);

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

for (const label of ["Search History", "Performance Data", "Other Diagnostic Data", "Device ID", "Coarse Location"]) {
  assert.ok(checklist.includes(`${label}: collected, linked to identity, App Functionality`));
}
for (const label of ["User ID", "Product Interaction"]) {
  assert.ok(checklist.includes(`${label}: collected, linked to identity, App Functionality and Analytics`));
}
assert.doesNotMatch(checklist, /Search History outside Permitext/);
assert.doesNotMatch(checklist, /Performance Data: not currently declared/);
assert.doesNotMatch(checklist, /(?:Device ID|Coarse Location): unresolved provider declaration/);

console.log("Permitext iOS privacy manifest/data-flow contract passed (synthetic data, no network).");
