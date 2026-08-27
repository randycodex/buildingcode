import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  researchAuthorityClassification,
  researchFeedbackStatusForClient
} from "../app.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const [server, web, privacy, nativeModels, nativeResearch] = await Promise.all([
  readFile(join(root, "../app.mjs"), "utf8"),
  readFile(join(root, "../public/app.js"), "utf8"),
  readFile(join(root, "../public/privacy.html"), "utf8"),
  readFile(join(root, "../../NYC CC APP/permitext/Models/ResearchNotebookModels.swift"), "utf8"),
  readFile(join(root, "../../NYC CC APP/permitext/Views/ResearchView.swift"), "utf8")
]);
const webSettings = web.slice(
  web.indexOf("function renderSettings()"),
  web.indexOf("function wireChapterSelects")
);

for (const status of [
  "supported_by_enacted_text",
  "official_supporting_guidance",
  "conditional",
  "insufficient_evidence"
]) {
  assert.match(server, new RegExp(`"${status}"`));
}
assert.deepEqual(
  researchAuthorityClassification({
    citations: [{ evidenceRole: "governing" }]
  }),
  { status: "supported_by_enacted_text", label: "Supported by enacted text" }
);
assert.equal(
  researchAuthorityClassification({
    citations: [{ evidenceRole: "supporting" }],
    missingFacts: ["Confirm occupancy."]
  }).status,
  "conditional"
);
assert.equal(
  researchAuthorityClassification({ citations: [{ evidenceRole: "contextual" }] }).status,
  "insufficient_evidence",
  "Context-only evidence must not be labeled as enacted support."
);
assert.equal(
  researchAuthorityClassification({ supportingSources: [{ id: "dob-guidance" }] }).status,
  "official_supporting_guidance"
);
assert.equal(researchAuthorityClassification().status, "insufficient_evidence");
assert.equal(
  researchAuthorityClassification({
    evidenceBoundaryFallback: true,
    citations: [{ evidenceRole: "governing" }]
  }).status,
  "insufficient_evidence"
);
assert.equal(researchFeedbackStatusForClient({ triageStatus: "new" }), "received");
assert.equal(researchFeedbackStatusForClient({ triageStatus: "reviewing" }), "under_review");
assert.equal(researchFeedbackStatusForClient({ triageStatus: "resolved" }), "resolved");
assert.equal(researchFeedbackStatusForClient({ triageStatus: "dismissed" }), "closed");
assert.match(server, /sourceAsOf: answerCodeBasis\.resolvedAt/);
assert.match(server, /Verify cited text, source status, and Project facts before relying/);

