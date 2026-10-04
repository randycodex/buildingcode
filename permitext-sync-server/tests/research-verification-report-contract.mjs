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
  get innerText() { return this.children.length ? this.children.map(node => node.innerText).join("\n\n") : this.textContent; }
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
    if (selector.includes(",")) return [...new Set(selector.split(",").flatMap(value => this.querySelectorAll(value.trim())))];
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
  "researchDisplayText", "researchDisplayList", "researchAnswerHasVerificationRecovery", "researchRecoveryQuestionForMessage", "researchVerificationRecoveryText",
  "researchAnswerNarrativeText", "researchApplicabilityStatusLabel", "researchCorpusMetadataLines", "researchAnswerCopyText",
  "appendResearchInlineFormatting", "appendResearchInlineLines", "researchAnswerTable", "researchAnswerDisplayMarkdown",
  "appendResearchAnswerNarrative", "appendResearchList", "researchFeedbackUserStatus", "renderResearchFeedback",
  "renderResearchInterpretation"
].map(extract).join("\n"), context);

const originalQuestion = "  Does **this route**\n meet the requirement? [SECTION_ID: intact] <literal>  ";
const normalizedQuestion = "Does **this route** meet the requirement? [SECTION_ID: intact] <literal>";
const expected = {
  verification_source: `I found a mismatch between my explanation and its source references while preparing the answer to “${normalizedQuestion}”, so I couldn’t finish it.`,
  verification_context: `I couldn’t consistently use the project details already provided while preparing the answer to “${normalizedQuestion}”, so I couldn’t finish it.`,
  verification_format: `I ran into a problem while preparing the answer to “${normalizedQuestion}”, so I couldn’t finish it.`,
  verification_incomplete: `I couldn’t finish the source checks for the answer to “${normalizedQuestion}”, so I couldn’t finish it.`,
  evidence_unavailable: `I couldn’t prepare the code evidence needed to answer “${normalizedQuestion}”, so I couldn’t finish it.`,
  research_unresolved: `I couldn’t resolve the conditions needed to answer “${normalizedQuestion}”, so I couldn’t finish it.`
};
for (const [reason, explanation] of Object.entries(expected)) {
  const answer = researchClarificationAnswer(originalQuestion, reason);
  // Historical coarse failure records may contain the old repeat instruction
  // or an unrelated generated missing-fact question. Neither is a user burden.
  answer.answerText = "I couldn’t verify the explanation. Retry this question here.";
  answer.followUpQuestions = ["Which project fact are you missing?"];
  const before = JSON.stringify(answer);
  const message = { id: `old-${reason}`, role: "assistant", requestID: `request-${reason}`, answer };
  const conversation = { id: "saved-conversation", messages: [
    { role: "user", requestID: message.requestID, question: originalQuestion }, message,
    { role: "user", requestID: "later-request", question: "A later unrelated question" }
  ] };
  const container = document.createElement("section");
  const composerDraft = { value: "Unsent follow-up draft" };
  context.renderResearchInterpretation(container, answer, { message, conversation, conversationID: "saved-conversation" });
  const narrative = container.querySelector(".research-answer-narrative");
  assert.equal(narrative.children[0].textContent, explanation);
  assert.equal(narrative.children[1].textContent, "Use Report this issue below to report this attempt.");
  assert.doesNotMatch(container.textContent, /Retry this question|Which project fact are you missing\?|saved|still here|A later unrelated question/);
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
  assert.equal(copied.at(-1), narrative.innerText, "Copy uses the visibly rendered text including literal question symbols");
  assert.equal(copied.at(-1), `${explanation}\n\nUse Report this issue below to report this attempt.`);
  assert.equal(JSON.stringify(answer), before, "Rendering, copying and reporting never rewrite the saved historical answer.");
  assert.equal(composerDraft.value, "Unsent follow-up draft");
}

// Bind only the unique preceding user for this assistant request. A current
// composer value, later user message or another conversation cannot substitute.
{
  const message={id:"assistant",role:"assistant",requestID:"request"};
  const prior={role:"user",requestID:"request",question:"Exact preceding question"};
  const conversation={id:"owned",messages:[prior,message,{role:"user",requestID:"later",question:"Later question"}]};
  const bind=changes=>context.researchRecoveryQuestionForMessage({message,conversation,conversationID:"owned",...changes});
  assert.equal(bind(),prior.question);
  assert.equal(bind({conversationID:"another"}),"");
  assert.equal(bind({message:{...message,requestID:"unmatched"}}),"");
  assert.equal(bind({conversation:{...conversation,messages:[message,prior]}}),"");
  assert.equal(bind({conversation:{...conversation,messages:[prior,{...prior},message]}}),"");
  assert.equal(bind({conversation:{...conversation,messages:[prior,message,{...message}]}}),"");
  const legacy={id:"legacy",role:"assistant"}, user={role:"user",question:"Exact legacy question"};
  assert.equal(bind({message:legacy,conversation:{id:"owned",messages:[user,legacy]}}),user.question);
  assert.equal(bind({message:legacy,conversation:{id:"owned",messages:[user,{role:"assistant",id:"other"},legacy]}}),"");
  assert.equal(bind({message:legacy,conversation:{id:"owned",messages:[prior,legacy]}}),"");
  const answer=researchClarificationAnswer("Original", "verification_format"), container=document.createElement("section");
  context.renderResearchInterpretation(container,answer,{message,conversationID:"unbound"});
  assert.equal(container.querySelector(".research-answer-narrative").innerText,researchVerificationRecoveryTextForReason("verification_format"));
  const recordContainer=document.createElement("section");
  context.renderResearchInterpretation(recordContainer,answer,{recordQuestion:"Exact record question"});
  assert.equal(recordContainer.querySelector(".research-answer-narrative").innerText,researchVerificationRecoveryTextForReason("verification_format","Exact record question"));
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
