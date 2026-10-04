import { hasVerifiedResearchOfficialGuidanceSummary } from "./research-official-guidance-summary.mjs";
import { researchClaimScopeInstruction, researchZoningExplanationScopeInstruction } from "./research-claim-scope.mjs";
import { researchRequestedOutsideAuthorityURLs } from "./evidence-discovery.mjs";

export const researchAnswerPresentationVersion = "20261004-source-supported-answer-completeness-v24";

// Shared by generation and verification, independent of numeric comparisons.
export const researchDecisionFactInstruction =
  "A leading Yes or No must answer the actual question, not signal acknowledgement, and must agree with the explanation. For a numeric result, calculate from the source's stated quantities, fractions, ratios and units; do not substitute a rounded parenthetical percentage or unit conversion when it changes the required result. Show the controlling expression and retain any actual rounding rule or unresolved conflict. Check the opening conclusion and each retained calculation together on the first review. For every question, put a fact in missingFacts or followUpQuestions only if it can change or determine the requested result. Once the supplied evidence and facts establish that result, details needed solely to design a compliant replacement or apply an optional downstream exception are not missing facts for that decision. This applies to both Yes and No answers and to non-numeric questions. Such details may be labeled as optional design context without making the answer depend on them. Retain unresolved applicability or exception facts that could change the result, and design or calculation inputs when the user requests that design or calculation. When comparing a corrected hypothetical value with a previously stated threshold, distinguish the numerical comparison from overall compliance. An exception that would affect the original and corrected scenarios identically does not prevent answering whether the correction changes the result; retain any necessary applicability qualification at the comparison without demanding irrelevant new facts.";

export const researchGuidedNextStepInstruction =
  "Answer this turn first; follow-up questions are optional. Ask ONE plain-language question in followUpQuestions, or suggest one in a passing review's projectFactQuestions, only when its answer can change or determine the current requested result. Explain that relevance in answerText. A fact that merely refines a conditional side rule or later design choice must not reopen an already resolved decision; keep any necessary condition in prose and leave the question list empty. Never bundle unrelated facts or re-ask supplied facts. Apply supplied definitions yourself; ask for an observable premise, not a derived legal classification, and do not infer an unstated fact from a colloquial label. A factual reply or correction should advance the active question without repeating unchanged rules or the overview. Keep material conditions at the affected claim and genuinely needed facts in missingFacts. If the user is unsure, offer one concrete optional fact-finding step instead of repeating the question. When a source gap matters, give the supported rule first, name the specific design or application decision that remains unresolved, and explain what must be checked to settle it. Do not merely report unavailable excerpts, imply that the law is silent, or generalize a missing passage into unavailable law. Put the precise legal-evidence boundary in evidenceLimitations/additionalEvidenceNeeded. Library retrieval is Permitext's work: do not ask the user to repeat the question or supply code text that Research must check, and do not promise an unperformed lookup. A practical next step must address the current decision without inventing a legal duty, approval or source requirement. Leave followUpQuestions empty when the current request is answered or no useful decisive question remains. Honor explicit full-checklist requests. Never waive material qualifications; wording, organization or another relevant next question alone is not a substantive verification failure. " +
  "For ordinary enacted-code answers, include a useful practical objective or action independently supported by the supplied sources when it materially helps the current decision, even while a separate rule's applicability remains conditional. Keep that condition attached to the affected rule. Distinguish cited source-established duties from clearly labeled optional recommendations; never invent a routing method, approval, source condition, deadline or universal Yes/No. Quotation-only requests and fully answered threshold questions do not need added advice or unrelated downstream details. Missing merely optional advice is not a substantive verification failure. " +
  "When such an answer explains how a required safety control operates, retain the supplied source's required trigger and resulting action, such as shutdown, alarm or interlock, rather than saying only that it responds. Do not substitute one action for another or add an unsupplied function. Do not force unrelated control checklists into a closed question.";

const compactText = (value) => String(value || "").replace(/\s+/g, " ").trim();

