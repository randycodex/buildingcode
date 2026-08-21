import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const serverRoot = new URL("../", import.meta.url);
const iosRoot = new URL("../../NYC CC APP/permitext/", import.meta.url);

const [
  webClient,
  webStyles,
  webIndex,
  serviceWorker,
  iosApp,
  iosSaved,
  iosResearch,
  iosResearchModels,
  iosViewModel,
  iosNotebook,
  iosOrganizationHub,
  iosSettings
] = await Promise.all([
  readFile(new URL("public/app.js", serverRoot), "utf8"),
  readFile(new URL("public/styles.css", serverRoot), "utf8"),
  readFile(new URL("public/index.html", serverRoot), "utf8"),
  readFile(new URL("public/service-worker.js", serverRoot), "utf8"),
  readFile(new URL("PermitextApp.swift", iosRoot), "utf8"),
  readFile(new URL("Views/BookmarksView.swift", iosRoot), "utf8"),
  readFile(new URL("Views/ResearchView.swift", iosRoot), "utf8"),
  readFile(new URL("Models/ResearchNotebookModels.swift", iosRoot), "utf8"),
  readFile(new URL("ViewModels/CodeLibraryViewModel.swift", iosRoot), "utf8"),
  readFile(new URL("Views/NotebookView.swift", iosRoot), "utf8"),
  readFile(new URL("Views/OrganizationProjectHubView.swift", iosRoot), "utf8"),
  readFile(new URL("Views/SettingsView.swift", iosRoot), "utf8")
]);

// Canonical product meanings:
// Saved = preserved code; Project = job context; Report = professional artifact;
// Export = an action or produced file.
assert(
  (iosApp.match(/\.accessibilityLabel\("Saved"\)/g) || []).length >= 2,
  "Every production and acceptance tab shell must retain Saved as the top-level label."
);
assert.doesNotMatch(iosApp, /\.accessibilityLabel\("Projects"\)/);
assert.match(iosSaved, /CodeTopContentFade\(title: "Saved"/);
assert.match(iosSaved, /CodeScreenTitleRow\(title: "Saved"/);
assert.match(iosSaved, /CodeScreenSectionEyebrow\(text: "Projects"/);
assert.match(iosSaved, /CodeScreenSectionEyebrow\(text: "References"/);
assert.match(iosSaved, /CodeScreenSectionEyebrow\(text: "Saved sections"/);
assert.match(iosSaved, /library\.folders\.filter \{ \$0\.folderType == \.project \}/);
assert.match(iosSaved, /library\.folders\.filter \{ \$0\.folderType == \.reference \}/);
assert.match(iosSaved, /if isProjectFolder \{[\s\S]*?projectHub/);
assert.match(iosSettings, /CodeEyebrow\(text: "Projects and References"/);
assert.match(iosSettings, /folder\.folderType == \.project \? "Project" : "Reference"/);
assert.match(iosSettings, /folderDeletionDescription\(/);
assert.doesNotMatch(iosSettings, /Delete project\?|Delete projects\?/);

assert.match(iosResearch, /researchAccessRecovery\([\s\S]*?buttonTitle: "Open Account"[\s\S]*?section: \.account/);
assert.match(iosResearch, /researchAccessRecovery\([\s\S]*?buttonTitle: "View Plans"[\s\S]*?section: \.plan/);
assert.match(iosResearch, /Your selected Reader passage is kept/);
assert.match(iosResearch, /guard library\.signedInAccount != nil,[\s\S]*?library\.hasResearchAccess/);
assert.match(iosResearch, /library\.folders\.filter \{ \$0\.folderType == \.project \}/);
assert.match(iosResearch, /Project context: \\\(projectName/);
assert.match(iosResearch, /conversation\.sourceStatus == "changed"[\s\S]*?Refresh Sources/);
assert.match(iosResearch, /conversation\.projectContextReviewRequired[\s\S]*?projectContextWarning/);
assert.match(iosResearch, /Confirm Current Project/);
assert.match(iosResearchModels, /struct ResearchProjectContextReviewRequest/);
assert.match(iosResearch, /researchSendIsBlocked/);
assert.match(iosResearch, /Button \{[\s\S]*?onOpenCitation\(citation\)/);
assert(iosResearch.includes('.accessibilityLabel("Open \\(citationAccessibilityLabel(citation)) in Reader")'));
for (const label of [
  "What the cited evidence establishes",
  "Assumptions used",
  "Project facts to verify",
  "Limits of this answer",
  "Questions that would materially advance this answer",
  "Related evidence to add",
  "Cited sources"
]) {
  assert(iosResearch.includes(label), `iPhone Research is missing ${label}.`);
}
for (const field of ["sectionID", "sourceIDs", "relevance", "codeVersion", "codeEdition", "corpusLabel", "evidenceRole"]) {
  assert(iosResearchModels.includes(`var ${field}:`), `iPhone citation model is missing ${field}.`);
}
assert.match(iosViewModel, /func openResearchCitation\(sectionID: Int64, codeVersion: String\?\)/);
assert.match(iosViewModel, /pendingDeepLinkedSectionID = sectionID[\s\S]*?selectedTab = \.search/);
assert.match(iosViewModel, /func reviewResearchProjectContext\(/);
assert(iosNotebook.includes('Label("Project: \\(projectName)", systemImage: "folder")'));

assert.match(iosSaved, /projectHubSection\(title: "Reports"/);
assert.match(iosSaved, /"Export & Save iOS PDF"/);
assert.doesNotMatch(iosSaved, /projectHubSection\(title: "Exports"|Create & Save iOS PDF/);
assert.match(iosOrganizationHub, /label: "Reports"/);
assert.match(iosOrganizationHub, /projectSection\(title: "Reports"/);

assert.match(webClient, /projectLabel\.textContent = "Project context"[\s\S]*?createResearchProjectSelect/);
assert.match(webClient, /initialProjectID = projectSelect\.value[\s\S]*?projectID: initialProjectID/);
assert.match(webClient, /function researchProjectChoices[\s\S]*?activeProjectRecords\(currentContentSummary\(\)\.projects \|\| \[\]\)/);
assert.doesNotMatch(webClient, /folders\.filter\(\(folder\) => !folderIsProject\(folder\)\)\.forEach/);
assert.match(webClient, /const exactSource = answerSources\.find[\s\S]*?openSourceInReader\(exactSource/);
assert.match(webClient, /if \(citation\.sectionID \|\| citation\.sectionNumber\)[\s\S]*?openSourceInReader\(citation/);
assert.match(webClient, /: "Governing"/);
assert.equal((webClient.match(/projectOwnership\.textContent = `Project: \$\{identity\.name\}`/g) || []).length, 2);
assert.match(webStyles, /\.project-ownership-label/);
assert.doesNotMatch(webClient, /Project Report Manifest as PDF/);
assert.match(webIndex, /first-use-phase5-v1/);
assert.match(serviceWorker, /permitext-pro-shell-v721/);

console.log("UX/UI meaning Phase 3 contract passed.");
