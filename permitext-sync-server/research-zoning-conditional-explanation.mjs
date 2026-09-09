import { createHash } from "node:crypto";

export const zoningConditionalExplanationVersion = "20260909-conditional-source-explanation-v2";
// Withholding a permitted FAR is an unresolved determination, not a finding
// that the property is prohibited. Keep this separate from positive approval
// predicates so the safety check can still inspect any appended claim.
export const unresolvedZoningFARSelectionPattern = /\bno\s+(?:(?:maximum|minimum|permitted|allowable|residential|commercial|community[- ]facility)\s+)*(?:FAR|floor[- ]area ratio)\s+(?:can|may)\s+(?:yet\s+)?be\s+(?:selected|determined|established|confirmed|identified)\b/i;
const disposition = "conditional_source_explanation";
const factPatterns = Object.freeze({
  property_identifier: /\b(?:address|BBL|block\s*(?:and|\/)\s*lot|property identifier|parcel identifier)\b/i,
  official_mapped_status: /\b(?:official map|mapped (?:zoning )?district|verified mapped|controlling map)\b/i,
  historical_lot_condition: /\b(?:historical|historic|history|1961)\b/i
});
const compact = (value) => String(value || "").replace(/\s+/g, " ").trim();

export function isZoningConditionalExplanation(plan) {
  return plan?.disposition === disposition &&
    plan?.conditionalExplanation?.version === zoningConditionalExplanationVersion &&
    plan.conditionalExplanation.determinationStatus === "unresolved";
}

// A missing project fact may prevent a determination without preventing a
// cited explanation. Missing governing/archived text is not eligible. Keep the
// prerequisite plan immutable and preserve its identity in the response plan.
export function planZoningConditionalExplanation({ plan, evidence = [], evidenceReadiness, evidenceSelection } = {}) {
  if (!plan || !["deterministic_boundary", "clarification_required"].includes(plan.disposition) ||
      !["property_map_applicability", "effective_date_history"].includes(plan.path) ||
      !plan.missingFacts?.length || plan.missingFacts.some((fact) => !Object.hasOwn(factPatterns, fact.id)) ||
      evidenceReadiness?.pass !== true || evidenceSelection?.pass !== true ||
      !evidence.some((source) => source.codePrefix === "ZR" && source.sourceID && compact(source.text))) return plan;
  const { planHash, ...original } = structuredClone(plan);
  const responsePlan = {
    ...original,
    disposition,
    conditionalExplanation: {
      version: zoningConditionalExplanationVersion,
      determinationStatus: "unresolved",
      prerequisitePlanHash: planHash,
      prerequisiteDisposition: plan.disposition,
      prerequisiteMaximumProviderCalls: plan.callPolicy.maximumProviderCalls,
      scope: "Explain only the supplied enacted rules and their conditions; withhold the unresolved property determination."
    },
    callPolicy: {
      ...plan.callPolicy,
      subjectiveVerification: true,
      verifierTier: "fast",
      maximumProviderCalls: 2,
      repairEligible: false,
      repairTier: null,
      maximumRepairAttempts: 0,
      repairMode: null,
      allowFullAnswerRewrite: false,
      terraEscalation: "none_for_conditional_explanation"
    }
  };
  return { ...responsePlan, planHash: createHash("sha256").update(JSON.stringify(responsePlan)).digest("hex") };
}

export function zoningConditionalExplanationPrompt(plan) {
  if (!isZoningConditionalExplanation(plan)) return "";
  return [
    "ANSWER_SCOPE: conditional_source_explanation; PROPERTY_DETERMINATION: unresolved.",
    `MISSING_PROJECT_FACTS: ${JSON.stringify(plan.missingFacts)}`,
    "Lead with a clear statement that the requested determination cannot yet be made from the supplied facts.",
    "Then explain the relevant supplied rule with exact citations, apply only established facts, and identify the material unresolved conditions in missingFacts.",
    "Do not answer with a prerequisite checklist alone. Do not assign a district, map area, historical lot condition, approval, prohibition, permitted FAR or compliance result to the property.",
    "Conditional rule explanations do not establish that the property satisfies their antecedents. Source excerpts may omit detail: explain only what the supplied passages establish and preserve their limits.",
    "Verification must reject a property determination, invented premise, unsupported branch, missing material condition, or generic boundary with no substantive cited explanation."
  ].join("\n");
}

export function zoningConditionalExplanationIssues({ plan, answer = {} } = {}) {
  if (!isZoningConditionalExplanation(plan)) return [];
  const issues = [];
  const lead = compact(answer.answerText).split(/(?<=[.!?])\s/)[0];
  const boundary = /\b(?:cannot|can't)\b[^.!?]{0,180}\b(?:determin|confirm|conclud|establish|decid|approv|find|say)|\b(?:not (?:yet )?(?:established|determined|confirmed)|undetermined|unresolved|insufficient (?:facts|information)|not enough (?:facts|information))\b/i;
  const statesBoundary = (text) => boundary.test(text) || unresolvedZoningFARSelectionPattern.test(text);
  if (!statesBoundary(lead) || (answer.conclusion && !statesBoundary(compact(answer.conclusion)))) {
    issues.push({ code: "CONDITIONAL_DETERMINATION_BOUNDARY_MISSING", detail: "Lead with the unresolved determination, not an approval or prohibition. Keep any conclusion conditional too." });
  }
  const missing = (answer.missingFacts || []).join(" ");
  for (const fact of plan.missingFacts) {
    if (!factPatterns[fact.id]?.test(missing)) issues.push({
      code: "CONDITIONAL_PROJECT_FACT_OMITTED", factID: fact.id,
      detail: `Keep the unresolved ${fact.label} in missingFacts.`
    });
  }
  if (!answer.supportedPoints?.some((point) => compact(point.explanation) && point.sourceIDs?.length) ||
      !answer.citations?.some((citation) => citation.sourceIDs?.length)) {
    issues.push({ code: "CONDITIONAL_RULE_EXPLANATION_MISSING", detail: "A conditional explanation must contain substantive source-bound analysis and citations; a generic boundary is insufficient." });
  }
  return issues;
}