const shortAnswerCue = /\b(?:short|brief(?:ly)?|quick|quickly|one\s+paragraph|single\s+paragraph|concise)\b/i;
const comparisonCue = /\b(?:compare|comparison|difference|different|similar|similarity|versus|vs\.?|same as|equivalent)\b/i;
const requirementsCue = /\b(?:requirements?|designing|design requirements?|minimums?|what (?:do|does) .* require)\b/i;
const numericCue = /\b(?:maximum|minimum|how (?:much|many|wide|long|high)|square\s+feet|sq\.?\s*ft|width|height|distance|slope|rise|clearance|dimension)\b/i;
const definitionCue = /\b(?:what (?:is|are|does)|define|definition|meaning|appendix)\b/i;
const editionCheckCue = /\b(?:is|was|were|does|did) (?:this|that|it|the (?:answer|requirement|section))\b[\s\S]*\b(?:19|20)\d{2}\b|\bfrom (?:the )?(?:19|20)\d{2}(?:\s+edition|\s+code)?\b/i;
const outsideAuthorityCue = /\b(?:Office of Mental Health|OMH|NYCRR|agency|licensing|funding)\b/i;
const closedQuestionCue = /(?:^|[.!?]\s+)(?:does|do|did|is|are|was|were|can|could|may|must|will|would|should|has|have)\b[^?]*\?\s*$/i;
const explanationRequestCue = /^(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+)?(?:please\s+)?(?:explain|describe|summarize|walk\s+me\s+through|tell\s+me)\b/i;
const governingReferenceCue = /^(?:what(?:['’]s| is)|which)\b[\s\S]*\b(?:governing|controlling|applicable)\b[\s\S]*\b(?:section|provision|zr|number|reference)\b/i;
const projectFactReplyCue = /^(?:it(?:['’]s| is)|this(?:['’]s| is)|the (?:building|project|work) (?:is|will be)|we (?:are|will be))\b/i;

export function researchContextualSectionFollowupInstruction({ question, messages = [] } = {}) {
  const text = compactText(question);
  if (!Array.isArray(messages) || !messages.some(message => message?.role === "assistant") || text.length > 180) return "";
  if (/\b(?:all|every|entire|whole|full|complete|detail(?:ed)?|comprehensive|requirements?|requires?|design|compliance|calculate|line[- ]by[- ]line|paragraph[- ]by[- ]paragraph)\b/i.test(text)) return "";
  if (!/^(?:(?:then|and|so|okay|ok)[,\s]+)?(?:please\s+)?(?:explain|what\s+about|how\s+about)\b/i.test(text) ||
      !/\b\d{1,3}(?:[-.]\d+)+(?:\([a-z0-9]+\))*/i.test(text)) return "";
  return "CONTEXTUAL SECTION FOLLOW-UP: Interpret this short section-reference request in the active conversation. Identify the supplied section's purpose and explain its relationship to the current question. If it addresses another topic, explain that distinction without expanding into an unrelated design or compliance checklist. Discuss operative details only when they establish that relationship or qualify a claim you actually make. Omitting unrelated subsection details is not a material omission for this contextual answer. Preserve exact citations, edition and scope; never infer historical text, a renumbering, a drawing note or project applicability from a section number or prior assistant claim. A specific request for the whole section or all requirements takes precedence over this narrow scope.";
}

function normalizedStartingPoint(source) {
  try {
    const url = new URL(String(source?.sourceURL || "").trim());
    if (url.protocol !== "https:") return null;
    url.hash = "";
    const label = compactText(source?.sourceName || source?.label)
      .replace(/[\[\]]/g, "");
    if (!label) return null;
    return { label, url: url.toString() };
  } catch {
    return null;
  }
}

export function applyResearchOutsideAuthorityStartingPoints(
  answer,
  outsideCurrentLibrary = [],
  { sourcePolicy, question } = {}
) {
  if (!answer || typeof answer !== "object") return answer;
  // A verified document summary is immutable. Discovery links belong in
  // retrieval, not in prose appended after its source verification.
  if (hasVerifiedResearchOfficialGuidanceSummary(question, answer)) return answer;
  // Discovery suggestions are not a request for another authority. Apply the
  // same boundary used for retrieval, including after a verifier-directed
  // revision, so presentation cannot reinsert rejected outside-library text.
  if (sourcePolicy?.useWeb !== true) return answer;
  const requestedURLs = new Set(researchRequestedOutsideAuthorityURLs(question));
  const answerText = String(answer.answerText || "").trim();
  const existingURLs = new Set([
    ...Array.from(answerText.matchAll(/https:\/\/[^\s)\]]+/g), (match) => match[0]),
    ...(Array.isArray(answer.supportingSources) ? answer.supportingSources : [])
      .map((source) => String(source?.url || "").trim())
      .filter(Boolean)
  ]);
  const entries = [];
  const seenURLs = new Set();
  for (const source of Array.isArray(outsideCurrentLibrary) ? outsideCurrentLibrary : []) {
    const entry = normalizedStartingPoint(source);
    if (!entry || !requestedURLs.has(entry.url) || existingURLs.has(entry.url) || seenURLs.has(entry.url)) continue;
    seenURLs.add(entry.url);
    entries.push(entry);
  }
  if (!entries.length) return answer;
  const links = entries.map(({ label, url }) => `[${label}](${url})`).join("; ");
  const startingPointParagraph =
    `Official starting ${entries.length === 1 ? "point" : "points"}: ${links}. ` +
    `${entries.length === 1 ? "This page identifies" : "These pages identify"} the requested ` +
    `${entries.length === 1 ? "authority" : "authorities"}; Permitext has not treated ` +
    `${entries.length === 1 ? "it" : "them"} as proof of a program-specific requirement.`;
  const startingPointLimitation =
    "An official starting-point link identifies the requested authority but is not a source-bound substantive rule. The link alone does not establish any requirement.";
  const evidenceLimitations = Array.isArray(answer.evidenceLimitations)
    ? [...answer.evidenceLimitations]
    : [];
  if (!evidenceLimitations.some((value) => /official starting-point link/i.test(String(value)))) {
    evidenceLimitations.push(startingPointLimitation);
  }
  return {
    ...answer,
    answerText: [answerText, startingPointParagraph].filter(Boolean).join("\n\n"),
    evidenceLimitations
  };
}

function evidenceCount(evidence) {
  return new Set((Array.isArray(evidence) ? evidence : [])
    .map((source) => String(source?.sectionID || source?.id || "").trim())
    .filter(Boolean)).size;
}

export function researchRequestedAreaConversions({ question, evidence = [] } = {}) {
  if (!/\b(?:sq\.?\s*ft|square\s+feet|square\s+foot)\b/i.test(compactText(question))) return [];
  const conversions = [];
  const seen = new Set();
  for (const source of Array.isArray(evidence) ? evidence : []) {
    const text = compactText(source?.text || source?.plainText);
    for (const match of text.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:square\s+inches|sq\.?\s*in\.?)(?!\w)/gi)) {
      const squareInches = Number(match[1]);
      if (!Number.isFinite(squareInches)) continue;
      const key = String(squareInches);
      if (seen.has(key)) continue;
      seen.add(key);
      conversions.push(Object.freeze({
        squareInches,
        squareFeet: squareInches / 144,
        sourceIDs: Object.freeze([String(source?.sourceID || "").trim()].filter(Boolean))
      }));
    }
  }
  return conversions;
}

