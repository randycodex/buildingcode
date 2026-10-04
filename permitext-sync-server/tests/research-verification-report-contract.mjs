import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { researchClarificationAnswer } from "../research-conversation-continuity.mjs";
import { researchSystemRecoveryReasons, researchVerificationRecoveryTextForReason } from "../public/research-failure-recovery.js";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf("\n}", start);
  assert(start >= 0 && end > start, name);
  return source.slice(start, end + 2);
}

// Exercise the shipped narrative, copy, answer card and existing report form.
// This small DOM stand-in performs no browser, network or provider work.
class Element {
  constructor(tag) {
    this.localName = tag;
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.events = {};
    this.style = {};
    this.hidden = false;
    this.disabled = false;
    this.value = "";
  }
  get textContent() { return (this.text || "") + this.children.map(node => node.textContent).join(""); }
  set textContent(value) { this.text = String(value); this.children = []; }
  get lastElementChild() { return this.children.filter(node => node.localName !== "#text").at(-1); }
  append(...nodes) {
    for (const node of nodes) {
      if (node.parent) node.parent.children = node.parent.children.filter(item => item !== node);
      node.parent = this;
      this.children.push(node);
    }
  }
  replaceWith(node) {
    const parent = this.parent, index = parent.children.indexOf(this);
    parent.children.splice(index, 1, node);
    node.parent = parent;
    this.parent = null;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
  addEventListener(name, callback) { this.events[name] = callback; }
  matches(selector) {
    return selector.startsWith(".")
      ? (this.className || "").split(" ").includes(selector.slice(1))
      : this.localName === selector;
  }
  querySelectorAll(selector) {
    if (selector.startsWith(":scope > ")) return this.children.filter(node => node.matches(selector.slice(9)));
    return this.children.flatMap(node => [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}
const requests = [], copied = [];
const document = {
  createElement: tag => new Element(tag),
  createTextNode: value => Object.assign(new Element("#text"), { text: String(value) })
};
const context = vm.createContext({ document, Date, URL, Set, Map, console,
  researchSystemRecoveryReasons, researchVerificationRecoveryTextForReason,
  clear: node => { node.children = []; },
  wireResearchDetailsMotion() {}, enhanceSelect() {},
  appendResearchSupportedPoints() {}, appendResearchUnresolved() {}, appendResearchProjectContextDisclosure() {},
  researchSourcesForAnswer: () => [], researchThumbIconSVG: direction => `<svg data-direction="${direction}"></svg>`,
  copyTextToClipboard: async text => { copied.push(text); return true; },
  window: { setTimeout() {} },
  postResearch: async (path, body) => {
    requests.push({ path, body });
    return { feedback: { category: body.category, userComment: body.comment } };
  },
  fetch() { throw Error("External calls are forbidden"); }
});
vm.runInContext([
  "researchDisplayText", "researchDisplayList", "researchAnswerHasVerificationRecovery", "researchVerificationRecoveryText",
  "researchAnswerNarrativeText", "researchApplicabilityStatusLabel", "researchCorpusMetadataLines", "researchAnswerCopyText",
  "appendResearchInlineFormatting", "appendResearchInlineLines", "researchAnswerTable", "researchAnswerDisplayMarkdown",
  "appendResearchAnswerNarrative", "appendResearchList", "researchFeedbackUserStatus", "renderResearchFeedback",
  "renderResearchInterpretation"
].map(extract).join("\n"), context);

const expected = {
  verification_source: "Research couldn’t finish because its explanation and source references didn’t agree.",
  verification_context: "Research couldn’t finish because its explanation didn’t consistently use the project details already provided.",
  verification_format: "Research received an answer or review it couldn’t read.",
  verification_incomplete: "Research couldn’t complete its source checks for this question.",
  evidence_unavailable: "Research couldn’t prepare the code evidence needed to answer this question.",
  research_unresolved: "Research couldn’t resolve the conditions needed to answer this question."
};
for (const [reason, explanation] of Object.entries(expected)) {
  const answer = researchClarificationAnswer("Does the proposed route meet the requirement?", reason);
  // Historical coarse failure records may contain the old repeat instruction
  // or an unrelated generated missing-fact question. Neither is a user burden.
  answer.answerText = "I couldn’t verify the explanation. Retry this question here.";
  answer.followUpQuestions = ["Which project fact are you missing?"];
  const before = JSON.stringify(answer);
  const message = { id: `old-${reason}`, role: "assistant", answer };
  const container = document.createElement("section");
  const composerDraft = { value: "Unsent follow-up draft" };
  context.renderResearchInterpretation(container, answer, { message, conversationID: "saved-conversation" });
  const narrative = container.querySelector(".research-answer-narrative");
  assert.equal(narrative.children[0].textContent, explanation);
  assert.equal(narrative.children[1].textContent, "Your question and conversation are saved. You don’t need to repeat the question.");
  assert.doesNotMatch(container.textContent, /Retry this question|Which project fact are you missing\?/);
  assert.equal(container.querySelector(".research-feedback-icon"), null, "An incomplete system result must not invite Helpful approval.");
  const report = container.querySelector(".research-feedback-report");
  assert.equal(report.textContent, "Report this issue", "The recovery action is visible text, not an unexplained icon.");
  const form = container.querySelector(".research-feedback");
  const details = form.querySelector(".research-feedback-details");
  assert.equal(details.hidden, true);
  const requestCount = requests.length;
  await report.events.click();
  assert.equal(details.hidden, false, "Report opens the existing review form.");
  assert.equal(report.getAttribute("aria-expanded"), "true");
  assert.equal(requests.length, requestCount, "Opening Report never sends feedback or retries Research.");
  await form.querySelector(".research-feedback-cancel").events.click();
  assert.equal(details.hidden, true);
  assert.equal(requests.length, requestCount);
  await report.events.click();
  const category = form.querySelectorAll(".research-feedback-choice").find(node => node.textContent === "Missing information");
  await category.events.click();
  assert.equal(requests.length, requestCount, "Choosing an issue category is still only a local draft.");
  await form.events.submit({ preventDefault() {} });
  assert.equal(requests.length, requestCount + 1);
  assert.equal(requests.at(-1).path, "/research/feedback");
  assert.equal(requests.at(-1).body.conversationID, "saved-conversation");
  assert.equal(requests.at(-1).body.answerID, message.id);
  assert.equal(requests.at(-1).body.category, "missing_information");
  await container.querySelector(".research-answer-copy").events.click();
  assert.equal(copied.at(-1), `${explanation}\n\nYour question and conversation are saved. You don’t need to repeat the question.`);
  assert.equal(JSON.stringify(answer), before, "Rendering, copying and reporting never rewrite the saved historical answer.");
  assert.equal(composerDraft.value, "Unsent follow-up draft");
}

for (const answer of [
  researchClarificationAnswer("Which street-facing uses are proposed?", "evidence"),
  researchClarificationAnswer("Which street-facing uses are proposed?", "verification"),
  { mode: "openai", answerText: "Research couldn’t resolve a hypothetical example.", verification: { pass: true }, followUpQuestions: ["How high is the proposed sill?"] }
]) {
  const container = document.createElement("section");
  const before = JSON.stringify(answer);
  context.renderResearchInterpretation(container, answer, { message: { id: "ordinary", answer }, conversationID: "conversation" });
  assert.equal(context.researchVerificationRecoveryText(answer), "");
  assert.equal(container.querySelector(".research-feedback-report"), null);
  assert(container.querySelector(".research-feedback-icon"), "Ordinary answers keep their existing feedback controls.");
  assert(container.textContent.includes(answer.followUpQuestions[0]), "A genuine factual follow-up remains visible.");
  assert.equal(JSON.stringify(answer), before);
}
assert(!source.includes("submitResearchConversationQuestion"), "System issue reports must not introduce a paid resubmission path.");
assert(!source.includes("researchVerificationRecoveryQuestion"), "No failed-question repeat helper remains.");
console.log("Verification recovery UI passed: reason-specific copy, immutable historical answers, display/copy agreement, visible report form, explicit-only feedback send, factual clarification preserved; synthetic DOM only.");
