// Resolve explicit numbered ZR references to supplied passages. This binding
// step preserves prose and never substitutes for semantic verification.
import { extractResearchCodeReferences } from "./research-conversation-topic.mjs";

export const zoningAttributionBindingVersion = "20260930-verified-reference-binding-v2";
const sectionNumber = String.raw`\d{1,3}-\d{2,3}(?![\w-])`;
const subsection = String.raw`(?:\s*\([a-z0-9]+\))*`;
const marker = String.raw`(?:§{1,2}\s*|sections?\s+)?`;
const reference = `${sectionNumber}${subsection}`;
const followingReference = String.raw`(?:\s*,\s*(?:(?:and|or)\s+)?|\s+(?:and|or)\s+)(?:ZR\s*)?${marker}${reference}`;
const predicate = String.raw`(?:require[sd]?|provide[sd]?|classif(?:y|ies)|permit[st]?|allow[sd]?|prohibit[st]?|establish(?:es)?|define[sd]?|exclude[sd]?|include[sd]?|authorize[sd]?|limit[st]?|appl(?:y|ies)|state[sd]?|specif(?:y|ies)|sets?|impose[sd]?|incorporate[sd]?|lists?|governs?|makes?|contains?|treats?)`;
const subjectPattern = new RegExp(String.raw`\bZR\s*${marker}(${reference}(?:${followingReference})*)\s+(?:(?:also|itself|expressly|specifically|jointly)\s+)?(?:(?:does?|did)\s+not\s+)?${predicate}\b`, "gi");

function normalized(value) {
  return String(value || "").replace(/[*_`]/g, "").replace(/[‐‑‒–−]/g, "-");
}

export const zoningAttributionPrompt = "Each supported point must include the supplied source IDs for every provision it explicitly credits with a rule. Split mixed-source points when needed. A citation elsewhere in the answer does not bind that point; an incorporated cross-reference alone does not establish the referenced rule.";

export function zoningExplicitAttributionIssues({ answer = {}, passages = [] } = {}) {
  const available = new Map();
  for (const passage of Array.isArray(passages) ? passages : []) {
    if (String(passage?.codePrefix || "").toUpperCase() !== "ZR" || !passage?.sourceID) continue;
    const number = normalized(passage.sectionNumber).trim();
    // Only exact numbered sections; do not equate a parent, a neighboring
    // provision, another corpus, or an absent source with the named provision.
    if (!new RegExp(`^${sectionNumber}$`).test(number)) continue;
    if (!available.has(number)) available.set(number, new Set());
    available.get(number).add(String(passage.sourceID));
  }
  const issues = [];
  for (const [pointIndex, point] of (Array.isArray(answer?.supportedPoints) ? answer.supportedPoints : []).entries()) {
    const bound = new Set((Array.isArray(point?.sourceIDs) ? point.sourceIDs : []).map(String));
    const subjects = new Set();
    // Keep fields separate so a heading cannot accidentally become the subject
    // of a sentence in its explanation.
    for (const field of [point?.heading, point?.explanation]) {
      for (const match of normalized(field).matchAll(subjectPattern)) {
        for (const number of match[1].matchAll(new RegExp(sectionNumber, "g"))) subjects.add(number[0]);
      }
    }
    for (const number of subjects) {
      const sourceIDs = [...(available.get(number) || [])];
      // Completeness, exact-edition selection and substantive entailment remain
      // responsibilities of the evidence and semantic verification checks.
      if (!sourceIDs.length || sourceIDs.some((id) => bound.has(id))) continue;
      issues.push({
        code: "EXPLICIT_ZONING_RULE_SOURCE_NOT_BOUND",
        pointIndex,
        sectionNumber: number,
        sourceIDs,
        detail: `Supported point ${pointIndex + 1} attributes a rule to ZR ${number} without binding any supplied source for that provision. Bind the point to the actual supporting provision or split its claims; a top-level citation alone does not fix this.`
      });
    }
  }
  return issues;
}

// Reconcile a declared source reference, never infer which law supports a
// claim. Resolve only a unique supplied provision; reject conflicting existing
// citation metadata. Keep every existing binding and all prose; substantive support is
// still decided by the mandatory verifier on the resulting answer.
export function bindExplicitZoningRuleSources({ answer, evidence = [], plan } = {}) {
  const unchanged = { answer, repairs: [] };
  if (!plan || plan.callPolicy?.subjectiveVerification !== true ||
      !answer?.supportedPoints?.length) return unchanged;
  const issues = zoningExplicitAttributionIssues({ answer, passages: evidence });
  // Citation binding is bookkeeping, not legal reasoning. Preserve an explicit
  // reference even when its grammar is "under", "for", or "according to".
  for (const [pointIndex, point] of answer.supportedPoints.entries()) {
    for (const reference of extractResearchCodeReferences(`${point.heading || ""} ${point.explanation || ""}`)) {
      if (reference.codePrefix && reference.codePrefix !== "ZR") continue;
      const matches = evidence.filter(source => source.codePrefix === "ZR" && source.sectionNumber === reference.sectionNumber);
      if (matches.length !== 1 || point.sourceIDs?.includes(matches[0].sourceID) ||
          issues.some(issue => issue.pointIndex === pointIndex && issue.sectionNumber === reference.sectionNumber)) continue;
      issues.push({ pointIndex, sectionNumber: reference.sectionNumber, sourceIDs: [matches[0].sourceID] });
    }
  }
  const repairs = [];
  let repaired = answer;
  for (const issue of issues) {
    if (issue.sourceIDs.length !== 1 || !Array.isArray(answer.supportedPoints[issue.pointIndex].sourceIDs)) continue;
    const [sourceID] = issue.sourceIDs;
    const sources = evidence.filter((source) => source.sourceID === sourceID);
    // Duplicated identities, multiple editions/passages, absent text and
    // conflicting citation metadata cannot be repaired by guessing.
    if (sources.length !== 1) continue;
    const source = sources[0];
    if (!source.sectionID || !String(source.text || "").trim()) continue;
    const citations = (answer.citations || []).filter((citation) => citation.sourceIDs?.includes(sourceID));
    const consistent = (citation) => String(citation.sectionID || "") === String(source.sectionID) &&
      ["corpusID", "codeVersion", "codeEdition"].every((field) => !citation[field] || citation[field] === source[field]);
    if (!citations.every(consistent)) continue;
    if (repaired === answer) repaired = structuredClone(answer);
    if (!citations.length) repaired.citations.push({ sectionID: source.sectionID, sourceIDs: [sourceID],
      relevance: `Explicit reference to ZR ${source.sectionNumber} in the supported point.` });
    const point = repaired.supportedPoints[issue.pointIndex];
    const previousSourceIDs = [...point.sourceIDs];
    point.sourceIDs.push(sourceID);
    repairs.push({ pointIndex: issue.pointIndex, sectionNumber: issue.sectionNumber, sourceID, previousSourceIDs });
  }
  return { answer: repaired, repairs };
}