function contractFor(mode, preferredStructure, requiredElements, { zoningPlan } = {}) {
  return Object.freeze({
    version: researchAnswerPresentationVersion,
    mode,
    preferredStructure,
    directAnswerFirst: true,
    answerSequence: Object.freeze([
      "Direct answer",
      "Governing rule with citation",
      "Application or calculation",
      "Material exceptions or missing facts"
    ]),
    requiredElements: Object.freeze(requiredElements),
    universalRules: Object.freeze([
      "Lead with the supported result, a conditional result, or the specific reason the result cannot yet be determined.",
      "Follow with the governing rule and adjacent citation, apply it to the supplied facts or show the calculation, then state only material exceptions or missing facts.",
      "Keep any condition that changes a Yes or No in the opening answer; do not defer it to a closing disclaimer.",
      "The answer sequence is a reasoning order, not four mandatory headings; omit steps that do not apply.",
      "Never fill gaps in the question from an expected answer, an example scenario, or an unstated assumption.",
      "Place each material code citation next to the claim it supports.",
      "Separate governing enacted requirements from outside guidance or unsupplied standards.",
      "Keep material conditions and unresolved facts in answerText, attached to the correct object; expandable details alone are insufficient.",
      zoningPlan ? researchZoningExplanationScopeInstruction : researchClaimScopeInstruction,
      "Establish each alternative rule's applicability independently; an unresolved condition does not establish another path. Preserve the stated subject, such as a building or nonaccessory tenant space, without generalizing to any room.",
      "Keep the opening, calculation and closing consistent. State a failed applicable limit directly; a scope note must not imply compliance. Broader compliance remains unevaluated.",
      "Use stipulated quantities and applicability unless contradicted; verify them when asked. Include secondary rules only when material to the result, retaining conditions for the proposed substitution.",
      researchDecisionFactInstruction,
      researchGuidedNextStepInstruction,
      "Use headings, tables, lists, calculations and follow-ups only when useful. State each material point once; avoid repeating prose in a table or checklist or restating the conclusion."
    ])
  });
}

