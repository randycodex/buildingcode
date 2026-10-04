import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import {
  researchSystemRecoveryReasons,
  researchVerificationRecoveryTextForReason
} from "../public/research-failure-recovery.js";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const extract = name => {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf("\n}", start);
  assert(start >= 0 && end > start, name);
  return source.slice(start, end + 2);
};

// Invoke the actual shipped rendering functions without browser, API or model
// calls. This verifies field grouping and presentation, not legal accuracy.
class Element {
  constructor(tag) {
    this.localName = tag;
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.events = {};
    this.style = {};
  }
  get textContent() { return (this.text || "") + this.children.map(node => node.textContent).join(""); }
  set textContent(value) { this.text = String(value); this.children = []; }
  get innerText() { return this.textContent; }
  append(...nodes) {
    for (const node of nodes) {
      if (node.parent) node.parent.children = node.parent.children.filter(item => item !== node);
      node.parent = this;
      this.children.push(node);
    }
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(name, callback) { this.events[name] = callback; }
  matches(selector) {
    return selector.startsWith(".")
      ? (this.className || "").split(" ").includes(selector.slice(1))
      : this.localName === selector;
  }
  querySelectorAll(selectors) {
    return [...new Set(selectors.split(",").flatMap(value => {
      const selector = value.trim();
      if (selector.startsWith(":scope > ")) return this.children.filter(node => node.matches(selector.slice(9)));
      return this.children.flatMap(node => [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)]);
    }))];
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}
const document = {
  createElement: tag => new Element(tag),
  createTextNode: value => Object.assign(new Element("#text"), { text: String(value) })
};
const copied = [];
const context = vm.createContext({
  document, Date, URL, Set, Map, researchSystemRecoveryReasons, researchVerificationRecoveryTextForReason,
  clear: node => { node.children = []; },
  wireResearchDetailsMotion() {},
  copyTextToClipboard: async text => { copied.push(text); return true; },
  window: { setTimeout() {} },
  fetch() { throw Error("External calls are forbidden"); }
});
vm.runInContext([
  "researchDisplayText", "researchDisplayList", "researchAnswerHasVerificationRecovery", "researchVerificationRecoveryText",
  "researchAnswerNarrativeText", "researchApplicabilityStatusLabel", "researchCorpusMetadataLines", "researchAnswerCopyText",
  "appendResearchInlineFormatting", "appendResearchInlineLines", "researchAnswerTable", "researchAnswerDisplayMarkdown",
  "appendResearchAnswerNarrative", "appendResearchList", "appendResearchSupportedPoints", "appendResearchUnresolved",
  "appendResearchProjectContextDisclosure", "renderResearchInterpretation"
].map(extract).join("\n"), context);

const standard = {
  mode: "openai", authorityStatus: "supported_by_enacted_text", authorityLabel: "Supported by enacted text",
  verification: { pass: true }, answerText: "The cited rule resolves this narrow question.",
  supportedPoints: [], assumptions: [], followUpQuestions: [], missingFacts: [],
  evidenceLimitations: [], additionalEvidenceNeeded: [], citations: [], supportingSources: []
};
function render(changes = {}) {
  const result = { ...structuredClone(standard), ...structuredClone(changes) };
  const before = JSON.stringify(result);
  const container = document.createElement("section");
  context.renderResearchInterpretation(container, result, { detailsOpen: true });
  assert.equal(JSON.stringify(result), before, "Rendering must leave stored answers and metadata unchanged.");
  return { container, result };
}
const headingGroups = container => container.querySelectorAll("h4").map(heading => {
  const index = heading.parent.children.indexOf(heading);
  const list = heading.parent.children[index + 1];
  return { heading: heading.textContent, items: list?.localName === "ul" ? list.children.map(item => item.textContent) : [] };
});

// Exact captured v31-C2 authority-family note: no missing-source implication.
const fireBasisNote = "The applicable evidence is from the 2022 NYC Fire Code current consolidated text, not the 2022 NYC Construction Codes; the answer relies on the cited Fire Code provision.";
const { container: fire } = render({ evidenceLimitations: [fireBasisNote] });
assert.deepEqual(headingGroups(fire), [{ heading: "Scope and source notes", items: [fireBasisNote] }]);
assert(!fire.textContent.includes("Sources still needed"));
assert(fire.querySelector(".research-answer-boundary").textContent.includes("1 scope/source note"));
assert(!fire.querySelector(".research-answer-boundary").textContent.includes("source still needed"));

// Exact captured v31-B1 opening: partial rule support must not become a yes,
// and must not depend on a regex recognizing this particular wording.
const gasOpening = "The available 2022 code text does not establish a yes for this gas heater. Gas-fired appliance installation is regulated by the NYC Fuel Gas Code, and its applicable bathroom-location rule is not included here (MC § 901.1).";
const sourceBoundary = "The applicable 2022 NYC Fuel Gas Code bathroom-location prohibition and its exceptions are not supplied; permission to install this gas-fired heater in a bathroom cannot be resolved from the Mechanical Code exception alone.";
const neededSource = "The applicable 2022 NYC Fuel Gas Code appliance-location provision, including its bathroom prohibition, exceptions and enacted scope.";
const { container: partial, result: partialResult } = render({
  answerText: gasOpening, evidenceLimitations: [sourceBoundary], additionalEvidenceNeeded: [neededSource]
});
assert.equal(partial.querySelector(".research-authority-status").textContent, "Enacted text supports the cited points");
assert.equal(partial.querySelector(".research-authority-status").dataset.authorityStatus, "supported_by_enacted_text");
assert.equal(partial.querySelector(".research-answer-narrative").textContent, gasOpening);
assert.deepEqual(headingGroups(partial), [
  { heading: "Scope and source notes", items: [sourceBoundary] },
  { heading: "Sources still needed", items: [neededSource] }
]);
assert(partial.querySelector(".research-answer-boundary").textContent.includes("1 source still needed"));
const beforeCopy = JSON.stringify(partialResult);
await partial.querySelector(".research-answer-copy").events.click();
assert.equal(copied.at(-1), gasOpening, "Copy retains the original narrative, not a rewritten conclusion.");
assert.equal(JSON.stringify(partialResult), beforeCopy);

// Explicit backend classifications and custom fact-only overrides survive,
// even if narrative wording resembles uncertainty or shares support status.
for (const [authorityStatus, authorityLabel] of [
  ["conditional", "Conditional on Project facts"],
  ["insufficient_evidence", "Insufficient enacted evidence"],
  ["official_supporting_guidance", "Official supporting guidance — noncontrolling"],
  ["official_amendment_metadata", "Official amendment metadata — source snapshot"],
  ["enacted_text_with_official_metadata", "Enacted text and official amendment metadata"],
  ["project_context", "Project facts only"],
  ["evidence_boundary", "Clarification — no determination"],
  ["supported_by_enacted_text", "Conversation facts — no code determination"],
  ["supported_by_enacted_text", "User-supplied text — not a code determination"],
  ["supported_by_enacted_text", "Practical guidance — no code determination"]
]) {
  const { container } = render({ authorityStatus, authorityLabel, answerText: "Cannot determine the separate project issue.", evidenceLimitations: ["Keep this qualification visible."] });
  assert.equal(container.querySelector(".research-authority-status").textContent, authorityLabel);
  assert.equal(container.querySelector(".research-authority-status").dataset.authorityStatus, authorityStatus);
}
const { container: recovered } = render({
  mode: "clarification", model: "permitext-conversation-clarification", authorityStatus: "evidence_boundary",
  authorityLabel: "Clarification — no determination", verification: { status: "clarification", pass: false, reason: "verification_source" }
});
assert.equal(recovered.querySelector(".research-authority-status").textContent, "Clarification — no determination");
assert(recovered.textContent.includes("Your question and conversation are saved. You don’t need to repeat the question."));

// Empty lists create no headings. All warnings remain, with deduplication
// only within each existing field, never based on the legal words they use.
const { container: empty } = render();
assert.deepEqual(headingGroups(empty), []);
assert.equal(empty.querySelector(".research-authority-status").textContent, "Enacted text supports the cited points");
const warning = "The cited source does not establish the requested permission.";
const fact = "Confirm the proposed use.";
const { container: qualified } = render({
  evidenceLimitations: [warning, warning, fireBasisNote], additionalEvidenceNeeded: [warning], missingFacts: [fact],
  structuredEvidenceAnalysis: { projectFactsUsed: ["Saved project use"], unresolvedProjectFacts: [fact] },
  factUsage: { projectContext: ["Saved project use"], conversation: [], other: [] }
});
assert.deepEqual(headingGroups(qualified), [
  { heading: "Scope and source notes", items: [warning, fireBasisNote] },
  { heading: "Sources still needed", items: [warning] },
  { heading: "Project details that may affect the answer", items: [fact] }
]);
assert(qualified.textContent.includes("Project context: Saved project use"));
assert(qualified.textContent.includes("Still needed: Confirm the proposed use."));
assert(!extract("renderResearchInterpretation").includes("missingConclusionEvidence"), "Authority display must not infer applicability from narrative wording.");
console.log("Research source qualification rendering passed: separate notes/needs, cited-point support label, explicit/custom statuses, captured boundary wording, warning/fact preservation, immutable history and copy; synthetic DOM only.");
