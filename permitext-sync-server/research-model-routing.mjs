import { extractResearchCodeReferences } from "./research-conversation-topic.mjs";

export const researchModelRoutingVersion = "20260827-luna-terra-hybrid-v3";

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
    // In hybrid mode, Luna performs the bounded critique and objective server
    // checks remain authoritative. Terra writes or repairs complex answers.
    // This avoids paying Terra once to answer and again merely to restate the
    // same evidence during verification.
    verificationModel: hybrid ? fastModel : accurateModel,
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

const explicitEnactedCitationPattern = /\b(?:BC|Building\s+Code)\s*(?:(?:§|Section)\s*)?(\d{3,4}(?:\.\d+)+)\b/i;
const boundedCitationText = String.raw`(?:BC|Building\s+Code)\s*(?:(?:§|Section)\s*)?\d{3,4}(?:\.\d+)+`;
const boundedCitationLead = String.raw`(?:(?:the\s+)?(?:current\s+)?(?:2022\s+)?(?:(?:NYC|New\s+York\s+City)\s+)?)?`;
const boundedLookupGrammar = new RegExp([
  String.raw`^what\s+does\s+${boundedCitationLead}${boundedCitationText}\s+(?:say|state|provide|read|require)(?:\s+about\s+(?:its\s+)?(?:text|language|title|scope|purpose|citation))?[?.]?$`,
  String.raw`^what\s+is\s+(?:the\s+)?(?:text|language|title|scope)\s+(?:of|in|under)\s+${boundedCitationLead}${boundedCitationText}[?.]?$`,
  String.raw`^(?:quote|summarize)\s+${boundedCitationLead}${boundedCitationText}(?:\s+(?:text|language|title|scope))?[?.]?$`,
  String.raw`^according\s+to\s+${boundedCitationLead}${boundedCitationText},?\s+what\s+does\s+(?:it|the\s+section)\s+(?:say|state|provide|require)[?.]?$`
].join("|"), "i");

export function researchBoundedCitationRequest(question) {
  const value = normalized(question);
  const match = value.match(explicitEnactedCitationPattern);
  if (!match) return null;
  const references = extractResearchCodeReferences(value)
    .filter((reference) => reference.referenceKind === "section");
  if (
    references.length !== 1 ||
    references[0].sectionNumber !== match[1] ||
    (references[0].codePrefix && references[0].codePrefix !== "BC")
  ) return null;
  return {
    codePrefix: "BC",
    sectionNumber: match[1]
  };
}

export function researchQuestionIsBoundedCitationLookup(question) {
  const value = normalized(question);
  return Boolean(researchBoundedCitationRequest(value)) &&
    boundedLookupGrammar.test(value) &&
    !complexQuestionPattern.test(value);
}

export function researchEvidenceForBoundedCitationLookup(question, evidence = []) {
  if (!researchQuestionIsBoundedCitationLookup(question)) return evidence;
  const request = researchBoundedCitationRequest(question);
  if (!request) return evidence;
  return evidence.filter((source) =>
    normalized(source?.codePrefix).toUpperCase() === request.codePrefix &&
    normalized(source?.sectionNumber).replace(/^BC\s*/i, "") === request.sectionNumber
  );
}

export function researchEvidenceSupportsBoundedCitationFastPath(evidence = []) {
  return evidence.length > 0 && evidence.every((source) =>
    normalized(source?.origin) === "permitext_discovered" &&
    normalized(source?.sourceType) === "enacted_text" &&
    normalized(source?.authorityClass) === "enacted" &&
    normalized(source?.applicabilityStatus) === "current-enacted-edition" &&
    normalized(source?.evidencePriority?.evidenceRole) === "governing" &&
    normalized(source?.evidencePriority?.topicRouteRelationship) !== "collateral" &&
    source?.canonicalContextResolved === true &&
    source?.canonicalContextComplete === true &&
    source?.truncated !== true &&
    !(source?.visualSources || []).length
  );
}

function evidenceNeedsAccurateModel(source) {
  if (!source || typeof source !== "object") return false;
  if ((source.visualSources || []).length) return true;
  if (!["", "governing"].includes(normalized(source.evidencePriority?.evidenceRole))) return true;
  if (source.evidencePriority?.topicRouteRelationship === "collateral") return true;
  if (["historical", "future-effective"].includes(source.applicabilityStatus)) return true;
  if (source.canonicalContextResolved === false || source.canonicalContextComplete === false || source.truncated === true) return true;
  const text = `${source.title || ""}\n${source.text || ""}`;
  return /\b(?:table|figure|exception|exceptions)\b/i.test(text);
}

export function routeResearchAnswerModel({
  question,
  evidence = [],
  requiredClaims = [],
  codeBasis = null,
  webSupportRequested = false,
  boundedCitationLookup = null,
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
  const isBoundedCitationLookup = boundedCitationLookup === null
    ? researchQuestionIsBoundedCitationLookup(question)
    : Boolean(boundedCitationLookup);
  if (complexQuestionPattern.test(normalized(question))) reasons.push("complex_question_language");
  if (webSupportRequested && !isBoundedCitationLookup) reasons.push("outside_library_support");
  if (evidence.length > 10 && !isBoundedCitationLookup) reasons.push("large_evidence_package");
  if (requiredClaims.length > 4 && !isBoundedCitationLookup) reasons.push("multiple_required_claims");
  if (evidence.some(evidenceNeedsAccurateModel) && !isBoundedCitationLookup) reasons.push("complex_evidence_form");
  if ((codeBasis?.searchedCorpora || []).length > 1 && !isBoundedCitationLookup) reasons.push("multiple_corpora");
  if (isBoundedCitationLookup && evidence.some((source) =>
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
        reasons: [isBoundedCitationLookup ? "bounded_enacted_citation_lookup" : "bounded_straightforward_question"],
        configuration
      };
}

export function researchEscalationModel(route, environment = process.env) {
  const configuration = route?.configuration || researchModelRoutingConfiguration(environment);
  return configuration.accurateModel;
}