assert.match(web, /function researchComposerDisclosure\(\)/);
assert.match(web, /current Project facts when assigned to OpenAI/);
assert.match(web, /Private notes are not included/);
assert.match(
  web,
  /Selected official images are sent to OpenAI for analysis\. Private notes are not included\./,
  "web visual confirmation should disclose the provider boundary before official images are attached"
);
assert.match(web, /AI-assisted—not an official interpretation/);
assert.match(web, /const researchDisclosureAcknowledgmentVersion = "2026-08-27-v1"/);
assert.match(web, /async function ensureResearchDisclosureAcknowledged\(container\)/);
assert.match(web, /confirmLabel: "I understand"/);
assert.equal(
  (web.match(/if \(!\(await ensureResearchDisclosureAcknowledged\((?:form|composer)\)\)\)/g) || []).length,
  2,
  "Both new and follow-up Research submissions must acknowledge the disclosure before network work begins."
);
assert.match(web, /Unassigned: no saved Project facts will be sent\. Private notes are not included\./);
assert.match(web, /Project context sent:/);
assert.match(web, /function researchAnswerCopyText\(result\)/);
assert.match(web, /function researchCorpusMetadataLines\(codeBasis\)/);
assert.match(web, /Edition: \$\{corpus\.codeEdition\}/);
assert.match(web, /Applicability: \$\{researchApplicabilityStatusLabel\(corpus\.applicabilityStatus\)\}/);
assert.match(web, /appendSection\("Corpus basis", researchCorpusMetadataLines\(codeBasis\)\)/);
assert.match(web, /aria-label", "Research corpus editions and applicability"/);
assert.match(web, /appendSection\("Answer classification", result\?\.authorityLabel \|\| result\?\.authorityStatus\)/);
assert.match(web, /appendSection\("Code basis"/);
assert.match(web, /appendSection\("Citations", citationLines\)/);
assert.match(web, /appendSection\("Limits of this answer", result\?\.evidenceLimitations\)/);
assert.match(web, /appendSection\("Related evidence to add", result\?\.additionalEvidenceNeeded\)/);
assert.match(web, /appendSection\("Professional-use notice"/);
assert.match(web, /copyButton\.textContent = "Copy answer"/);
assert.match(web, /Copied with sources and notice/);
assert.match(web, /function researchFeedbackUserStatus\(feedback\)/);
for (const label of [
  'return "Received"',
  'return "Under review"',
  'return "Resolved"',
  'return "Closed"'
]) {
  assert.ok(web.includes(label), `Web feedback status is missing neutral user wording: ${label}`);
}
assert.match(web, /status\.textContent = researchFeedbackUserStatus\(message\.feedback\)/);
assert.match(web, /const researchChatPlaceholder = "Ask a Research question…"/);
assert.match(web, /A Research model produced a response, but Permitext could not verify it against the enacted evidence\. Your question is still here\./);
assert.match(web, /result\.authorityLabel/);
assert.match(web, /officialGuidanceOnly/);
assert.match(web, /const distinctSupportingSourceCount = new Set/);
assert.match(web, /source\?\.id \|\| source\?\.url/);
assert.match(web, /distinctSupportingSourceCount \|\| Number\(sourceSummary\.supportingWebSourceCount \|\| 0\)/);
assert.match(web, /No enacted provision cited/);
assert.match(web, /result\.disclaimer \|\| "AI-generated research assistance, not an official code determination\."/);
assert.match(web, /parsedSourceAsOf\.toISOString\(\)\.slice\(0, 10\)/);
assert.match(web, /sourceAsOf \? `Research basis captured \$\{sourceAsOf\}` : ""/);
assert.doesNotMatch(web, /(?:Law|Code) (?:effective|current through|as of) \$\{sourceAsOf\}/i);
assert.match(web, /Supporting context — noncontrolling/);
assert.match(web, /link\.target = "_blank"/);
assert.match(web, /link\.rel = "noopener noreferrer"/);
assert.match(web, /const rawURL = String\(source\.url \|\| ""\)\.trim\(\)/);
assert.match(web, /rawURL \? new URL\(rawURL\) : null/);
assert.match(web, /url\?\.protocol === "https:" && url\.hostname/);
assert.doesNotMatch(web, /new URL\(String\(source\.url \|\| ""\), window\.location\.origin\)/);
assert.match(web, /Research basis captured/);
assert.match(webSettings, /const researchUsageAccount = activeAccount\(\);/);
assert.match(
  webSettings,
  /postJSON\([\s\S]*?"\/research\/usage"[\s\S]*?accountUserID: researchUsageAccount\.userID[\s\S]*?token: researchUsageAccount\.sessionToken/
);
assert.match(
  webSettings,
  /currentAccount\?\.userID !== researchUsageAccount\.userID \|\|[\s\S]*?currentAccount\?\.sessionToken !== researchUsageAccount\.sessionToken/
);
assert.doesNotMatch(webSettings, /hasCapability\("research"\) && !researchUsage/);
assert.match(
  web,
  /String\(codeBasis\?\.limitation \|\| ""\)\.trim\(\)/,
  "The web answer must render a code-basis limitation visibly instead of relying on hover text."
);

for (const disclosure of [
  "recent conversation messages",
  "current Project facts",
  "structured evidence analysis",
  "that image is also sent to OpenAI",
  "store: false",
  "up to 30 days",
  "up to 24 hours",
  "attempts to remove obvious identifiers",
  "Retention summary"
]) {
  assert.ok(privacy.includes(disclosure), `Privacy policy is missing: ${disclosure}`);
}

assert.match(nativeModels, /var authorityStatus: String\?/);
assert.match(nativeModels, /var authorityLabel: String\?/);
assert.match(nativeModels, /var sourceAsOf: String\?/);
assert.match(nativeModels, /var codeBasis: ResearchCodeBasis\?/);
assert.match(nativeModels, /var sourceSummary: ResearchSourceSummary\?/);
assert.match(nativeModels, /var factUsage: ResearchFactUsage\?/);
assert.match(nativeModels, /var supportingSources: \[ResearchSupportingSource\]\?/);
assert.match(nativeResearch, /research-composer-privacy-disclosure/);
assert.match(nativeResearch, /research-answer-authority-status/);
assert.match(nativeResearch, /research-answer-source-boundary/);
assert.match(nativeResearch, /research-answer-facts-used/);
assert.match(nativeResearch, /research-answer-supporting-context/);
assert.match(nativeModels, /authorityStatus == "official_supporting_guidance"/);
assert.match(nativeModels, /No enacted provision cited/);
assert.match(nativeModels, /resolved\.scheme\?\.lowercased\(\) == "https"/);
assert.match(nativeModels, /var researchSourceDateLabel: String\?/);
assert.match(nativeResearch, /private var primaryNarrative/);
assert.doesNotMatch(nativeResearch, /Ask Terra|Terra is researching|Terra's research service/);

console.log("Permitext Research privacy and legal-boundary contract passed.");
