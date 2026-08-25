export const researchModelRoutingVersion = "20260824-luna-terra-hybrid-v1";

function normalized(value) {
  return String(value || "").trim();
}

export function researchModelRoutingConfiguration(environment = process.env) {
  const accurateModel = normalized(
    environment.PERMITEXT_RESEARCH_ACCURATE_MODEL ||
    environment.PERMITEXT_RESEARCH_MODEL ||
    "gpt-5.6-terra"
  );
  const fastModel = normalized(environment.PERMITEXT_RESEARCH_FAST_MODEL || "gpt-5.6-luna");
  const mode = normalized(environment.PERMITEXT_RESEARCH_ROUTING_MODE || "single").toLowerCase();
  const hybrid = mode === "hybrid" && Boolean(fastModel) && fastModel !== accurateModel;
  return {
    mode: hybrid ? "hybrid" : "single",
    fastModel: hybrid ? fastModel : accurateModel,
    accurateModel,
    evidenceAnalysisModel: hybrid ? fastModel : accurateModel,
    webSupportModel: hybrid ? fastModel : accurateModel,
    verificationModel: accurateModel,
    version: researchModelRoutingVersion
  };
}

const complexQuestionPattern = new RegExp([
  "\\b(?:calculate|calculation|formula|interpolate|percentage|ratio)\\b",
  "\\b(?:table|footnote|exception|exceptions|unless|provided that)\\b",
  "\\b(?:mixed occupancy|multiple occupanc|change of (?:use|occupancy))\\b",
  "\\b(?:existing building|alteration|accessibility|accessible route)\\b",
  "\\b(?:special district|zoning map|variance|waiver|appeal)\\b",
  "\\b(?:conflict|contradict|which code|effective date|grandfather)\\b"
].join("|"), "i");

const explicitEnactedCitationPattern = /\b(?:BC|Building\s+Code)\s*(?:(?:§|Section)\s*)?\d{3,4}(?:\.\d+)+\b/i;
const boundedLookupIntentPattern = /^\s*(?:what\s+(?:does|is)|summarize|quote|list|identify|according\s+to|under)\b/i;

export function researchQuestionIsBoundedCitationLookup(question) {
  const value = normalized(question);
  return explicitEnactedCitationPattern.test(value) &&
    boundedLookupIntentPattern.test(value) &&
    !complexQuestionPattern.test(value) &&
    !/\b(?:apply|applicable|allowed|complies?|determine|required\s+for|may\s+(?:we|i|the))\b/i.test(value);
}

function evidenceNeedsAccurateModel(source) {
  if (!source || typeof source !== "object") return false;
  if ((source.visualSources || []).length) return true;
  if (source.evidencePriority?.topicRouteRelationship === "collateral") return true;
  if (["historical", "future-effective"].includes(source.applicabilityStatus)) return true;
  const text = `${source.title || ""}\n${source.text || ""}`;
  return /\b(?:table|figure|exception|exceptions)\b/i.test(text);
}

export function routeResearchAnswerModel({
  question,
  evidence = [],
  requiredClaims = [],
  codeBasis = null,
  webSupportRequested = false,
  environment = process.env
} = {}) {
  const configuration = researchModelRoutingConfiguration(environment);
  if (configuration.mode !== "hybrid") {
    return {
      model: configuration.accurateModel,
      tier: "accurate",
      reasons: ["single_model_configuration"],
      configuration
    };
  }

  const reasons = [];
  const boundedCitationLookup = researchQuestionIsBoundedCitationLookup(question);
  if (complexQuestionPattern.test(normalized(question))) reasons.push("complex_question_language");
  if (webSupportRequested && !boundedCitationLookup) reasons.push("outside_library_support");
  if (evidence.length > 10 && !boundedCitationLookup) reasons.push("large_evidence_package");
  if (requiredClaims.length > 4 && !boundedCitationLookup) reasons.push("multiple_required_claims");
  if (evidence.some(evidenceNeedsAccurateModel) && !boundedCitationLookup) reasons.push("complex_evidence_form");
  if ((codeBasis?.searchedCorpora || []).length > 1 && !boundedCitationLookup) reasons.push("multiple_corpora");
  if (boundedCitationLookup && evidence.some((source) =>
    (source.visualSources || []).length || ["historical", "future-effective"].includes(source.applicabilityStatus)
  )) reasons.push("high_risk_citation_evidence");
  if ([...(codeBasis?.searchedCorpora || []), ...(codeBasis?.pinnedCorpora || [])]
    .some((corpus) => /zoning/i.test(`${corpus?.id || ""} ${corpus?.label || ""}`))) {
    reasons.push("zoning");
  }

  return reasons.length
    ? {
        model: configuration.accurateModel,
        tier: "accurate",
        reasons: Array.from(new Set(reasons)),
        configuration
      }
    : {
        model: configuration.fastModel,
        tier: "fast",
        reasons: [boundedCitationLookup ? "bounded_enacted_citation_lookup" : "bounded_straightforward_question"],
        configuration
      };
}

export function researchEscalationModel(route, environment = process.env) {
  const configuration = route?.configuration || researchModelRoutingConfiguration(environment);
  return configuration.accurateModel;
}
