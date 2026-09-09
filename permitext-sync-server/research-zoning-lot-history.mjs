import { researchProjectFactIsExplicitlyUnresolved, researchProjectFactRequiresValidation } from "./research-project-fact-coverage.mjs";

export const zoningLotHistoryVersion = "20260909-stated-history-premise-v1";
const compact = (value) => String(value || "").replace(/\s+/g, " ").trim();
const list = (value) => Array.isArray(value) ? value : [];
const sentences = (value) => String(value || "").split(/(?<=[.!?])\s+|;\s*/).map(compact).filter(Boolean);
const negativeHistory = /\b(?:(?:were|have been)\s+(?:not\s+historically|historically\s+not)|(?:have\s+)?never\s+(?:been|formed|constituted))\s+(?:one|a\s+single)\s+zoning[- ]lot\b/i;
const positiveHistory = /\b(?:were|have been)\s+(?:historically|formerly)\s+(?:one|a\s+single)\s+zoning[- ]lot\b/i;
const historyTopic = /\bhistor(?:y|ic(?:al(?:ly)?)?)\b|\b1961\b|\blot(?:s)? of record\s+existing\b|\bpast\s+(?:single\s+)?ownership\b/i;
const uncertain = /\b(?:whether|unknown|uncertain|unsure|unclear|unverified|unconfirmed|unresolved|disputed|possibly|probably|apparently|reportedly|may|might|not (?:yet )?(?:sure|known|confirmed|established|verified))\b/i;
const attributed = /\b(?:claims?|believes?|thinks?|reports?|says?|representations?|assertions?|according to)\b|["“”]/i;
const instruction = /^(?:please\b|do not\b|ignore\b|state\b|say\b|answer\b|under\b|ZR\b|Section\b|the\s+(?:rule|definition|text|provision)\b)/i;
const hypothetical = /^(?:what if|if|assume|assuming|suppose|supposing|for (?:this|the) hypothetical)\b/i;

// These are supplied premises, never verified title facts. Recognize only an
// explicit historical zoning-lot exclusion; absence of a recorded merger or
// historical documentation does not establish the same proposition.
export function zoningLotHistoryPremise({ question, projectFacts = [], conversationFactContext = {} } = {}) {
  const entries = [
    { text: question, lane: "question" },
    ...list(projectFacts).map((text) => ({ text, lane: "project_fact" })),
    ...["established", "qualified", "hypothetical", "unknown"].flatMap((lane) =>
      list(conversationFactContext?.[lane]).map((text) => ({ text, lane })))
  ];
  const declarations = [];
  let unresolved = false;
  for (const entry of entries) {
    const text = compact(entry.text);
    const restricted = entry.lane === "unknown" || researchProjectFactIsExplicitlyUnresolved(text) ||
      researchProjectFactRequiresValidation(text) || attributed.test(text) || instruction.test(text);
    for (const statement of sentences(text)) {
      const relevant = historyTopic.test(statement) || negativeHistory.test(statement) || positiveHistory.test(statement);
      if (!relevant) continue;
      if (restricted || uncertain.test(statement) || positiveHistory.test(statement)) {
        unresolved = true;
        continue;
      }
      const conditional = entry.lane === "hypothetical" || hypothetical.test(statement);
      if ((!conditional && /\?|\bif\b/i.test(statement)) || !negativeHistory.test(statement)) continue;
      declarations.push({ statement, conditional });
    }
  }
  const exclusion = !unresolved && declarations.length
    ? declarations.some((item) => item.conditional) ? "hypothetical" : "stated"
    : null;
  return { version: zoningLotHistoryVersion, exclusion,
    groundingStatements: exclusion ? [...new Set(declarations.map((item) => item.statement))] : [] };
}

export function zoningLotHistoryPrompt(premise) {
  if (!premise?.exclusion) return "";
  return [
    premise.exclusion === "hypothetical"
      ? "For the user's hypothetical, apply the assumed absence of a historical zoning lot and keep the result conditional on that assumption."
      : "Apply the user's stated absence of a historical zoning lot as a premise for this question, not as independently verified title history.",
    "Briefly acknowledge that this premise excludes the historical definition branches for the proposed combined tract. Do not reopen that history in missing facts, follow-up questions or evidence requests; do not demand a historical date recital. Preserve the current branches' contiguity and ownership or Declaration conditions."
  ].join(" ");
}

function statesExclusion(statement) {
  return negativeHistory.test(statement) ||
    /\b(?:historical (?:definition )?(?:branches|routes|paths))\b[^.;]{0,120}\b(?:are excluded|are ruled out|do not apply|are inapplicable|are unavailable)\b/i.test(statement) ||
    /\b(?:stated|supplied|given|question|scenario|premise|assumption)\b[^.;]{0,140}\b(?:excludes?|rules? out)\b[^.;]{0,100}\bhistorical\b/i.test(statement);
}

export function zoningLotHistoryApplicationIssues({ premise, answer = {} } = {}) {
  if (!premise) return [];
  const units = ["answerText", "conclusion", "explanation"].map((field) => ({ field, text: answer[field] }));
  list(answer.supportedPoints).forEach((point, index) => {
    units.push({ field: `supportedPoints[${index}]`, text: `${point.heading || ""}. ${point.explanation || ""}` });
  });
  const issues = [];
  const statements = units.flatMap((unit) => sentences(unit.text).map((text) => ({ field: unit.field, text })));
  const exclusions = statements.filter(({ text }) => statesExclusion(text) && !uncertain.test(text));
  if (!premise.exclusion) {
    for (const { field, text } of exclusions) {
      if (hypothetical.test(text) || /\b(?:if|assuming|assumption|hypothetical)\b/i.test(text)) continue;
      issues.push({ code: "HISTORICAL_LOT_EXCLUSION_NOT_SUPPLIED", field,
        detail: "The supplied facts do not exclude a historical zoning lot. Do not invent that premise or replace unknown history with a categorical exclusion." });
    }
    return issues;
  }
  if (!exclusions.length) issues.push({ code: "HISTORICAL_LOT_PREMISE_NOT_APPLIED",
    detail: zoningLotHistoryPrompt(premise) });
  if (premise.exclusion === "hypothetical" && !units.slice(0, 3).some(({ text }) =>
    /\b(?:if|assuming|assumption|hypothetical|on (?:that|the stated) premise|under (?:that|the stated) premise)\b/i.test(text || ""))) {
    issues.push({ code: "HISTORICAL_LOT_HYPOTHESIS_AS_FACT",
      detail: "Keep the historical exclusion and resulting answer conditional on the user's hypothetical; it is not a verified project fact." });
  }
  const reopened = /\b(?:unknown|unresolved|undetermined|not (?:supplied|provided|known|established)|cannot be ruled (?:in|out)|must be (?:verified|confirmed|established))\b/i;
  for (const { field, text } of statements) {
    if (historyTopic.test(text) && reopened.test(text) &&
        !/\b(?:not (?:unknown|unresolved)|no need to|need not|do not (?:reopen|verify|confirm|request))\b/i.test(text)) {
      issues.push({ code: "HISTORICAL_LOT_PREMISE_REOPENED", field, detail: zoningLotHistoryPrompt(premise) });
    }
  }
  for (const field of ["missingFacts", "followUpQuestions", "additionalEvidenceNeeded"]) {
    if (list(answer[field]).some((text) => historyTopic.test(text))) {
      issues.push({ code: "HISTORICAL_LOT_PREMISE_REOPENED", field, detail: zoningLotHistoryPrompt(premise) });
    }
  }
  return issues;
}