export function researchAnswerPresentationContract({ question, evidence = [], messages = [], zoningPlan } = {}) {
  const text = compactText(question);
  const sourceCount = evidenceCount(evidence);
  const requestedAreaConversions = researchRequestedAreaConversions({ question: text, evidence });
  const presentation = (mode, structure, elements) => contractFor(mode, structure, elements, { zoningPlan });
  const continuingConversation = Array.isArray(messages) && messages.some((message) => message?.role === "assistant");

  if (shortAnswerCue.test(text)) {
    return presentation("compact-paragraph", "one compact paragraph", [
      "Answer the requested point in the first sentence.",
      "Use a second paragraph only when a material qualification cannot safely fit in the first."
    ]);
  }

  if (editionCheckCue.test(text)) {
    return presentation("edition-check", "direct confirmation or correction", [
      "Begin with Yes, No, or a direct correction.",
      "Name the exact edition and correct any earlier overgeneralization before adding detail.",
      "Cite only sections from the confirmed edition."
    ]);
  }

  if (comparisonCue.test(text)) {
    return presentation("comparison-table", "short conclusion, compact Markdown table, practical distinction", [
      "State the controlling relationship before the table.",
      "Use a table only for shared features that can be compared on the supplied evidence.",
      "End with the practical design or applicability distinction, without repeating the table."
    ]);
  }

  const sectionFollowup = researchContextualSectionFollowupInstruction({ question: text, messages });
  if (sectionFollowup) {
    return presentation("section-followup", "section purpose and its relationship to the active question", [
      sectionFollowup,
      "Answer in a concise explanation; do not turn a different section's full contents into a new project-compliance investigation."
    ]);
  }

  if (continuingConversation && governingReferenceCue.test(text)) {
    return presentation("governing-reference", "cited provision and its role", [
      "Name the supplied provision that establishes the rule being discussed and distinguish it from any separate applicability provision.",
      "If the project's governing path is still unresolved, state that specific distinction briefly; do not restart the full overview or intake.",
      "Do not claim that a provision governs this site merely because it was discussed earlier."
    ]);
  }

  if (continuingConversation && projectFactReplyCue.test(text) && !text.includes("?") && !requirementsCue.test(text)) {
    return presentation("conversation-update", "new fact, resulting application, remaining material uncertainty", [
      "Treat the supplied project fact as a premise for this discussion and use it to advance the active question.",
      "State what the fact resolves and what the enacted evidence now supports; do not repeat the earlier rule catalogue when it has not changed.",
      "Apply the supplied applicability definitions before requesting another fact. Ask for an observable missing premise only when it is needed for the next conclusion.",
      "Preserve the conditions and citations of every new legal claim; a previous assistant conclusion is not authoritative evidence."
    ]);
  }

  if (outsideAuthorityCue.test(text) && requirementsCue.test(text)) {
    return presentation("external-authority-boundary", "conditional answer with separated authorities", [
      "Identify which requested authority is established by enacted evidence or attributable official supporting material and which is still unresolved.",
      "When attributable official supporting claims are supplied, summarize those exact claims and label their authority separately from the enacted Permitext code.",
      "Do not invent ratios, dimensions, or program rules from an unsupplied agency or standard.",
      "Give responsive established requirements first, then request only the program type, controlling source, or project fact that remains missing."
    ]);
  }

  // "Can you explain ...?" requests an explanation, not a Yes/No decision.
  if (requirementsCue.test(text) && explanationRequestCue.test(text)) {
    return presentation("requirements-checklist", "short answer followed by compact rule bullets", [
      "Open with the supported baseline and only the applicability uncertainty material to this project.",
      "Group the responsive rules into roughly three to five compact bullets when useful; preserve each rule's material conditions and adjacent citation rather than forcing a fixed count.",
      "Discuss only applicable or genuinely unresolved candidate paths, not every retrieved provision. A table is optional when it makes an actual comparison clearer.",
      "End with one useful observable project question only if needed; do not repeat the opening or the rule list."
    ]);
  }

  if (closedQuestionCue.test(text)) {
    return presentation("direct-answer", "one or two concise paragraphs", [
      "Resolve the stated proposal with Yes, No, or the material condition in the first sentence.",
      "Follow with the cited rule and its application, including arithmetic when useful.",
      "Mentioning a requirement or retrieving many sources does not make a yes/no question a request for a requirements table.",
      "Include only qualifications that can change or explain this result.",
      "For this narrow decision, omit unrequested design alternatives and method inventories unless they are needed to explain the result. If an alternative is discussed, preserve its material conditions; do not present abbreviated options as complete compliant designs."
    ]);
  }

  if (requirementsCue.test(text) && sourceCount >= 4) {
    return presentation("requirements-table", "direct scope statement, Item/Requirement/Authority table, practical calculation", [
      "Summarize the usable baseline rules before requesting project facts.",
      "Use one row per parallel dimensional or configuration requirement.",
      "Include a short calculation or design implication only when the evidence and stated facts support it."
    ]);
  }

  if (numericCue.test(text)) {
    return presentation("numeric-rule", "number first, scope, exceptions", [
      "Lead with the supported number or explain immediately why one number cannot be selected.",
      "State the condition to which the number applies.",
      "Identify any materially different exception or alternate category supplied by the evidence.",
      ...requestedAreaConversions.map(({ squareInches, squareFeet }) =>
        `Because the user asked for square feet, convert the supplied ${squareInches} square inches to ${squareFeet.toFixed(3)} square feet and label that arithmetic as a derived conversion.`
      )
    ]);
  }

  if (requirementsCue.test(text)) {
    return presentation("requirements-checklist", "direct answer with compact checklist", [
      "Use a checklist only for genuinely parallel requirements.",
      "Keep each item complete enough to preserve its condition and citation."
    ]);
  }

  if (definitionCue.test(text)) {
    return presentation("definition-status", "definition, current status, practical consequence", [
      "Define the term or provision directly.",
      "When an edition is material, distinguish its historical and current status.",
      "Ask for context only if it changes which provision controls."
    ]);
  }

  return presentation("direct-answer", "plain-language paragraphs", [
    "Resolve the question in the first sentence.",
    "Add only the rule, application, and qualifications needed to support that result."
  ]);
}
