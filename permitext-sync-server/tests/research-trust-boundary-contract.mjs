import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const [server, web, privacy, nativeModels, nativeResearch] = await Promise.all([
  readFile(join(root, "../app.mjs"), "utf8"),
  readFile(join(root, "../public/app.js"), "utf8"),
  readFile(join(root, "../public/privacy.html"), "utf8"),
  readFile(join(root, "../../NYC CC APP/permitext/Models/ResearchNotebookModels.swift"), "utf8"),
  readFile(join(root, "../../NYC CC APP/permitext/Views/ResearchView.swift"), "utf8")
]);

for (const status of [
  "supported_by_enacted_text",
  "official_supporting_guidance",
  "conditional",
  "insufficient_evidence"
]) {
  assert.match(server, new RegExp(`"${status}"`));
}
assert.match(server, /sourceAsOf: answerCodeBasis\.resolvedAt/);
assert.match(server, /Verify cited text, source status, and Project facts before relying/);

assert.match(web, /function researchComposerDisclosure\(\)/);
assert.match(web, /current Project facts when assigned to OpenAI/);
assert.match(web, /AI-assisted—not an official interpretation/);
assert.match(web, /const researchChatPlaceholder = "Ask a Research question…"/);
assert.match(web, /A Research model produced a response, but Permitext could not verify it against the enacted evidence\. Your question is still here\./);
assert.match(web, /result\.authorityLabel/);
assert.match(web, /Research basis captured/);
assert.match(
  web,
  /String\(codeBasis\?\.limitation \|\| ""\)\.trim\(\)/,
  "The web answer must render a code-basis limitation visibly instead of relying on hover text."
);

for (const disclosure of [
  "recent conversation messages",
  "current Project facts",
  "structured evidence analysis",
  "store: false",
  "up to 30 days",
  "street addresses from the search query",
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
assert.match(nativeResearch, /private var primaryNarrative/);
assert.doesNotMatch(nativeResearch, /Ask Terra|Terra is researching|Terra's research service/);

console.log("Permitext Research privacy and legal-boundary contract passed.");
