import { createHash } from "node:crypto";
import { isAppendixJSourceBoundaryQuestion } from "./research-zoning-safety.mjs";
import { isZoningConditionalExplanation, zoningConditionalExplanationIssues, zoningConditionalExplanationPrompt } from "./research-zoning-conditional-explanation.mjs";
import { zoningTemporalApplicationObligations, zoningTemporalApplicationIssues } from "./research-zoning-temporal-application.mjs";
import { zoningLotHistoryPremise, zoningLotHistoryPrompt, zoningLotHistoryApplicationIssues } from "./research-zoning-lot-history.mjs";

export const zoningResearchPlannerVersion = "20260909-complete-definition-budget-v6";

export const zoningResearchCompilerVersion = "20260909-stated-history-premise-v27";
export const zoningResearchRepairVersion = "20260909-atomic-metadata-patch-v3";

export const zoningResearchPaths = Object.freeze({
  directRule: "direct_rule",
  definitionCrossReference: "definition_cross_reference",
  structuredTableSymbol: "structured_table_symbol",
  effectiveDateHistory: "effective_date_history",
  propertyMapApplicability: "property_map_applicability",
  calculationScenario: "calculation_scenario"
});

export const zoningResearchDispositions = Object.freeze({
  ready: "ready",
  deterministicBoundary: "deterministic_boundary",
  clarificationRequired: "clarification_required"
});

const pathLimits = Object.freeze({
  [zoningResearchPaths.directRule]: Object.freeze({
    maximumCandidates: 6,
    maximumDiscovered: 4,
    maximumTargetedDefinitions: 1,
    maximumCrossReferences: 2,
    maximumCharacters: 8_000,
    maximumSupplementalCharacters: 6_000,
    maximumCharactersPerSource: 4_000
  }),
  [zoningResearchPaths.definitionCrossReference]: Object.freeze({
    maximumCandidates: 8,
    maximumDiscovered: 3,
    maximumTargetedDefinitions: 2,
    maximumCrossReferences: 4,
    maximumCharacters: 14_000,
    maximumSupplementalCharacters: 12_000,
    maximumCharactersPerSource: 12_000
  }),
  [zoningResearchPaths.structuredTableSymbol]: Object.freeze({
    maximumCandidates: 6,
    maximumDiscovered: 2,
    maximumTargetedDefinitions: 1,
    maximumCrossReferences: 2,
    maximumCharacters: 8_000,
    maximumSupplementalCharacters: 6_000,
    maximumCharactersPerSource: 5_000
  }),
  [zoningResearchPaths.effectiveDateHistory]: Object.freeze({
    maximumCandidates: 8,
    maximumDiscovered: 3,
    maximumTargetedDefinitions: 1,
    maximumCrossReferences: 4,
    maximumCharacters: 12_000,
    maximumSupplementalCharacters: 10_000,
    maximumCharactersPerSource: 6_000
  }),
  [zoningResearchPaths.propertyMapApplicability]: Object.freeze({
    maximumCandidates: 6,
    maximumDiscovered: 2,
    maximumTargetedDefinitions: 1,
    maximumCrossReferences: 2,
    maximumCharacters: 8_000,
    maximumSupplementalCharacters: 6_000,
    maximumCharactersPerSource: 5_000
  }),
  [zoningResearchPaths.calculationScenario]: Object.freeze({
    maximumCandidates: 8,
    maximumDiscovered: 3,
    maximumTargetedDefinitions: 2,
    maximumCrossReferences: 4,
    maximumCharacters: 14_000,
    maximumSupplementalCharacters: 12_000,
    maximumCharactersPerSource: 7_000
  })
});

const pathLabels = Object.freeze({
  [zoningResearchPaths.directRule]: "direct enacted rule",
  [zoningResearchPaths.definitionCrossReference]: "definition and cross-reference",
  [zoningResearchPaths.structuredTableSymbol]: "structured table and symbol",
  [zoningResearchPaths.effectiveDateHistory]: "effective date and history",
  [zoningResearchPaths.propertyMapApplicability]: "property, BBL, and mapped applicability",
  [zoningResearchPaths.calculationScenario]: "calculation and scenario"
});

const propertyIdentifierPattern = /\bBBL\s*[:#-]?\s*[1-5]?\d{9}\b|\bBlock\s+\d{1,10}\s*(?:,|\/|and)\s*Lot\s+\d{1,5}\b|\b\d{1,6}\s+[A-Za-z0-9.'’ -]{1,80}\s+(?:Street|St\.?|Avenue|Ave\.?|Boulevard|Blvd\.?|Road|Rd\.?|Drive|Dr\.?|Lane|Ln\.?|Place|Pl\.?|Court|Ct\.?|Parkway|Pkwy\.?|Highway|Hwy\.?)\b/i;
const concreteMappedStatusPattern = /\b(?:verified|confirmed|established)\b[^.]{0,100}\b(?:R\d{1,2}[A-Z]?|C\d(?:-\d[A-Z]?)?|M\d(?:-\d)?|mapped district|zoning district|special district|subdistrict|transit zone|MIH area)\b|\b(?:within|in)\s+(?:the\s+)?(?:Inner|Outer|Greater)\s+Transit\s+Zone\b/i;
const explicitMissingPattern = /\b(?:unknown|not (?:provided|established|identified|verified|confirmed)|missing|unresolved|broker says|owner says|merely described)\b/i;

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function stableHash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function initialTierForPath(path) {
  return [
    zoningResearchPaths.structuredTableSymbol,
    zoningResearchPaths.effectiveDateHistory,
    zoningResearchPaths.propertyMapApplicability,
    zoningResearchPaths.calculationScenario
  ].includes(path) ? "accurate" : "fast";
}

function subjectiveVerificationForPath(path) {
  return [
    zoningResearchPaths.structuredTableSymbol,
    zoningResearchPaths.effectiveDateHistory,
    zoningResearchPaths.propertyMapApplicability,
    zoningResearchPaths.calculationScenario
  ].includes(path);
}

function combinedFactText({ question, projectFacts = [], conversationFactContext = {} } = {}) {
  return compactText([
    question,
    ...(Array.isArray(projectFacts) ? projectFacts : []),
    ...(Array.isArray(conversationFactContext?.established) ? conversationFactContext.established : []),
    ...(Array.isArray(conversationFactContext?.hypothetical) ? conversationFactContext.hypothetical : []),
    ...(Array.isArray(conversationFactContext?.qualified) ? conversationFactContext.qualified : []),
    ...(Array.isArray(conversationFactContext?.unknown) ? conversationFactContext.unknown : [])
  ].filter(Boolean).join(" "));
}

function resolvedFactText({ question, projectFacts = [], conversationFactContext = {} } = {}) {
  return compactText([
    question,
    ...(Array.isArray(projectFacts) ? projectFacts : []),
    ...(Array.isArray(conversationFactContext?.established) ? conversationFactContext.established : []),
    ...(Array.isArray(conversationFactContext?.hypothetical) ? conversationFactContext.hypothetical : [])
  ]
    .flatMap((value) => String(value || "").split(/(?<=[.!?])\s+/))
    .filter((statement) => !explicitMissingPattern.test(statement))
    .join(" "));
}

const historicalCalendarDate = String.raw`(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(?:\d{1,2}(?:st|nd|rd|th)?(?:,)?\s+)?(?:18|19|20)\d{2}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(?:18|19|20)\d{2}|(?:18|19|20)\d{2}(?:-\d{1,2}-\d{1,2})?|\d{1,2}/\d{1,2}/(?:18|19|20)?\d{2})`;
const historicalTemporalClause = new RegExp(String.raw`\b(?:on|in|during|as[- ]of|before|after|by|from)\s+(?:the\s+)?${historicalCalendarDate}\b`, "i");
const historicalRuleVerbDate = new RegExp(String.raw`^(?:require|allow|permit|prohibit|provide|say|read)\s+(?:on|in|as[- ]of|before|after)\s+${historicalCalendarDate}\b`, "i");
const historicalRuleVersion = /\b(?:18|19|20)\d{2}\s+(?:version|edition|Zoning Resolution|ZR)\b|\b(?:old|prior|previous|pre-amendment|pre[- ](?:18|19|20)\d{2})\s+(?:zoning\s+)?(?:text|rules?|requirements?|provisions?)\b|\b(?:before|prior to)\s+(?:the\s+)?(?:City of Yes|amendment)\b/i;

function asksForHistoricalSubstantiveText(question) {
  const value = compactText(question);
  // A question about what current source metadata can establish is answerable
  // as a source explanation. A second request for the actual old rule keeps
  // its historical-source prerequisite, even after a source-boundary clause.
  const singleSourceQuestion = (value.match(/\?/g) || []).length <= 1 &&
    !/[?;]\s*\S|\b(?:and|also|then)\s+(?:what|which|how|reconstruct|determine|quote|list|give|show)\b/i.test(value);
  const sourceBoundaryOnly = singleSourceQuestion &&
    /^(?:can|could|does|do|is|are|why\s+(?:can't|cannot|doesn't|does not))\b/i.test(value) &&
    /\b(?:current|selected|supplied)\b[^?;]{0,90}\b(?:metadata|amendment[- ]history|text|provisions?)\b/i.test(value) &&
    /\b(?:reconstruct|establish|determine|identify|show|enough|sufficient)\b/i.test(value);
  const sourceResearchMethodOnly = singleSourceQuestion &&
    /^(?:where|how)\s+(?:can|could|do|does|should|would)\s+(?:I|we|you|one|a professional)\b/i.test(value) &&
    /\b(?:retrieve|find|locate|research|verify|check)\b/i.test(value);
  if (sourceBoundaryOnly || sourceResearchMethodOnly) return false;
  if (/\b(?:reconstruct|determine|retrieve|quote|show|summarize)\s+(?:the\s+)?(?:zoning\s+)?(?:text|rules?|requirements?|provisions?)\s+in\s+(?:force|effect)\b/i.test(value)) return true;
  if (/\b(?:reconstruct|retrieve|quote|summarize|explain|identify|list)\s+(?:the\s+)?(?:old|prior|previous|historical|pre-amendment)\s+(?:zoning\s+)?(?:text|rules?|requirements?|provisions?)\b/i.test(value)) return true;
  if (!historicalTemporalClause.test(value) && !historicalRuleVersion.test(value)) return false;
  if (!/\b(?:ZR|Zoning Resolution|Sections?\s+\d{1,3}-\d{2,4}|rules?|requirements?|provisions?|law|require|allow|permit|prohibit|provide|say|read|permitted|allowed|prohibited|minimum|maximum|FAR)\b/i.test(value)) return false;
  // Bind the date to the requested rule's verb. A project fact such as
  // "issued the permit on December 4" is not a dated substantive-law request.
  const presentRuleQuestions = [...value.matchAll(/\b(?:what|which)\s+(?:does|do)\b[^?;]{0,180}?\b(require|allow|permit|prohibit|provide|say|read)\b([^?;]*)/gi)];
  return /\b(?:what|which|how)\s+(?:did|was|were)\b/i.test(value) ||
    /\b(?:what|which)\s+(?:(?!(?:does|do|is|are|will|would|can|could)\b)\S+\s+){0,8}(?:applied|was|were|required|permitted|allowed)\b/i.test(value) ||
    /(?:^|[?;,]\s*)(?:did|was|were)\b[^?;]{0,160}\b(?:require|allow|permit|prohibit|provide|say|apply|read|required|allowed|permitted|prohibited|applicable)\b/i.test(value) ||
    presentRuleQuestions.some(([, verb, rest]) => historicalRuleVerbDate.test(`${verb}${rest}`)) ||
    /\b(?:text|rules?|requirements?|provisions?|law)\s+(?:in\s+(?:force|effect)|applicable)\b/i.test(value);
}

function questionPath(question) {
  const value = compactText(question);
  const propertyOrMap = /\b(?:address|BBL|mapped zoning district|mapped district|Appendix [A-Z].*(?:map|location)|map and location|specific property|broker says .*subway|unverified transit zone|MIH.*(?:established|historical zoning lot|tax lots? were combined))\b/i.test(value);
  const effectiveOrHistory = asksForHistoricalSubstantiveText(value) || /\b(?:amendment history|historical|text in force|effective date|transition|continuation|grandfather|vested|certificate of occupancy|issued (?:before|after)|filed .*\b(?:before|after|on)\b|existed on|December \d|November \d|City of Yes)\b/i.test(value);
  const table = /\b(?:selected table|height-and-setback table|table symbols?|table footnotes?|legend|blank cell|asterisk|dagger)\b/i.test(value) &&
    !/\bconflict between\b/i.test(value);
  const definition = /\b(?:definition|defined|what (?:is|constitutes)|tax lots?.*one zoning lot|treated as one zoning lot|below-grade.*(?:floor area|base plane)|straddles two zoning districts|Section 77-11)\b/i.test(value);
  const calculation = /\b(?:calculate|calculation|how many|how much|FAR|floor area ratio|lot[- ]coverage|percent|percentage|weighted|combine them|fit the .*maximum|maximum permitted|open area enough|rear yard equivalent|enlargement|units allowed|recreation space)\b/i.test(value) &&
    /\d/.test(value);

  if (propertyOrMap) return zoningResearchPaths.propertyMapApplicability;
  if (effectiveOrHistory) return zoningResearchPaths.effectiveDateHistory;
  if (table) return zoningResearchPaths.structuredTableSymbol;
  // A numerical application can cite the FAR definition as one of its sources.
  // Keep that application on the arithmetic path; section numbers alone do not
  // turn a definition question into a calculation.
  if (calculation && /\d[\d,]*(?:\.\d+)?(?:[- ]square-foot|\s+square feet|\s+sq\.?\s*ft\.?)/i.test(value)) {
    return zoningResearchPaths.calculationScenario;
  }
  if (definition) return zoningResearchPaths.definitionCrossReference;
  if (calculation) return zoningResearchPaths.calculationScenario;
  return zoningResearchPaths.directRule;
}

function factRequirements(path, facts, question) {
  const requirements = [];
  if (path === zoningResearchPaths.propertyMapApplicability) {
    const asksSourceBoundary = appendixJSourceExplanationOnly(question);
    const historicMIHLot = /\bMIH\b|Mandatory Inclusionary Housing/i.test(question) &&
      /\b(?:established in|date of establishment|combined in|historical zoning lot|small[- ]development exception)\b/i.test(question);
    const needsMappedDistrict = /\b(?:mapped zoning district|mapped district|transit zone|Appendix [A-Z]|subarea|specific property|self-service storage|close to (?:a|the) subway)\b/i.test(question) ||
      /\bbroker says\b[^.]{0,120}\bsubway\b/i.test(question);
    const mappedStatusPresent = concreteMappedStatusPattern.test(facts);
    const propertyIdentityMaterial = /\b(?:specific property|address.*not provided|self-service storage)\b/i.test(question);
    if (propertyIdentityMaterial && !propertyIdentifierPattern.test(facts) && !asksSourceBoundary && !mappedStatusPresent) {
      requirements.push({
        id: "property_identifier",
        label: "property address or BBL",
        present: false,
        reason: "A parcel-specific mapped conclusion needs a usable property identifier."
      });
    }
    if (needsMappedDistrict && !mappedStatusPresent && !asksSourceBoundary) {
      requirements.push({
        id: "official_mapped_status",
        label: "controlling official map or verified mapped-district status",
        present: false,
        reason: "General geography and third-party descriptions do not establish official mapped status."
      });
    }
    if (historicMIHLot) {
      requirements.push({
        id: "mih_establishment_date",
        label: "official MIH-area establishment date",
        present: /\bofficial\b[^.]{0,100}\bestablishment date\b/i.test(facts),
        reason: "An owner-provided year is not the controlling establishment record."
      });
      requirements.push({
        id: "historical_zoning_lot_configuration",
        label: "official evidence of the zoning lot on the establishment date",
        present: /\bofficial\b[^.]{0,120}\bhistorical zoning lot\b/i.test(facts),
        reason: "A later tax-lot combination does not prove the earlier zoning-lot configuration."
      });
    }
  }
  // The authorized Zoning corpus contains current consolidated text, not a
  // dated substantive archive. An archive mentioned in a question or Project
  // fact is not resolved source evidence, whether claimed present or absent.
  // Retain this requirement for mixed parcel/history requests as well.
  if (asksForHistoricalSubstantiveText(question)) {
    requirements.push({
      id: "dated_substantive_text",
      label: "dated enacted or official archived substantive text",
      present: false,
      reason: "Amendment metadata, current transition text and a statement that an archive exists do not supply the dated substantive rule."
    });
  }
  if (path === zoningResearchPaths.effectiveDateHistory) {
    if (/\bhistorical shallow[- ]lot condition is unknown\b/i.test(question)) {
      requirements.push({
        id: "historical_lot_condition",
        label: "the lot's material historical condition",
        present: false,
        reason: "The stated historical condition is unresolved."
      });
    }
  }
  return requirements;
}

function appendixJSourceExplanationOnly(question) {
  // The existing safety contract permits source-level Appendix J explanation
  // while rejecting parcel results. Keep real or mixed property requests on
  // the prerequisite path, even if they also ask about the selected source.
  return isAppendixJSourceBoundaryQuestion(question) &&
    /\b(?:cannot|can't)\s+be\s+(?:made|established|determined|drawn)\b/i.test(question) &&
    (question.match(/\?/g) || []).length <= 1 &&
    !propertyIdentifierPattern.test(question) &&
    !/\b(?:this|that|our|my|your|subject|proposed|specific)\s+(?:site|property|parcel|lot|facility)\b/i.test(question);
}

function dispositionFor(path, requirements, question) {
  const missing = requirements.filter((item) => !item.present);
  if (!missing.length) return zoningResearchDispositions.ready;
  if (
    path === zoningResearchPaths.propertyMapApplicability ||
    /\b(?:unknown|not (?:provided|established|verified)|without identifying|broker says|owner says)\b/i.test(question)
  ) return zoningResearchDispositions.deterministicBoundary;
  return zoningResearchDispositions.clarificationRequired;
}

export function zoningResearchEvidenceLimits(planOrPath) {
  const path = typeof planOrPath === "string" ? planOrPath : planOrPath?.path;
  return structuredClone(pathLimits[path] || pathLimits[zoningResearchPaths.directRule]);
}

export function planZoningResearchQuestion({
  question,
  projectFacts = [],
  conversationFactContext = {}
} = {}) {
  const normalizedQuestion = compactText(question);
  if (!normalizedQuestion) throw new Error("A Zoning Research plan requires a question.");
  const path = questionPath(normalizedQuestion);
  const facts = combinedFactText({ question: normalizedQuestion, projectFacts, conversationFactContext });
  const requirements = factRequirements(path, facts, normalizedQuestion);
  const missingFacts = requirements.filter((item) => !item.present);
  const disposition = dispositionFor(path, requirements, normalizedQuestion);
  const subjectiveVerification = subjectiveVerificationForPath(path);
  const initialTier = initialTierForPath(path);
  const repairEligible = disposition === zoningResearchDispositions.ready &&
    path !== zoningResearchPaths.directRule;
  const maximumProviderCalls = disposition !== zoningResearchDispositions.ready
    ? 0
    : subjectiveVerification
      ? 3
      : repairEligible ? 2 : 1;
  const clarification = missingFacts.length
    ? `Before Permitext can make the requested Zoning conclusion, provide ${missingFacts.map((item) => item.label).join(" and ")}.`
    : null;
  const plan = {
    schemaVersion: 2,
    plannerVersion: zoningResearchPlannerVersion,
    path,
    pathLabel: pathLabels[path],
    disposition,
    requirements,
    missingFacts,
    clarification,
    evidenceLimits: zoningResearchEvidenceLimits(path),
    deterministicControls: {
      exactPassageBinding: true,
      stableSourceHashes: true,
      tableGridAndLegend: path === zoningResearchPaths.structuredTableSymbol,
      effectiveDateEventBinding: path === zoningResearchPaths.effectiveDateHistory || asksForHistoricalSubstantiveText(normalizedQuestion),
      arithmeticLedger: path === zoningResearchPaths.calculationScenario,
      propertyAndMapPrerequisites: path === zoningResearchPaths.propertyMapApplicability
    },
    callPolicy: {
      initialTier,
      initialModelRole: initialTier === "fast" ? "luna_first" : "terra_first_for_complex_path",
      subjectiveVerification,
      verifierTier: subjectiveVerification ? "fast" : null,
      maximumProviderCalls,
      allowFullAnswerRewrite: false,
      repairEligible,
      repairTier: repairEligible ? "accurate" : null,
      maximumRepairAttempts: repairEligible ? 1 : 0,
      repairMode: repairEligible ? "source_bounded_structured_patch" : null,
      terraEscalation: initialTier === "accurate"
        ? "planned_complex_path_or_one_source_bounded_repair"
        : "provider_failure_or_one_source_bounded_repair"
    },
    questionSignals: {
      sourceBoundaryExplanationOnly: appendixJSourceExplanationOnly(normalizedQuestion),
      historicalSubstantiveTextRequested: asksForHistoricalSubstantiveText(normalizedQuestion),
      explicitMissingFact: explicitMissingPattern.test(normalizedQuestion),
      propertyIdentifierPresent: propertyIdentifierPattern.test(facts),
      mappedStatusPresent: concreteMappedStatusPattern.test(facts)
    }
  };
  return { ...plan, planHash: stableHash(plan) };
}

function sourceText(source) {
  return compactText(source?.text || source?.selectedText || source?.userSelectedText);
}

function sourceRole(source) {
  return compactText(source?.evidencePriority?.evidenceRole || "supporting");
}

function sourceRelationship(source) {
  return compactText(source?.evidencePriority?.topicRouteRelationship || "unrestricted");
}

function explicitlyReferencedSource(question, source) {
  const number = compactText(source?.sectionNumber);
  if (!number) return false;
  return new RegExp(`\\b(?:ZR|Section)?\\s*${number.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
    .test(question);
}

export function selectZoningResearchEvidence({ question, evidence = [], plan } = {}) {
  const limits = zoningResearchEvidenceLimits(plan);
  const values = Array.isArray(evidence) ? evidence : [];
  const scored = values.map((source, index) => {
    const pinned = source?.origin === "user_pinned";
    const role = sourceRole(source);
    const relationship = sourceRelationship(source);
    let score = pinned ? 10_000 : 0;
    if (explicitlyReferencedSource(question, source)) score += 5_000;
    if (role === "governing") score += 2_000;
    if (role === "supporting") score += 1_000;
    if (source?.evidencePriority?.claimCoverageRequired === true) score += 800;
    if (relationship === "exact_topic") score += 500;
    if (relationship === "collateral") score -= 2_000;
    if (["contextual", "irrelevant"].includes(role)) score -= 3_000;
    return { source, index, score, pinned, characters: sourceText(source).length };
  }).sort((left, right) => right.score - left.score || left.index - right.index);

  const selected = [];
  const rejected = [];
  let characters = 0;
  for (const entry of scored) {
    const immaterial = !entry.pinned &&
      (["contextual", "irrelevant"].includes(sourceRole(entry.source)) ||
       sourceRelationship(entry.source) === "collateral");
    if (immaterial) {
      rejected.push({ sourceID: entry.source?.sourceID || null, reason: "non_material_or_collateral" });
      continue;
    }
    if (!entry.pinned && characters + entry.characters > limits.maximumCharacters) {
      rejected.push({ sourceID: entry.source?.sourceID || null, reason: "path_character_budget" });
      continue;
    }
    selected.push(entry.source);
    characters += entry.characters;
  }
  selected.sort((left, right) => values.indexOf(left) - values.indexOf(right));
  const pinnedCharacters = selected
    .filter((source) => source?.origin === "user_pinned")
    .reduce((total, source) => total + sourceText(source).length, 0);
  const gateFailures = [
    ...(pinnedCharacters > limits.maximumCharacters
      ? [{ code: "PINNED_EVIDENCE_EXCEEDS_PATH_BUDGET", actual: pinnedCharacters, maximum: limits.maximumCharacters }]
      : []),
    ...(characters > limits.maximumCharacters
      ? [{ code: "EVIDENCE_EXCEEDS_PATH_BUDGET", actual: characters, maximum: limits.maximumCharacters }]
      : [])
  ];
  return {
    pass: gateFailures.length === 0 && selected.length > 0,
    sources: selected,
    rejected,
    gateFailures,
    usage: {
      sourceCount: selected.length,
      characterCount: characters,
      pinnedCharacterCount: pinnedCharacters,
      maximumCharacters: limits.maximumCharacters
    }
  };
}

const calendarDatePattern = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/gi;
const measurementPattern = /\b(\d[\d,]*(?:\.\d+)?)\s*(square feet|square-foot|feet|foot|dwelling units?|units?|percent|%|FAR)\b/gi;

function numericValue(value) {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function arithmeticLedger(question) {
  const measurements = Array.from(question.matchAll(measurementPattern)).map((match) => ({
    raw: match[0],
    value: numericValue(match[1]),
    unit: match[2].toLowerCase()
  })).filter((item) => item.value !== null);
  const calculations = [];
  const addRatio = (id, numeratorText, denominatorText, resultKind = "ratio") => {
    const numerator = numericValue(numeratorText);
    const denominator = numericValue(denominatorText);
    if (numerator === null || denominator === null || denominator <= 0) return;
    const result = Number((numerator / denominator).toFixed(4));
    if (calculations.some((item) => item.numerator === numerator && item.denominator === denominator)) return;
    calculations.push({
      id,
      operation: "division",
      numerator,
      denominator,
      result,
      resultKind,
      display: `${numerator} / ${denominator} = ${result}`
    });
  };
  const patterns = [
    {
      id: "proposed_floor_area_far",
      pattern: /(\d[\d,]*(?:\.\d+)?)\s*square feet of (?:residential )?floor area on a (\d[\d,]*(?:\.\d+)?)[- ]square-foot[^.]{0,40}\blot\b/i,
      numerator: 1,
      denominator: 2,
      kind: "far"
    },
    {
      id: "proposed_floor_area_far",
      pattern: /(\d[\d,]*(?:\.\d+)?)[- ]square-foot[^.]{0,50}\blot\b[^.]{0,100}\b(?:want|proposed with|proposed for)\s+(\d[\d,]*(?:\.\d+)?)\s*square feet/i,
      numerator: 2,
      denominator: 1,
      kind: "far"
    },
    {
      id: "lot_coverage",
      pattern: /lot contains (\d[\d,]*(?:\.\d+)?)\s*square feet[^.]{0,100}\bcover\s+(\d[\d,]*(?:\.\d+)?)\s*square feet/i,
      numerator: 2,
      denominator: 1,
      kind: "coverage"
    },
    {
      id: "requested_floor_area_far",
      pattern: /(\d[\d,]*(?:\.\d+)?)[- ]square-foot zoning lot[^.]{0,120}\bwant\s+(\d[\d,]*(?:\.\d+)?)\s*square feet/i,
      numerator: 2,
      denominator: 1,
      kind: "far"
    }
  ];
  for (const candidate of patterns) {
    const match = question.match(candidate.pattern);
    if (match) addRatio(candidate.id, match[candidate.numerator], match[candidate.denominator], candidate.kind);
  }
  return { measurements, calculations };
}

function evidenceText(evidence = []) {
  return (Array.isArray(evidence) ? evidence : [])
    .map((source) => sourceText(source))
    .filter(Boolean)
    .join("\n\n");
}

function numberTextAlternatives(value, { percent = false } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return [];
  const values = new Set([
    String(number),
    number.toFixed(2),
    number.toLocaleString("en-US", { maximumFractionDigits: 4 })
  ]);
  if (Number.isInteger(number)) values.add(number.toLocaleString("en-US"));
  if (percent) values.add(`${number}%`);
  return Array.from(values);
}

function firstQuestionNumber(question, patterns) {
  for (const pattern of patterns) {
    const match = question.match(pattern);
    const value = match ? numericValue(match[1]) : null;
    if (value !== null) return value;
  }
  return null;
}

function questionDistrict(question) {
  const matches = Array.from(String(question || "").matchAll(/\b(?:R\d{1,2}[A-Z]?|C\d(?:-\d[A-Z]?)?|M\d(?:-\d[A-Z]?)?)\b/gi));
  return matches.map((match) => match[0].toUpperCase()).find((value) => /[A-Z]$/.test(value)) ||
    matches[0]?.[0]?.toUpperCase() || null;
}

function normalizedGridCellText(cell) {
  const raw = compactText(cell?.text);
  const markerIndex = raw.lastIndexOf('">');
  return compactText(markerIndex >= 0 ? raw.slice(markerIndex + 2) : raw);
}

function validStructuredGrid(grid) {
  return (Array.isArray(grid?.rows) ? grid.rows : []).some((row) =>
    (Array.isArray(row?.cells) ? row.cells : []).some((cell) => normalizedGridCellText(cell))
  );
}

function structuredRowsForSection(evidence, sectionNumber) {
  const wanted = compactText(sectionNumber).replace(/^ZR\s+/i, "");
  const output = [];
  for (const source of Array.isArray(evidence) ? evidence : []) {
    if (compactText(source?.sectionNumber).replace(/^ZR\s+/i, "") !== wanted) continue;
    for (const grid of Array.isArray(source?.richSourceGrids) ? source.richSourceGrids : []) {
      if (!validStructuredGrid(grid)) continue;
      const rows = (Array.isArray(grid?.rows) ? grid.rows : [])
        .map((row) => (Array.isArray(row?.cells) ? row.cells : []).map(normalizedGridCellText))
        .filter((cells) => cells.some(Boolean));
      if (!rows.length) continue;
      output.push({ sourceID: source.sourceID, rows });
    }
  }
  return output;
}

function districtTokens(value) {
  return compactText(value).toUpperCase().match(/\b(?:R\d{1,2}[A-Z]?(?:-\d[A-Z]?)?|C\d(?:-\d[A-Z]?)?|M\d(?:-\d[A-Z]?)?)\b/g) || [];
}

function firstDecimal(value) {
  const match = compactText(value).match(/(?:^|\s)(\d+(?:\.\d+)?)(?=\s|$)/);
  return match ? Number(match[1]) : null;
}

function structuredFARRow(question, evidence, district, sectionNumber = "23-22") {
  const target = compactText(district).toUpperCase();
  if (!target) return null;
  const candidates = [];
  for (const table of structuredRowsForSection(evidence, sectionNumber)) {
    const header = table.rows[0].map((cell) => cell.toLowerCase());
    const districtColumn = header.findIndex((cell) => /\bdistricts?\b/.test(cell));
    const numericColumns = header
      .map((cell, index) => ({ cell, index }))
      .filter(({ cell }) => /(?:floor area ratio|standard residences|qualifying affordable)/.test(cell))
      .map(({ index }) => index);
    if (districtColumn < 0 || !numericColumns.length) continue;
    for (const cells of table.rows.slice(1)) {
      const tokens = districtTokens(cells[districtColumn]);
      if (!tokens.includes(target)) continue;
      const values = numericColumns.map((index) => firstDecimal(cells[index])).filter((value) => value !== null);
      if (!values.length) continue;
      candidates.push({
        district: target,
        districtCell: cells[districtColumn],
        districtTokens: tokens,
        standardFAR: values[0],
        qualifyingFAR: values[1] ?? null,
        sourceIDs: [table.sourceID].filter(Boolean)
      });
    }
  }
  if (candidates.length <= 1) return candidates[0] || null;
  const withinWideStreet = /\bwithin\s+100\s+feet\s+of\s+a\s+wide\s+street\b/i.test(question);
  const outsideWideStreet = /\b(?:beyond|outside|more than)\s+100\s+feet\s+(?:of|from)\s+a\s+wide\s+street\b/i.test(question);
  if (withinWideStreet) return candidates.find((candidate) => candidate.districtTokens.length === 1) || null;
  if (outsideWideStreet) return candidates.find((candidate) => candidate.districtTokens.length > 1) || null;
  return null;
}

function tableFARValues(question, evidence) {
  const district = questionDistrict(question);
  if (!district) return null;
  const row = structuredFARRow(question, evidence, district);
  if (!row || row.qualifyingFAR === null) return null;
  return row;
}

function sourceIDsForSections(evidence, sectionNumbers = []) {
  const wanted = new Set(sectionNumbers.map((value) => compactText(value).replace(/^ZR\s+/i, "")));
  return unique((Array.isArray(evidence) ? evidence : [])
    .filter((source) => wanted.has(compactText(source?.sectionNumber).replace(/^ZR\s+/i, "")))
    .map((source) => source?.sourceID));
}

function structuredEquivalentDistrict(evidence, commercialDistrict) {
  const target = compactText(commercialDistrict).toUpperCase();
  if (!target) return null;
  for (const table of structuredRowsForSection(evidence, "34-112")) {
    const header = table.rows[0].map((cell) => cell.toLowerCase());
    const districtColumn = header.findIndex((cell) => /\bdistricts?\b/.test(cell));
    const equivalentColumn = header.findIndex((cell) => /residential equivalent/.test(cell));
    if (districtColumn < 0 || equivalentColumn < 0) continue;
    for (const cells of table.rows.slice(1)) {
      if (!districtTokens(cells[districtColumn]).includes(target)) continue;
      const equivalent = districtTokens(cells[equivalentColumn])[0];
      if (equivalent) return { district: equivalent, sourceIDs: [table.sourceID].filter(Boolean) };
    }
  }
  return null;
}

function sectionNumericValue(evidence, sectionNumber, pattern) {
  const source = (Array.isArray(evidence) ? evidence : []).find((item) =>
    compactText(item?.sectionNumber).replace(/^ZR\s+/i, "") === sectionNumber
  );
  const match = source ? sourceText(source).match(pattern) : null;
  const numericWords = new Map([
    ["one", 1], ["two", 2], ["three", 3], ["four", 4], ["five", 5], ["six", 6],
    ["seven", 7], ["eight", 8], ["nine", 9], ["ten", 10], ["eleven", 11], ["twelve", 12]
  ]);
  const value = match ? numericValue(match[1]) ?? numericWords.get(compactText(match[1]).toLowerCase()) ?? null : null;
  return value === null ? null : { value, sourceIDs: [source.sourceID].filter(Boolean) };
}

function obligation(id, kind, detail, values = [], sourceIDs = [], options = {}) {
  const record = {
    id,
    kind,
    detail,
    values: unique(values.map((value) => compactText(value))),
    sourceIDs: unique(sourceIDs.map(String)),
    requireAllValues: options.requireAllValues === true
  };
  const valueGroups = (Array.isArray(options.valueGroups) ? options.valueGroups : [])
    .map((group) => unique((Array.isArray(group) ? group : [group]).map((value) => compactText(value))))
    .filter((group) => group.length);
  if (valueGroups.length) record.valueGroups = valueGroups;
  if (options.coverageScope) record.coverageScope = options.coverageScope;
  if (options.requireSourceBound === true) record.requireSourceBound = true;
  if (options.rejectMisboundCoverage === true) record.rejectMisboundCoverage = true;
  if (options.unresolvedEvidence === true) record.unresolvedEvidence = true;
  if (Array.isArray(options.requiredSourceSections) && options.requiredSourceSections.length) {
    record.requiredSourceSections = unique(options.requiredSourceSections.map(String));
  }
  if (Array.isArray(options.prohibitedPatterns) && options.prohibitedPatterns.length) {
    record.prohibitedPatterns = options.prohibitedPatterns.map(String);
  }
  if (Array.isArray(options.requiredPatterns) && options.requiredPatterns.length) {
    record.requiredPatterns = options.requiredPatterns.map(String);
  }
  if (options.affirmativeRequiredPatterns === true) record.affirmativeRequiredPatterns = true;
  if (options.numericComparison) record.numericComparison = structuredClone(options.numericComparison);
  if (options.qualifiedClaims?.length) record.qualifiedClaims = options.qualifiedClaims.map((claim) => ({
    claimPattern: String(claim.claimPattern), qualifierPattern: String(claim.qualifierPattern)
  }));
  return record;
}

function tableLegendObligations(question, evidence = []) {
  if (!/\b(?:symbols?|legend|asterisk|dagger|blank cell)\b/i.test(question)) return [];
  const obligations = [];
  for (const source of evidence) {
    const cells = (Array.isArray(source?.richSourceGrids) ? source.richSourceGrids : [])
      .flatMap((grid) => Array.isArray(grid?.rows) ? grid.rows : [])
      .flatMap((row) => Array.isArray(row?.cells) ? row.cells : [])
      .map((cell) => compactText(cell?.text))
      .filter((text) => text.includes("="));
    for (const cell of cells) {
      const pairs = Array.from(cell.matchAll(/([●♦○–*SPU])\s*=\s*(.+?)(?=\s+[●♦○–*SPU]\s*=|$)/g));
      for (const pair of pairs) {
        const symbol = pair[1];
        const meaning = compactText(pair[2]);
        obligations.push(obligation(
          `table_legend_${stableHash(`${source.sourceID}:${symbol}:${meaning}`).slice(0, 12)}`,
          "table_legend",
          `Preserve the exact table legend mapping ${symbol} = ${meaning}.`,
          [symbol, meaning],
          [source.sourceID],
          { requireAllValues: true }
        ));
      }
    }
  }
  return obligations;
}

function observedFailureObligations({ question, evidence = [], plan, facts = question }) {
  const obligations = [];
  const flatEvidence = compactText(evidenceText(evidence));

  const lotArea = firstQuestionNumber(question, [
    /(\d[\d,]*(?:\.\d+)?)[- ]square-foot\s+(?:[A-Z0-9-]+\s+)?(?:zoning\s+)?lot\b/i,
    /(?:zoning\s+)?lot\s+(?:contains|has|is)\s+(\d[\d,]*(?:\.\d+)?)\s*square feet/i
  ]);

  const proposedCoverage = firstQuestionNumber(question, [
    /cover\s+(\d[\d,]*(?:\.\d+)?)\s*square feet/i
  ]);
  const basicCoveragePercent = numericValue(flatEvidence.match(
    /maximum residential lot coverage for interior lots? or through lots? shall be (\d+(?:\.\d+)?) percent/i
  )?.[1]);
  if (lotArea && proposedCoverage && basicCoveragePercent === null && /basic lot[- ]coverage/i.test(question)) {
    obligations.push(obligation(
      "basic_lot_coverage_governing_percentage_unresolved",
      "evidence_boundary",
      "The enacted basic lot-coverage percentage and its controlling table or rule must be resolved before calculating the cap.",
      [],
      [],
      {
        requireSourceBound: true,
        unresolvedEvidence: true,
        requiredSourceSections: ["23-362", "23-363", "23-342"]
      }
    ));
  }
  if (lotArea && proposedCoverage && basicCoveragePercent !== null && /basic lot[- ]coverage/i.test(question)) {
    const basicCap = Number((lotArea * basicCoveragePercent / 100).toFixed(4));
    const difference = Number((proposedCoverage - basicCap).toFixed(4));
    const proposedPercent = Number((proposedCoverage / lotArea * 100).toFixed(4));
    const comparison = difference > 0 ? "exceeds" : difference < 0 ? "is below" : "equals";
    const sourceIDs = sourceIDsForSections(evidence, ["23-362", "23-363", "23-342"]);
    obligations.push(obligation(
      "basic_lot_coverage_numerical_cap",
      "numerical_boundary",
      `State the ${basicCoveragePercent}-percent basic cap (${basicCap} square feet). The proposed ${proposedCoverage} square feet is ${proposedPercent} percent of the ${lotArea}-square-foot lot and ${comparison} the basic cap${difference ? ` by ${Math.abs(difference)} square feet` : ""}. Keep the proposed area, its percentage and the difference from the cap distinct.`,
      [],
      sourceIDs,
      {
        valueGroups: [
          [`${basicCoveragePercent} percent`, `${basicCoveragePercent}%`],
          numberTextAlternatives(basicCap),
          numberTextAlternatives(proposedCoverage),
          difference > 0 ? ["exceeds", "over the basic", "above the basic"]
            : difference < 0 ? ["below", "less than", "under", "within"] : ["equals", "equal to", "at the basic", "at the cap"]
        ],
        numericComparison: { proposedQuantity: proposedCoverage, maximumQuantity: basicCap, difference, proposedPercent, unit: "square feet" }
      }
    ));
    obligations.push(obligation(
      "basic_lot_coverage_modification_boundaries",
      "regulatory_boundary",
      "Preserve the shallow-lot, near-corner, and short-block-dimension modification routes instead of presenting the basic percentage as universal.",
      [],
      sourceIDsForSections(evidence, ["23-363"]),
      {
        valueGroups: [
          ["shallow lot", "shallow zoning lot"],
          ["corner", "within 100 feet"],
          ["short dimension", "short block"]
        ]
      }
    ));
    obligations.push(obligation(
      "basic_lot_coverage_independent_bulk_boundary",
      "regulatory_boundary",
      "State that the numerical lot-coverage cap is not a footprint entitlement. Apply the independently applicable yard rules established by the bound passages. Describe open-area or other bulk constraints as outside this review when their governing provisions are not supplied; do not invent additional requirements.",
      [],
      sourceIDs,
      {
        valueGroups: [
          ["not an entitlement", "does not establish entitlement", "may be more restrictive", "independently applicable"],
          ["yard"],
          ["open area", "open-area"],
          ["bulk"]
        ]
      }
    ));
  }

  if (/Inner Transit Zone/i.test(question) && /parking spaces?/i.test(question) && /December 5, 2024/i.test(question)) {
    obligations.push(obligation(
      "inner_transit_post_2024_zero_spaces",
      "effective_date_boundary",
      "Tie the zero-space result to units created after December 5, 2024 within the Inner Transit Zone.",
      [],
      sourceIDsForSections(evidence, ["25-211"]),
      {
        valueGroups: [
          ["zero", "no accessory off-street parking spaces"],
          ["created after December 5, 2024"],
          ["Inner Transit Zone"]
        ],
        requiredPatterns: [
          "(?:\\bzero\\b[^.;]{0,80}\\b(?:spaces?|parking)\\b|\\bno accessory off-street parking spaces (?:are )?required\\b)"
        ],
        affirmativeRequiredPatterns: true,
        coverageScope: "answer",
        prohibitedPatterns: [
          "\\bzero(?: parking)? spaces? (?:are|is) not required\\b",
          "\\bno accessory off-street parking spaces (?:are|is) not required\\b"
        ],
        requireSourceBound: true
      }
    ));
    obligations.push(obligation(
      "inner_transit_transition_and_existing_parking_boundary",
      "effective_date_boundary",
      "Address the Section 11-333 continuation boundary and distinguish existing-unit parking from the stated post-December 5, 2024 units.",
      [],
      sourceIDsForSections(evidence, ["11-333", "25-211"]),
      {
        valueGroups: [
          ["11-333"],
          ["pre-December 5, 2024", "existing units", "existing parking"],
          ["25-212", "maintenance provisions", "may only be reduced or eliminated"]
        ]
      }
    ));
    obligations.push(obligation(
      "inner_transit_created_certificate_definition",
      "definition_branch",
      "Use the temporary-or-final-certificate definition of when a dwelling unit is created.",
      [],
      sourceIDsForSections(evidence, ["25-211"]),
      {
        valueGroups: [
          ["temporary certificate of occupancy"],
          ["final certificate of occupancy"]
        ],
        requireSourceBound: true
      }
    ));
  }

  if (/below-grade/i.test(question) && /base plane/i.test(question) && /storage/i.test(question) && /floor area/i.test(question)) {
    const cellarSourceIDs = sourceIDsForSections(evidence, ["12-10"]);
    obligations.push(obligation(
      "cellar_floor_area_classification",
      "definition_branch",
      "Apply the more-than-one-half-height cellar test and the non-dwelling cellar floor-area exclusion.",
      [],
      cellarSourceIDs,
      {
        valueGroups: [
          ["more than one-half", "more than half"],
          ["base plane"],
          ["cellar"],
          ["not used for dwelling", "non-dwelling", "not dwelling"],
          ["does not count", "excluded from floor area", "excluded from zoning floor area", "shall not include"]
        ],
        requireSourceBound: true
      }
    ));
    const unresolvedCellarConditions = [];
    if (!/\b(?:base plane is not sloping|non[- ]sloping base plane|sloping-base-plane rule does not apply)\b/i.test(facts)) {
      unresolvedCellarConditions.push({ label: "sloping base plane", valueGroups: [["sloping base plane"]] });
    }
    if (!/\b(?:not a through lot|interior lot|controlling street wall line (?:is|has been) (?:identified|confirmed))\b/i.test(facts)) {
      unresolvedCellarConditions.push({
        label: "through-lot street-wall-line measurement",
        valueGroups: [["street wall line", "through lot"]]
      });
    }
    if (!/\b(?:no yard (?:was|has been) lowered|yard (?:was|has been) not lowered)\b[^.]{0,80}\b(?:December 5, 1990|after 1990)\b/i.test(facts)) {
      unresolvedCellarConditions.push({
        label: "post-December 5, 1990 lowered-yard condition",
        valueGroups: [
          ["lowered yard", "yard was lowered", "yard is lowered"],
          ["December 5, 1990"]
        ]
      });
    }
    if (unresolvedCellarConditions.length) {
      obligations.push(obligation(
        "cellar_special_measurement_conditions",
        "definition_branch",
        `Keep these unstated measurement conditions explicit and unresolved: ${unresolvedCellarConditions.map((item) => item.label).join(", ")}.`,
        [],
        cellarSourceIDs,
        {
          coverageScope: "uncertainty",
          valueGroups: unresolvedCellarConditions.flatMap((item) => item.valueGroups)
        }
      ));
    }
    obligations.push(obligation(
      "cellar_retail_parking_loading_caveat",
      "definition_branch",
      "Preserve the retail-cellar caveat only for parking, bicycle-parking, and loading calculations.",
      [],
      cellarSourceIDs,
      {
        valueGroups: [
          ["retail", "retailing"],
          ["parking"],
          ["bicycle"],
          ["loading"]
        ]
      }
    ));
  }

  if (/Special Mixed Use District/i.test(question) && /(?:fabrication|manufacturing)/i.test(question) && /combine them/i.test(question)) {
    const manufacturingArea = firstQuestionNumber(question, [
      /and\s+(\d[\d,]*(?:\.\d+)?)\s*square feet of (?:a\s+)?(?:fabrication|manufacturing|commercial)/i
    ]);
    const manufacturingDistrict = question.match(/\bM\d-\d[A-Z]?\b/i)?.[0];
    const manufacturingTableRow = structuredFARRow(question, evidence, manufacturingDistrict, "43-12");
    const manufacturingMaximumFAR = manufacturingTableRow?.standardFAR ?? null;
    if (lotArea && manufacturingArea && manufacturingMaximumFAR !== null) {
      const componentFAR = Number((manufacturingArea / lotArea).toFixed(4));
      const manufacturingMaximumArea = Number((lotArea * manufacturingMaximumFAR).toFixed(4));
      const manufacturingSourceIDs = manufacturingTableRow.sourceIDs;
      obligations.push(obligation(
        "mixed_use_manufacturing_component_far",
        "component_calculation",
        `Calculate the manufacturing component as ${manufacturingArea} / ${lotArea} = ${componentFAR} FAR and state that it is within the ${manufacturingMaximumFAR} FAR component limit.`,
        [],
        manufacturingSourceIDs,
        {
          valueGroups: [
            [`${componentFAR} FAR`, `${componentFAR.toFixed(2)} FAR`],
            [`${manufacturingMaximumFAR} FAR`, `${manufacturingMaximumFAR.toFixed(2)} FAR`],
            ["below", "within"]
          ],
          requireSourceBound: true
        }
      ));
      obligations.push(obligation(
        "mixed_use_manufacturing_component_area_ceiling",
        "component_calculation",
        `Show the manufacturing component ceiling: ${lotArea} x ${manufacturingMaximumFAR} = ${manufacturingMaximumArea} square feet.`,
        [],
        manufacturingSourceIDs,
        {
          valueGroups: [
            numberTextAlternatives(manufacturingMaximumArea),
            [`${manufacturingMaximumFAR} FAR`, `${manufacturingMaximumFAR.toFixed(2)} FAR`]
          ],
          requireSourceBound: true
        }
      ));
    } else {
      obligations.push(obligation(
        "mixed_use_manufacturing_table_row_unresolved",
        "evidence_boundary",
        `The structured ZR 43-12 table row for ${manufacturingDistrict || "the stated manufacturing district"} must be resolved before calculating its component FAR ceiling.`,
        [],
        manufacturingTableRow?.sourceIDs || [],
        {
          requireSourceBound: true,
          unresolvedEvidence: true,
          requiredSourceSections: ["43-12"]
        }
      ));
    }
  }

  if (
    /split by a district boundary/i.test(question) &&
    /wide street/i.test(flatEvidence) &&
    /adjusted maximum floor area ratio|multiply[^.]{0,180}percentage of the zoning lot/i.test(flatEvidence)
  ) {
    obligations.push(obligation(
      "split_district_allocation_does_not_change_total",
      "total_vs_allocation_boundary",
      "State that the wide-street exception concerns allocation of the already-calculated floor area and cannot increase or leave unresolved the adjusted total-floor-area maximum.",
      [],
      sourceIDsForSections(evidence, ["77-22"]),
      {
        valueGroups: [
          ["allocation", "located", "placement"],
          ["does not increase", "does not change", "cannot increase"],
          ["adjusted maximum", "total floor area", "total-floor-area"]
        ],
        prohibitedPatterns: [
          "(?:whether|might|could|may|unresolved)[^.;]{0,180}(?:110,?000|total floor area|total-floor-area)[^.;]{0,120}(?:achiev|allow|permit|compli)",
          "(?:110,?000|total floor area|total-floor-area)[^.;]{0,120}(?:may|might|could|unresolved)[^.;]{0,120}(?:achiev|allow|permit|compli)"
        ]
      }
    ));
  }

  if (/C6-2/i.test(question) && /office building/i.test(question) && /convert/i.test(question) && /recreation space/i.test(question)) {
    const commercialDistrict = question.match(/\bC\d(?:-\d[A-Z]?)?\b/i)?.[0];
    const residentialEquivalent = structuredEquivalentDistrict(evidence, commercialDistrict);
    const residentialFAR = residentialEquivalent
      ? structuredFARRow(question, evidence, residentialEquivalent.district, "23-22")
      : null;
    const dwellingFactor = sectionNumericValue(
      evidence,
      "23-52",
      /applicable dwelling unit factor shall be (\d[\d,]*(?:\.\d+)?)/i
    );
    const recreationPercent = sectionNumericValue(
      evidence,
      "23-63",
      /minimum of (\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten) percent of the residential floor area/i
    );
    const buildingArea = firstQuestionNumber(question, [
      /lawful\s+(\d[\d,]*(?:\.\d+)?)[- ]square-foot office building/i,
      /(?:existing|lawful)\s+(\d[\d,]*(?:\.\d+)?)\s*square feet[^.]{0,80}office/i
    ]);
    const proposedUnits = firstQuestionNumber(question, [
      /convert[^.]{0,160}\bto\s+(\d[\d,]*)\s+(?:market-rate\s+)?(?:apartments|dwelling units|units)\b/i
    ]);
    const requiredInputs = [
      [commercialDistrict, "commercial district"],
      [residentialEquivalent, "structured ZR 34-112 residential-equivalent row"],
      [residentialFAR, "structured ZR 23-22 FAR row for the stated wide-street geography"],
      [dwellingFactor, "ZR 23-52 dwelling-unit factor"],
      [recreationPercent, "ZR 23-63 recreation percentage"],
      [lotArea, "zoning-lot area"],
      [buildingArea, "existing residential conversion floor area"],
      [proposedUnits, "proposed unit count"]
    ];
    const missingInputs = requiredInputs.filter(([value]) => value === null || value === undefined).map(([, label]) => label);
    if (missingInputs.length) {
      obligations.push(obligation(
        "conversion_controlling_inputs_unresolved",
        "evidence_boundary",
        `Do not calculate conversion density or recreation space until these controlling inputs are resolved: ${missingInputs.join(", ")}.`,
        [],
        unique([
          ...(residentialEquivalent?.sourceIDs || []),
          ...(residentialFAR?.sourceIDs || []),
          ...(dwellingFactor?.sourceIDs || []),
          ...(recreationPercent?.sourceIDs || [])
        ]),
        {
          requireSourceBound: true,
          unresolvedEvidence: true,
          requiredSourceSections: ["34-112", "23-22", "23-52", "23-63"]
        }
      ));
    } else {
      const maximumResidentialArea = Number((lotArea * residentialFAR.standardFAR).toFixed(4));
      const rawUnitMaximum = maximumResidentialArea / dwellingFactor.value;
      const wholeUnits = Math.floor(rawUnitMaximum);
      const preliminaryUnitMaximum = wholeUnits + (rawUnitMaximum - wholeUnits >= 0.75 ? 1 : 0);
      const unitMargin = preliminaryUnitMaximum - proposedUnits;
      const unitComparison = unitMargin > 0
        ? {
            detail: `${proposedUnits} is ${unitMargin} units below it`,
            values: [`${unitMargin} units below`, `${unitMargin} dwelling units below`]
          }
        : unitMargin < 0
          ? {
              detail: `${proposedUnits} is ${Math.abs(unitMargin)} units above it`,
              values: [
                `${Math.abs(unitMargin)} units above`,
                `${Math.abs(unitMargin)} dwelling units above`,
                `exceeds it by ${Math.abs(unitMargin)}`
              ]
            }
          : {
              detail: `${proposedUnits} equals it`,
              values: ["equals the preliminary", "is equal to the preliminary", "exactly the preliminary"]
            };
      const recreationArea = Number((buildingArea * recreationPercent.value / 100).toFixed(4));
      obligations.push(obligation(
        "conversion_preliminary_density_not_approval",
        "approval_boundary",
        `Present ${preliminaryUnitMaximum} units as a preliminary density maximum, state that ${unitComparison.detail}, and do not convert that calculation into legal approval.`,
        [],
        sourceIDsForSections(evidence, ["15-111", "23-52"]),
        {
          coverageScope: "answer",
          valueGroups: [
            ["preliminary"],
            numberTextAlternatives(preliminaryUnitMaximum),
            unitComparison.values,
            ["does not establish", "not establish"],
            ["legally approvable", "legal approvability"]
          ],
          prohibitedPatterns: [`\\b${proposedUnits}(?: market-rate)? (?:apartments|units) (?:are|is) allowed\\b`]
        }
      ));
      obligations.push(obligation(
        "conversion_c6_2_r8_citation_role",
        "citation_role",
        `Bind the ${commercialDistrict}-to-${residentialEquivalent.district} residential-equivalent proposition to ZR 34-112.`,
        [],
        residentialEquivalent.sourceIDs,
        {
          valueGroups: [[commercialDistrict], [residentialEquivalent.district]],
          requiredPatterns: [
            `(?:\\b${commercialDistrict}\\b[^.;]{0,100}\\b(?:maps?|assigned|equivalent)\\b[^.;]{0,100}\\b${residentialEquivalent.district}\\b|\\b${residentialEquivalent.district}\\b[^.;]{0,100}\\b(?:equivalent|assigned)\\b[^.;]{0,100}\\b${commercialDistrict}\\b)`
          ],
          requireSourceBound: true,
          rejectMisboundCoverage: true,
          prohibitedPatterns: [
            `\\b${commercialDistrict}\\b[^.;]{0,80}\\b(?:does not|doesn't|is not)\\b[^.;]{0,80}\\b${residentialEquivalent.district}\\b`
          ]
        }
      ));
      obligations.push(obligation(
        "conversion_density_factor_citation_role",
        "citation_role",
        `Bind the ${dwellingFactor.value} dwelling-unit factor and three-quarter rounding rule to ZR 23-52.`,
        [],
        dwellingFactor.sourceIDs,
        {
          valueGroups: [numberTextAlternatives(dwellingFactor.value), ["three-quarter", "three quarters", "0.75", "fraction"]],
          requiredPatterns: [
            `(?:\\b${dwellingFactor.value}\\b[^.;]{0,120}\\b(?:factor|divide|three-quarter|three quarters|fraction)\\b|\\b(?:factor|divide|three-quarter|three quarters|fraction)\\b[^.;]{0,120}\\b${dwellingFactor.value}\\b)`
          ],
          requireSourceBound: true,
          rejectMisboundCoverage: true
        }
      ));
      obligations.push(obligation(
        "conversion_recreation_baseline_citation_role",
        "citation_role",
        `Bind the ${recreationPercent.value}-percent recreation baseline and ${recreationArea}-square-foot calculation to ZR 23-63.`,
        [],
        recreationPercent.sourceIDs,
        {
          valueGroups: [
            [`${recreationPercent.value} percent`, `${recreationPercent.value}%`],
            numberTextAlternatives(recreationArea)
          ],
          requiredPatterns: [
            `\\b${recreationPercent.value}(?: percent|%)\\b[^.;]{0,120}\\b(?:recreation|baseline|${String(recreationArea).replace(".", "\\.")})\\b`
          ],
          requireSourceBound: true,
          rejectMisboundCoverage: true
        }
      ));
    }
  }

  if (/City of Yes/i.test(question) && /November 20, 2024/i.test(question) && /foundation/i.test(question)) {
    const transitionSourceIDs = sourceIDsForSections(evidence, ["11-333"]);
    obligations.push(obligation(
      "city_of_yes_specific_transition_route",
      "effective_date_boundary",
      "Apply the N 240290 ZRY route for an application filed by December 5, 2024 and approved by DOB by December 5, 2025 on a complete zoning analysis.",
      [],
      transitionSourceIDs,
      {
        valueGroups: [
          ["N 240290 ZRY", "N 240290"],
          ["December 5, 2024"],
          ["December 5, 2025"],
          ["complete zoning analysis"],
          ["DOB", "Department of Buildings"]
        ],
        requireSourceBound: true
      }
    ));
    obligations.push(obligation(
      "city_of_yes_amendment_and_records_boundary",
      "effective_date_boundary",
      "State that qualifying amendments may retain status through the deadline and require DOB approval records plus verified pre-amendment substantive text.",
      [],
      transitionSourceIDs,
      {
        valueGroups: [
          ["amended", "amendments"],
          ["DOB records", "Department of Buildings records", "approval records"],
          ["historical text", "pre-amendment text", "prior rules"]
        ]
      }
    ));
    obligations.push(obligation(
      "city_of_yes_foundation_percentage_not_dispositive",
      "regulatory_boundary",
      "Distinguish the general completed-foundation rule from ZR 11-333(9), whose eligibility is not decided by the stated foundation percentage.",
      [],
      transitionSourceIDs,
      {
        valueGroups: [
          ["60 percent", "60%"],
          ["all foundation work", "all foundations"],
          ["does not resolve", "not dispositive", "does not decide", "separate route"]
        ]
      }
    ));
  }

  return obligations;
}

function directRuleAnswerObligations(question, evidence = []) {
  const obligations = [];
  const governing = evidence.filter((source) => source.codePrefix === "ZR" && sourceRole(source) === "governing");
  const constructionRule = governing.find((source) => source.sectionNumber === "12-01" &&
    /The particular shall control the general\./i.test(sourceText(source)) &&
    /difference of meaning or implication[^.]+caption, illustration, summary table or illustrative table, the text shall control\./i.test(sourceText(source)));
  if (constructionRule && /\b(?:conflict|difference|resolve|construction)\b/i.test(question) &&
      /\b(?:text|illustration|caption|table|general|particular)\b/i.test(question)) {
    const options = { requireSourceBound: true, coverageScope: "answer", affirmativeRequiredPatterns: true };
    obligations.push(obligation("construction_particular_controls_general", "rule_priority",
      "State the supplied Section 12-01 principle that the particular controls the general, alongside the text-over-illustration rule.", [], [constructionRule.sourceID], {
        ...options, requiredPatterns: [String.raw`\b(?:the\s+)?(?:more\s+)?(?:particular|specific)(?:\s+(?:rules?|provisions?|requirements?|text))?\s+(?:(?:shall|must)\s+)?(?:controls?|governs?|prevails?\s+over|takes?\s+precedence\s+over)\s+(?:the\s+)?general\b`],
        prohibitedPatterns: [String.raw`\b(?:particular|specific)(?:\s+(?:rules?|provisions?|requirements?|text))?\s+(?:does?\s+not|never|cannot)\s+(?:control|govern|prevail)\b`]
      }));
    obligations.push(obligation("construction_text_controls_illustrations", "rule_priority",
      "Explain that the supplied enacted text controls a conflicting caption, illustration, summary table or illustrative table.", [], [constructionRule.sourceID], {
        ...options, valueGroups: [["illustration", "illustrations"], ["summary table", "summary tables", "illustrative table", "illustrative tables"]],
        requiredPatterns: [String.raw`\b(?:text\b[^.;]{0,80}\b(?:controls?|governs?|prevails?|takes? precedence)|(?:give|gives|giving)\s+controlling effect to\s+(?:the\s+)?(?:enacted\s+)?text)\b`],
        prohibitedPatterns: [String.raw`\btext\b[^.;]{0,40}\b(?:does not|never|cannot)\s+(?:control|govern|prevail)\b`,
          String.raw`\b(?:not|never|cannot)\s+give controlling effect to\s+(?:the\s+)?(?:enacted\s+)?text\b`]
      }));
  }

  const spacingSource = governing.find((source) => source.sectionNumber === "23-371");
  const spacingText = sourceText(spacingSource);
  const lowerRule = spacingText.match(/minimum distance between two or more buildings on the same zoning lot that are not connected at any level shall be (\d+) feet[^.]+portions of buildings lower than (\d+) feet/i);
  const statedUpperBound = firstQuestionNumber(question, [/\b(?:below|lower than|under)\s+(\d+(?:\.\d+)?)\s*(?:feet|ft)\b/i]);
  const hasUnitCount = /\b(?:more than three|three or more|[3-9]|\d{2,})\s+dwelling units\b/i.test(question);
  const unconnected = /\b(?:do not connect|don't connect|not connected)\s+at any level\b/i.test(question);
  if (spacingSource && lowerRule && statedUpperBound !== null && statedUpperBound <= Number(lowerRule[2]) &&
      hasUnitCount && unconnected && /\bsame zoning lot\b/i.test(question)) {
    const distance = Number(lowerRule[1]), height = Number(lowerRule[2]);
    const sourceIDs = [spacingSource.sourceID];
    obligations.push(obligation("separate_buildings_lower_height_spacing", "tiered_dimension",
      `For unconnected buildings below ${height} feet, apply ${distance} feet between closest points.`,
      numberTextAlternatives(distance), sourceIDs, { requireSourceBound: true, coverageScope: "answer",
        valueGroups: [["closest points", "closest point"]] }));
    if (/provisions of this Section shall not apply to:[^.]+buildings that are separated from each other by a rear yard equivalent/i.test(spacingText)) {
      obligations.push(obligation("separate_buildings_rear_yard_equivalent_exception", "scope_exception",
        "Check the rear-yard-equivalent exception; avoid claiming it is the only exception.",
        ["rear yard equivalent", "rear-yard-equivalent"], sourceIDs, { requireSourceBound: true, coverageScope: "answer",
          requiredPatterns: [String.raw`\b(?:exception|exempt|does not apply|do not apply|inapplicable)\b`],
          prohibitedPatterns: [String.raw`\b(?:conclusion|result|answer)\s+could\s+differ\s+only\s+if\b`] }));
    }
    const proposed = firstQuestionNumber(question, [/(\d+(?:\.\d+)?)\s*(?:feet|ft)\s+apart\b/i,
      /(\d+(?:\.\d+)?)[- ](?:foot|ft)[- ](?:spacing|separation)\b/i]);
    if (proposed !== null && proposed < distance) obligations.push(obligation("separate_buildings_spacing_shortfall", "arithmetic",
      `Show the spacing shortfall: ${distance} - ${proposed} = ${Number((distance - proposed).toFixed(4))} feet.`,
      numberTextAlternatives(Number((distance - proposed).toFixed(4))), sourceIDs, { coverageScope: "answer" }));
    const upperRule = spacingText.match(/Portions of such buildings higher than (\d+) feet shall be at least (\d+) feet apart/i);
    const numberWords = { 20: "twenty", 30: "thirty", 40: "forty", 50: "fifty", 60: "sixty", 70: "seventy", 80: "eighty", 90: "ninety" };
    const upperSpacing = upperRule ? Number(upperRule[2]) : null;
    const upperValues = upperSpacing === null ? [] : [...numberTextAlternatives(upperSpacing), numberWords[upperSpacing]].filter(Boolean);
    const upperDimensionPattern = upperValues.length ? String.raw`\b(?:${upperValues.map(escapedPattern).join("|")})[-\s]*(?:feet|foot|ft)\b` : null;
    if (upperDimensionPattern && /need not exceed \d+ feet(?:, provided that| if)/i.test(spacingText)) {
      obligations.push(obligation("separate_buildings_requested_height_scope", "answer_scope",
        `Answer the below-${height}-foot scenario. If mentioning ${upperSpacing}-foot upper-height spacing, include its conditional reduction or proviso.`,
        [], sourceIDs, { requireSourceBound: true, coverageScope: "answer", qualifiedClaims: [{
          claimPattern: upperDimensionPattern,
          qualifierPattern: String.raw`\b(?:subject to (?:the )?(?:stated |applicable )?(?:proviso|exception|conditions?|conditional reduction)|provided that|may be reduced|can be reduced|need not exceed|does not apply|do not apply)\b`
        }] }));
    }
  }
  return obligations;
}

function scenarioAnswerObligations({ question, evidence = [], plan, arithmetic, facts = question, lotHistoryPremise = null }) {
  const obligations = [];
  const sourceIDs = evidence.map((source) => source?.sourceID).filter(Boolean);
  const flatEvidence = compactText(evidenceText(evidence));
  const lotArea = firstQuestionNumber(question, [
    /(\d[\d,]*(?:\.\d+)?)[- ]square-foot\s+(?:[A-Z0-9-]+\s+)?(?:zoning\s+)?lot\b/i,
    /(?:zoning\s+)?lot\s+(?:contains|has|is)\s+(\d[\d,]*(?:\.\d+)?)\s*square feet/i
  ]);
  const proposedFloorArea = firstQuestionNumber(question, [
    /(?:want|proposed(?:\s+with|\s+for)?|contains?)\s+(\d[\d,]*(?:\.\d+)?)\s*square feet of (?:residential )?floor area/i,
    /(?:want|proposed(?:\s+with|\s+for)?)\s+(\d[\d,]*(?:\.\d+)?)\s*square feet/i
  ]);
  const tableValues = tableFARValues(question, evidence);
  if (lotArea && proposedFloorArea) {
    const proposedFAR = Number((proposedFloorArea / lotArea).toFixed(4));
    obligations.push(obligation(
      "scenario_proposed_far",
      "arithmetic",
      `Show the proposed floor-area ratio: ${proposedFloorArea} / ${lotArea} = ${proposedFAR}.`,
      numberTextAlternatives(proposedFAR),
      sourceIDs
    ));
  }
  if (lotArea && tableValues) {
    const standardArea = Number((lotArea * tableValues.standardFAR).toFixed(4));
    const qualifyingArea = Number((lotArea * tableValues.qualifyingFAR).toFixed(4));
    const splitDistrictScenario = /\b(?:split|straddles|district boundary|weighted)\b/i.test(question);
    if (!splitDistrictScenario) {
      obligations.push(obligation(
        "table_standard_floor_area_ceiling",
        "table_calculation",
        `Show the ${tableValues.district} standard-residence ceiling: ${lotArea} x ${tableValues.standardFAR} = ${standardArea} square feet.`,
        numberTextAlternatives(standardArea),
        tableValues.sourceIDs
      ));
      if (/\b(?:affordable|qualifying|MIH|UAP|higher FAR|higher column)\b/i.test(question)) {
        obligations.push(obligation(
          "table_qualifying_floor_area_ceiling",
          "table_calculation",
          `Show the ${tableValues.district} qualifying-housing table ceiling: ${lotArea} x ${tableValues.qualifyingFAR} = ${qualifyingArea} square feet.`,
          numberTextAlternatives(qualifyingArea),
          tableValues.sourceIDs
        ));
      }
    }
  }
  const residentialDistrict = question.match(/\bR\d{1,2}[A-Z]?(?:-\d[A-Z]?)?\b/i)?.[0];
  if (
    lotArea && residentialDistrict && /\b(?:FAR|floor area ratio|floor area)\b/i.test(question) &&
    !tableValues
  ) {
    obligations.push(obligation(
      "residential_far_table_row_unresolved",
      "evidence_boundary",
      `The structured ZR 23-22 table row for ${residentialDistrict} and the stated geography must be resolved before calculating a residential floor-area ceiling.`,
      [],
      [],
      {
        requireSourceBound: true,
        unresolvedEvidence: true,
        requiredSourceSections: ["23-22"]
      }
    ));
  }

  const throughLotDepth = firstQuestionNumber(question, [/(\d[\d,]*(?:\.\d+)?)[- ]foot[- ]deep through lot/i]);
  const openAreaDepth = firstQuestionNumber(question, [/(\d[\d,]*(?:\.\d+)?)[- ]foot[- ]wide open area/i]);
  const buildingHeight = firstQuestionNumber(question, [/wings rise to (\d[\d,]*(?:\.\d+)?)\s*feet/i]);
  const throughLotRule = flatEvidence.match(
    /(\d+) feet or more[^.]{0,180}at or below a height of (\d+) feet[^.]{0,100}minimum depth of (\d+) feet[^.]{0,120}above a height of \2 feet[^.]{0,80}of (\d+) feet/i
  );
  if (throughLotDepth && openAreaDepth && buildingHeight && throughLotRule) {
    const standardDepthThreshold = Number(throughLotRule[1]);
    const heightTier = Number(throughLotRule[2]);
    const lowerRequiredDepth = Number(throughLotRule[3]);
    const upperRequiredDepth = Number(throughLotRule[4]);
    if (throughLotDepth >= standardDepthThreshold) {
      const lowerShortfall = Math.max(0, lowerRequiredDepth - openAreaDepth);
      const upperShortfall = Math.max(0, upperRequiredDepth - openAreaDepth);
      const upperHeight = Math.max(0, buildingHeight - heightTier);
      for (const [id, detail, value] of [
        ["through_lot_lower_tier_shortfall", `Show the lower-tier rear-yard-equivalent shortfall: ${lowerRequiredDepth} - ${openAreaDepth} = ${lowerShortfall} feet.`, lowerShortfall],
        ["through_lot_upper_tier_shortfall", `Show the upper-tier rear-yard-equivalent shortfall: ${upperRequiredDepth} - ${openAreaDepth} = ${upperShortfall} feet.`, upperShortfall],
        ["through_lot_upper_vertical_portion", `Identify the portion above ${heightTier} feet: ${buildingHeight} - ${heightTier} = ${upperHeight} feet.`, upperHeight]
      ]) obligations.push(obligation(id, "tiered_dimension", detail, numberTextAlternatives(value), sourceIDs));
      const orientationResolved = /\b(?:30[- ]foot (?:dimension|open area) (?:is|was) measured perpendicular|regulated depth (?:is|was) confirmed|depth orientation (?:is|was) confirmed)\b/i.test(facts);
      const obstructionsResolved = /\b(?:contains? no obstructions|no actual obstructions|actual obstructions (?:are|were) confirmed (?:as )?permitted|all obstructions (?:are|were) permitted)\b/i.test(facts);
      if (!orientationResolved) {
        obligations.push(obligation(
          "through_lot_regulated_depth_orientation_unresolved",
          "measurement_boundary",
          "Keep unresolved whether the supplied open-area dimension is measured in the regulated rear-yard-equivalent depth orientation.",
          [],
          sourceIDsForSections(evidence, ["23-343"]),
          {
            coverageScope: "uncertainty",
            valueGroups: [
              ["orientation", "measured perpendicular", "regulated depth"],
              ["30-foot", "30 foot", "30 feet"]
            ]
          }
        ));
      }
      if (!obstructionsResolved) {
        obligations.push(obligation(
          "through_lot_actual_permitted_obstructions_unresolved",
          "measurement_boundary",
          "Keep unresolved whether actual obstructions fit the permitted-obstruction rules.",
          [],
          sourceIDsForSections(evidence, ["23-343"]),
          {
            coverageScope: "uncertainty",
            valueGroups: [
              ["permitted obstruction", "permitted-obstruction"],
              ["whether", "verify", "confirm", "unresolved"]
            ],
            requiredPatterns: [
              "(?:\\b(?:whether|verify|confirm|unresolved)\\b[^.;]{0,120}\\b(?:actual )?obstructions?\\b|\\b(?:actual )?obstructions?\\b[^.;]{0,120}\\b(?:whether|verify|confirm|unresolved)\\b)"
            ]
          }
        ));
      }
    }
  }

  if (
    plan?.path === zoningResearchPaths.definitionCrossReference &&
    /\b(?:tax lots?|common ownership|share ownership|contigu)/i.test(question) &&
    /\(a\).*\(b\).*\(c\).*\(d\)/i.test(flatEvidence)
  ) {
    const definitionChecks = [
      ["definition_historical_branches", lotHistoryPremise?.exclusion
        ? zoningLotHistoryPrompt(lotHistoryPremise)
        : "Distinguish the historical definition branches from the current contiguity branches.",
      lotHistoryPremise?.exclusion ? [] : ["December 15, 1961"]],
      ["definition_contiguity_threshold", "State the minimum current-branch contiguity threshold.", ["10 linear feet", "10 feet"]],
      ["definition_party_or_declaration", "Identify the party-in-interest or recorded-Declaration requirements for the current branches.", ["party in interest", "Declaration"]],
      ["definition_tax_map_distinction", "Distinguish a zoning lot from a tax lot shown on the official tax map.", ["tax map", "tax lot"]]
    ];
    for (const [id, detail, values] of definitionChecks) {
      const check = obligation(id, "definition_branch", detail, values, sourceIDs);
      if (id === "definition_historical_branches") check.lotHistoryPremise = lotHistoryPremise;
      obligations.push(check);
    }
  }

  for (const calculation of arithmetic?.calculations || []) {
    if (obligations.some((item) => item.id === calculation.id)) continue;
    obligations.push(obligation(
      calculation.id,
      "arithmetic",
      `Show deterministic calculation ${calculation.display}.`,
      numberTextAlternatives(calculation.result),
      sourceIDs
    ));
  }
  return obligations.concat(observedFailureObligations({ question, evidence, plan, facts }), directRuleAnswerObligations(question, evidence));
}

export function zoningResearchDeterministicContext({
  question,
  evidence = [],
  plan,
  projectFacts = [],
  conversationFactContext = {}
} = {}) {
  const dates = unique(Array.from(compactText(question).matchAll(calendarDatePattern), (match) => match[0]));
  const structuredTables = (Array.isArray(evidence) ? evidence : [])
    .filter((source) => (Array.isArray(source?.richSourceGrids) ? source.richSourceGrids : []).some(validStructuredGrid))
    .map((source) => {
      const grids = source.richSourceGrids.filter(validStructuredGrid);
      return {
        sourceID: source.sourceID,
        contentHash: source.richSourceContentHash || stableHash(grids),
        gridHash: stableHash(grids),
        gridCount: grids.length
      };
    });
  const passages = (Array.isArray(evidence) ? evidence : []).map((source) => ({
    sourceID: source.sourceID,
    sectionID: source.sectionID,
    sectionNumber: source.sectionNumber,
    textHash: source.sectionTextHash || stableHash(sourceText(source)),
    evidenceRole: sourceRole(source),
    topicRouteRelationship: sourceRelationship(source)
  }));
  const arithmetic = plan?.deterministicControls?.arithmeticLedger
    ? arithmeticLedger(compactText(question))
    : { measurements: [], calculations: [] };
  const answerObligations = scenarioAnswerObligations({
    question: compactText(question),
    evidence,
    plan,
    arithmetic,
    lotHistoryPremise: zoningLotHistoryPremise({ question, projectFacts, conversationFactContext }),
    facts: resolvedFactText({ question, projectFacts, conversationFactContext })
  }).concat(tableLegendObligations(question, evidence), zoningTemporalApplicationObligations({
    question, evidence, facts: resolvedFactText({ question, projectFacts, conversationFactContext }),
    uncertainty: [question, ...(Array.isArray(projectFacts) ? projectFacts : []),
      ...(Array.isArray(conversationFactContext?.qualified) ? conversationFactContext.qualified : []),
      ...(Array.isArray(conversationFactContext?.unknown) ? conversationFactContext.unknown : []).map((fact) => `Unresolved: ${fact}`)]
  }));
  const context = {
    schemaVersion: 2,
    compilerVersion: zoningResearchCompilerVersion,
    plannerVersion: zoningResearchPlannerVersion,
    planHash: plan?.planHash || null,
    path: plan?.path || null,
    dates,
    arithmetic,
    answerObligations,
    structuredTables,
    passages
  };
  return { ...context, contextHash: stableHash(context) };
}

export function zoningResearchPromptContext(plan, deterministicContext) {
  if (!plan) return "";
  return [
    "ZONING QUESTION-SPECIFIC EXECUTION PLAN — SERVER GENERATED",
    `PLANNER_VERSION: ${plan.plannerVersion}`,
    `QUESTION_PATH: ${plan.path}`,
    `PLAN_HASH: ${plan.planHash}`,
    `DISPOSITION: ${plan.disposition}`,
    zoningConditionalExplanationPrompt(plan),
    `DETERMINISTIC_CONTEXT: ${JSON.stringify(deterministicContext || {})}`,
    deterministicContext?.answerObligations?.length
      ? "MANDATORY_ANSWER_OBLIGATIONS: DETERMINISTIC_CONTEXT.answerObligations"
      : "",
    "Answer only the planned question path. Treat collateral provisions as reviewed-only and do not create conclusions from them.",
    "Preserve exact table symbols, dates, arithmetic inputs, prerequisite order, passage identifiers, and source hashes supplied by the server.",
    "Cover every mandatory answer obligation explicitly in the user-facing answer and in the supported point bound to its supplied source.",
    "Do not infer property or mapped applicability. Do not rewrite an otherwise supported answer merely to add unrelated context."
  ].filter(Boolean).join("\n");
}

export function evaluateZoningEvidenceReadiness({ question, evidence = [], plan, deterministicContext = null } = {}) {
  const sources = Array.isArray(evidence) ? evidence : [];
  const issues = [];
  if (!sources.length) {
    issues.push({
      code: "GOVERNING_ZONING_EVIDENCE_MISSING",
      detail: "No enacted Zoning passage was resolved for the planned question path."
    });
  }
  if (plan?.path === zoningResearchPaths.structuredTableSymbol &&
      !sources.some((source) => (Array.isArray(source?.richSourceGrids) ? source.richSourceGrids : []).some(validStructuredGrid))) {
    issues.push({
      code: "STRUCTURED_TABLE_GRID_MISSING",
      detail: "The selected table was not resolved as a structured grid with its headers, symbols, legend, and footnotes."
    });
  }
  const asksParkingGeography = /\bparking\b/i.test(question) &&
    /\b(?:subway|transit zone|parking geography|mapped|broker)\b/i.test(question);
  const mentionsSpecialParking = sources.some((source) => /\bspecial parking areas?\b/i.test(sourceText(source)));
  const suppliesSpecialParkingRule = sources.some((source) => {
    const text = sourceText(source);
    if (!/\bspecial parking areas?\b/i.test(text)) return false;
    if (compactText(source?.sectionNumber) === "12-10" || /\bGeneral Definition\b/i.test(text)) return false;
    return /\b(?:shall|required|requirements?|percentage|percent|waiver|spaces?)\b/i.test(text) &&
      !/\b(?:means|consists of|includes)\b[^.]{0,200}\bspecial parking areas?\b/i.test(text);
  });
  if (asksParkingGeography && mentionsSpecialParking && !suppliesSpecialParkingRule) {
    issues.push({
      code: "CONTROLLING_SPECIAL_PARKING_RULE_MISSING",
      detail: "The selected evidence names special parking geography but does not supply the controlling enacted parking rule for that geography."
    });
  }
  for (const answerObligation of deterministicContext?.answerObligations || []) {
    if (answerObligation?.unresolvedEvidence === true) {
      issues.push({
        code: "CONTROLLING_OBLIGATION_EVIDENCE_UNRESOLVED",
        obligationID: answerObligation.id,
        detail: answerObligation.detail,
        requiredSourceSections: answerObligation.requiredSourceSections || []
      });
    }
    if (answerObligation?.requireSourceBound === true && !(answerObligation?.sourceIDs || []).length) {
      issues.push({
        code: "CONTROLLING_OBLIGATION_SOURCE_MISSING",
        obligationID: answerObligation.id,
        detail: `${answerObligation.detail} No controlling source identifier was resolved.`,
        requiredSourceSections: answerObligation.requiredSourceSections || []
      });
    }
  }
  return {
    schemaVersion: 1,
    pass: issues.length === 0,
    disposition: issues.length ? zoningResearchDispositions.deterministicBoundary : zoningResearchDispositions.ready,
    issues,
    requiredEvidence: issues.map((issue) => issue.detail)
  };
}

export function zoningResearchBoundaryResponse({ plan, evidenceReadiness = null } = {}) {
  const missingFacts = Array.isArray(plan?.missingFacts) ? plan.missingFacts : [];
  const evidenceIssues = Array.isArray(evidenceReadiness?.issues) ? evidenceReadiness.issues : [];
  const needed = unique([
    ...missingFacts.map((item) => item.label),
    ...evidenceIssues.map((item) => item.detail)
  ]);
  return {
    schemaVersion: 1,
    path: plan?.path || null,
    status: missingFacts.length ? "missing_project_facts" : "missing_governing_evidence",
    whatCanBeEstablished: "Permitext can preserve and cite the selected enacted material without converting it into an unsupported property or applicability conclusion.",
    cannotConclude: plan?.clarification || evidenceIssues[0]?.detail ||
      "The requested Zoning conclusion is not supported by the currently selected governing evidence.",
    needed
  };
}

const repairStopWords = new Set([
  "about", "after", "answer", "before", "between", "cannot", "conclusion", "could", "detail",
  "does", "evidence", "from", "into", "missing", "must", "only", "permitext", "question", "require",
  "required", "source", "supported", "that", "their", "there", "these", "this", "through", "under",
  "with", "without", "zoning"
]);

function repairTerms(value) {
  return unique(compactText(value).toLowerCase().match(/[a-z0-9][a-z0-9.-]{2,}/g) || [])
    .filter((term) => !repairStopWords.has(term));
}

function excerptForRepair(source, terms, maximumCharacters = 2_400) {
  const text = sourceText(source);
  if (text.length <= maximumCharacters) return text;
  const chunks = text.split(/(?<=[.;:])\s+|\n+/).map(compactText).filter(Boolean);
  const scored = chunks.map((chunk, index) => ({
    chunk,
    index,
    score: terms.reduce((total, term) => total + (chunk.toLowerCase().includes(term) ? 1 : 0), 0)
  })).sort((left, right) => right.score - left.score || left.index - right.index);
  const selected = [];
  let characters = 0;
  for (const entry of scored) {
    if (selected.length && entry.score === 0) continue;
    if (characters + entry.chunk.length + 2 > maximumCharacters) continue;
    selected.push(entry);
    characters += entry.chunk.length + 2;
  }
  if (!selected.length) return text.slice(0, maximumCharacters);
  return selected.sort((left, right) => left.index - right.index).map((entry) => entry.chunk).join("\n");
}

export function zoningResearchRepairPacket({
  question,
  issues = [],
  evidence = [],
  answer = {},
  deterministicContext = null,
  maximumSources = 5,
  maximumCharacters = 8_000
} = {}) {
  const values = Array.isArray(evidence) ? evidence : [];
  const issueText = (Array.isArray(issues) ? issues : []).map((issue) =>
    `${issue?.type || issue?.code || ""} ${issue?.detail || ""}`
  ).join(" ");
  const obligationText = (deterministicContext?.answerObligations || [])
    .map((item) => `${item.id} ${item.detail}`)
    .join(" ");
  const terms = repairTerms(`${question} ${issueText} ${obligationText}`);
  const citedIDs = new Set(proposedCitationIDs(answer));
  const issueSourceIDs = new Set((deterministicContext?.answerObligations || [])
    .filter((item) => issueText.includes(item.id) || issueText.includes(item.detail))
    .flatMap((item) => item.sourceIDs || []));
  const scored = values.map((source, index) => {
    const text = sourceText(source).toLowerCase();
    const sourceID = String(source?.sourceID || "");
    let score = terms.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0);
    if (issueText.includes(sourceID) || issueSourceIDs.has(sourceID)) score += 1_000;
    if (citedIDs.has(sourceID)) score += 100;
    if (sourceRole(source) === "governing") score += 50;
    if (source?.evidencePriority?.claimCoverageRequired === true) score += 25;
    // A requested amendment index is an atomic evidence record. Reserve it
    // before excerpting ordinary passages, so a repair cannot lose unaffected
    // events merely because their descriptions scored below other sentences.
    if (source.richSourceKind === "amendment-history") score += 10_000;
    return { source, sourceID, index, score };
  }).sort((left, right) => right.score - left.score || left.index - right.index);
  const sources = [];
  const incompleteAtomicSources = [];
  let characters = 0;
  for (const entry of scored) {
    if (sources.length >= maximumSources) break;
    const remaining = maximumCharacters - characters;
    if (remaining <= 0) break;
    const atomicMetadata = entry.source.richSourceKind === "amendment-history";
    const suppliedText = String(entry.source.text || entry.source.selectedText || entry.source.userSelectedText || "").trim();
    if (atomicMetadata && suppliedText.length > remaining) {
      incompleteAtomicSources.push({ sourceID: entry.sourceID, requiredCharacters: suppliedText.length });
      continue;
    }
    const text = atomicMetadata ? suppliedText : excerptForRepair(entry.source, terms, Math.min(2_400, remaining));
    if (!text) continue;
    sources.push({
      sourceID: entry.sourceID,
      sectionID: String(entry.source?.sectionID || ""),
      codePrefix: compactText(entry.source?.codePrefix),
      sectionNumber: compactText(entry.source?.sectionNumber),
      evidenceRole: sourceRole(entry.source),
      authorityClass: atomicMetadata ? "official_metadata" : entry.source.authorityClass || "enacted",
      codeEdition: compactText(entry.source.codeEdition),
      codeVersion: compactText(entry.source.codeVersion),
      applicabilityStatus: compactText(entry.source.applicabilityStatus),
      ...(atomicMetadata ? { richSourceKind: "amendment-history",
        metadataCurrentness: entry.source.metadataCurrentness || "not_refreshed_in_this_turn" } : {}),
      completeSuppliedPassage: compactText(text) === sourceText(entry.source),
      text,
      textHash: stableHash(text)
    });
    characters += text.length;
  }
  for (const source of values.filter((source) => source.richSourceKind === "amendment-history")) {
    if (!sources.some((item) => item.sourceID === source.sourceID) &&
      !incompleteAtomicSources.some((item) => item.sourceID === source.sourceID)) {
      incompleteAtomicSources.push({ sourceID: source.sourceID, requiredCharacters: String(source.text || "").trim().length });
    }
  }
  const packet = {
    schemaVersion: 1,
    repairVersion: zoningResearchRepairVersion,
    question: compactText(question),
    issues: (Array.isArray(issues) ? issues : []).map((issue) => ({
      type: compactText(issue?.type || issue?.code || "zoning_repair"),
      detail: compactText(issue?.detail)
    })),
    answerObligations: deterministicContext?.answerObligations || [],
    incompleteAtomicSources,
    sources,
    usage: { sourceCount: sources.length, characterCount: characters, maximumCharacters }
  };
  return { ...packet, packetHash: stableHash(packet) };
}

function patchedList(current, additions, removals) {
  const removed = new Set((Array.isArray(removals) ? removals : []).map(compactText));
  return unique([
    ...(Array.isArray(current) ? current : []).map(compactText).filter((item) => !removed.has(item)),
    ...(Array.isArray(additions) ? additions : []).map(compactText)
  ]);
}

function patchedIndexedRecords(current, upserts, removals) {
  const output = structuredClone(Array.isArray(current) ? current : []);
  const indexes = Array.from(new Set((Array.isArray(removals) ? removals : [])
    .map(Number)
    .filter((index) => Number.isSafeInteger(index) && index >= 0)))
    .sort((left, right) => right - left);
  for (const index of indexes) {
    if (index < output.length) output.splice(index, 1);
  }
  for (const upsert of Array.isArray(upserts) ? upserts : []) {
    const targetIndex = upsert?.targetIndex;
    const value = structuredClone(upsert?.value);
    if (!value || typeof value !== "object") continue;
    if (Number.isSafeInteger(targetIndex) && targetIndex >= 0 && targetIndex < output.length) {
      output[targetIndex] = value;
    } else {
      output.push(value);
    }
  }
  return output;
}

export function applyZoningResearchRepairPatch(answer = {}, patch = {}) {
  const answerText = String(patch?.answerText || "").trim();
  if (!answerText) {
    const error = new Error("A Zoning repair patch must provide the corrected user-facing answer text.");
    error.code = "INVALID_ZONING_REPAIR_PATCH";
    throw error;
  }
  return {
    ...structuredClone(answer),
    answerText,
    conclusion: answerText,
    explanation: "",
    supportedPoints: patchedIndexedRecords(
      answer?.supportedPoints,
      patch?.supportedPointUpserts,
      patch?.supportedPointRemovals
    ),
    citations: patchedIndexedRecords(answer?.citations, patch?.citationUpserts, patch?.citationRemovals),
    missingFacts: patchedList(answer?.missingFacts, patch?.missingFactsAdd, patch?.missingFactsRemove),
    evidenceLimitations: patchedList(
      answer?.evidenceLimitations,
      patch?.evidenceLimitationsAdd,
      patch?.evidenceLimitationsRemove
    ),
    additionalEvidenceNeeded: patchedList(
      answer?.additionalEvidenceNeeded,
      patch?.additionalEvidenceNeededAdd,
      patch?.additionalEvidenceNeededRemove
    )
  };
}

function proposedAnswerText(answer) {
  return compactText([
    answer?.answerText,
    answer?.conclusion,
    answer?.explanation,
    ...(Array.isArray(answer?.supportedPoints)
      ? answer.supportedPoints.flatMap((point) => [point?.heading, point?.explanation])
      : [])
  ].filter(Boolean).join(" "));
}

function proposedPrimaryAnswerText(answer) {
  return compactText([
    answer?.answerText,
    answer?.conclusion,
    answer?.explanation
  ].filter(Boolean).join(" "));
}

function proposedUncertaintyText(answer) {
  return compactText([
    ...(Array.isArray(answer?.assumptions) ? answer.assumptions : []),
    ...(Array.isArray(answer?.missingFacts) ? answer.missingFacts : []),
    ...(Array.isArray(answer?.followUpQuestions) ? answer.followUpQuestions : []),
    ...(Array.isArray(answer?.evidenceLimitations) ? answer.evidenceLimitations : []),
    ...(Array.isArray(answer?.additionalEvidenceNeeded) ? answer.additionalEvidenceNeeded : [])
  ].filter(Boolean).join(" "));
}

function escapedPattern(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function textContainsObligationValue(text, value) {
  // Normalize only hyphens inside words. Numeric ranges, minus signs and
  // section references remain exact; shallow-lot and shallow lot are equivalent.
  const normalizedWords = (value) => compactText(value).replace(/(?<=\p{L})[-\u2010\u2011](?=\p{L})/gu, " ");
  const expected = normalizedWords(value);
  if (!expected) return false;
  const leftBoundary = /^[A-Za-z0-9]/.test(expected) ? "(?<![A-Za-z0-9])" : "";
  const rightBoundary = /[A-Za-z0-9]$/.test(expected) ? "(?![A-Za-z0-9])" : "";
  return new RegExp(`${leftBoundary}${escapedPattern(expected)}${rightBoundary}`, "i").test(normalizedWords(text));
}

function obligationCoveredByText(answerObligation, text) {
  const values = Array.isArray(answerObligation?.values) ? answerObligation.values : [];
  const valueGroups = Array.isArray(answerObligation?.valueGroups) ? answerObligation.valueGroups : [];
  const valuesCovered = !values.length || (answerObligation?.requireAllValues
    ? values.every((value) => textContainsObligationValue(text, value))
    : values.some((value) => textContainsObligationValue(text, value)));
  const groupsCovered = valueGroups.every((group) =>
    group.some((value) => textContainsObligationValue(text, value))
  );
  const normalizedText = compactText(text);
  const patternsCovered = (answerObligation?.requiredPatterns || []).every((pattern) => {
    const expression = new RegExp(pattern, "ig");
    for (const match of normalizedText.matchAll(expression)) {
      if (answerObligation?.affirmativeRequiredPatterns !== true) return true;
      const prefix = normalizedText.slice(Math.max(0, (match.index || 0) - 160), match.index || 0);
      const clausePrefix = prefix.split(/[.;!?]/).at(-1) || "";
      const matchedText = match[0] || "";
      const negatedInMatch = /\b(?:not|never)\b[^.;]{0,40}\brequired\b/i.test(matchedText);
      const negatedInPrefix = /(?:\b(?:false|untrue|not true|not the case)\s+that|\b(?:wrong|incorrect|inaccurate)\s+to\s+(?:say|state|conclude|claim)\s+that|\b(?:cannot|can't|could not|couldn't|would not|wouldn't|should not|shouldn't)\s+(?:say|state|conclude|claim)\s+that|\bno\s+(?:basis|grounds)\s+to\s+(?:say|state|conclude|claim)\s+that)\s*$/i.test(clausePrefix);
      if (!negatedInMatch && !negatedInPrefix) return true;
    }
    return false;
  });
  return valuesCovered && groupsCovered && patternsCovered;
}

function prohibitedPatternDetected(pattern, text) {
  const expression = new RegExp(pattern, "ig");
  for (const match of compactText(text).matchAll(expression)) {
    const prefix = compactText(text).slice(Math.max(0, (match.index || 0) - 80), match.index || 0);
    const quotedNegation = `${prefix} ${match[0]}`;
    if (/\b(?:wrong|incorrect|inaccurate) to say\b|\bdoes not (?:mean|establish)\b|\bnot true that\b/i.test(quotedNegation)) {
      continue;
    }
    return true;
  }
  return false;
}

function proposedCitationIDs(answer) {
  return unique((Array.isArray(answer?.citations) ? answer.citations : [])
    .flatMap((citation) => citation?.sourceIDs || []));
}

function numericComparisonIssues(answerObligation, text) {
  const comparison = answerObligation.numericComparison;
  if (!comparison || comparison.unit !== "square feet") return [];
  const normalized = text.replace(/\*\*/g, "");
  const number = String.raw`(\d[\d,]*(?:\.\d+)?)`;
  const area = String.raw`(?:square\s+(?:feet|foot)|sq\.?\s*ft\.?|ft²)`;
  const equality = new RegExp(String.raw`\b(?:the\s+)?proposed\s+${number}\s*${area}\s+(?:is|equals|is\s+equal\s+to)\s+${number}\s*${area}(?=\s|[),.;:!?]|$)`, "gi");
  for (const match of normalized.matchAll(equality)) {
    const proposed = numericValue(match[1]), described = numericValue(match[2]);
    if (proposed !== comparison.proposedQuantity) continue;
    // Do not mistake a quantity inside a subtraction expression for its whole
    // left-hand side. Other arithmetic remains subject to semantic review.
    const prefix = normalized.slice(0, match.index).split(/[;.!?]\s+/).at(-1);
    if (/\b(?:minus|subtract(?:ing|ed)?)\b|[\d)]\s*[-−+×÷]\s*$/i.test(prefix)) continue;
    const tail = normalized.slice(match.index + match[0].length);
    const relative = tail.match(/^\s*(?:\([^)]*\)\s*)?(over|above|below|under|short\s+of|more\s+than|greater\s+than|less\s+than)\b/i)?.[1];
    const relationshipMatches = relative &&
      described === Math.abs(comparison.difference) &&
      (comparison.difference > 0 ? /^(?:over|above|more|greater)/i.test(relative) : /^(?:below|under|short|less)/i.test(relative));
    if ((!relative && proposed === described) || relationshipMatches) continue;
    return [{ code: "NUMERIC_QUANTITIES_CONFLATED", obligationID: answerObligation.id,
      sourceIDs: answerObligation.sourceIDs || [],
      detail: `Keep the proposed ${comparison.proposedQuantity} square feet (${comparison.proposedPercent} percent) separate from the ${Math.abs(comparison.difference)}-square-foot difference from the ${comparison.maximumQuantity}-square-foot cap. Do not equate unequal quantities or give the difference the wrong direction.` }];
  }
  return [];
}

export function evaluateZoningDeterministicControls({
  plan,
  deterministicContext,
  answer = {},
  providerRequestCount = 0
} = {}) {
  const text = proposedAnswerText(answer);
  const primaryText = proposedPrimaryAnswerText(answer);
  const uncertaintyText = proposedUncertaintyText(answer);
  const citationIDs = new Set(proposedCitationIDs(answer));
  const supportedPoints = (Array.isArray(answer?.supportedPoints) ? answer.supportedPoints : []).map((point) => ({
    text: compactText([point?.heading, point?.explanation].filter(Boolean).join(" ")),
    sourceIDs: new Set((Array.isArray(point?.sourceIDs) ? point.sourceIDs : []).map(String))
  }));
  const issues = zoningConditionalExplanationIssues({ plan, answer });
  if (
    plan?.disposition !== zoningResearchDispositions.ready && !isZoningConditionalExplanation(plan) &&
    Number(providerRequestCount) > 0
  ) {
    issues.push({
      code: "MODEL_CALLED_WITH_MISSING_PREREQUISITES",
      detail: "A Zoning model request was attempted before required facts were established."
    });
  }
  if (isZoningConditionalExplanation(plan) && Number(providerRequestCount) > plan.callPolicy.maximumProviderCalls) {
    issues.push({ code: "CONDITIONAL_PROVIDER_CALL_LIMIT_EXCEEDED", detail: "A conditional explanation permits only one draft and one verification request." });
  }
  if (plan?.deterministicControls?.effectiveDateEventBinding) {
    for (const date of deterministicContext?.dates || []) {
      if (!text.includes(date)) {
        issues.push({
          code: "EFFECTIVE_DATE_NOT_BOUND",
          detail: `The answer does not preserve the material question date ${date}.`
        });
      }
    }
  }
  if (plan?.deterministicControls?.tableGridAndLegend) {
    if (!(deterministicContext?.structuredTables || []).length) {
      issues.push({
        code: "STRUCTURED_TABLE_NOT_RESOLVED",
        detail: "The planned table answer has no server-resolved structured grid."
      });
    }
    for (const table of deterministicContext?.structuredTables || []) {
      if (!citationIDs.has(table.sourceID)) {
        issues.push({
          code: "STRUCTURED_TABLE_NOT_CITED",
          detail: `The answer does not cite structured table source ${table.sourceID}.`
        });
      }
    }
  }
  if (plan?.deterministicControls?.arithmeticLedger) {
    for (const calculation of deterministicContext?.arithmetic?.calculations || []) {
      const alternatives = unique([
        String(calculation.result),
        Number(calculation.result).toFixed(2),
        `${Number(calculation.result * 100).toFixed(0)}%`
      ]);
      if (!alternatives.some((value) => text.includes(value))) {
        issues.push({
          code: "ARITHMETIC_RESULT_NOT_SHOWN",
          detail: `The answer does not show deterministic calculation ${calculation.display}.`
        });
      }
    }
  }
  for (const answerObligation of deterministicContext?.answerObligations || []) {
    issues.push(...numericComparisonIssues(answerObligation, text));
    const scopeText = answerObligation?.coverageScope === "uncertainty"
      ? compactText(`${primaryText} ${uncertaintyText}`)
      : answerObligation?.coverageScope === "answer"
        ? primaryText
        : text;
    issues.push(...zoningTemporalApplicationIssues({ obligation: answerObligation, answer }));
    issues.push(...zoningLotHistoryApplicationIssues({ premise: answerObligation.lotHistoryPremise, answer }));
    const covered = obligationCoveredByText(answerObligation, scopeText);
    if (!covered) {
      issues.push({
        code: "ANSWER_OBLIGATION_NOT_COVERED",
        obligationID: answerObligation.id,
        sourceIDs: answerObligation.sourceIDs || [],
        detail: answerObligation.detail
      });
    }
    const allowedSourceIDs = new Set((answerObligation?.sourceIDs || []).map(String));
    if (answerObligation?.unresolvedEvidence === true) {
      issues.push({
        code: "ANSWER_OBLIGATION_EVIDENCE_UNRESOLVED",
        obligationID: answerObligation.id,
        sourceIDs: answerObligation.sourceIDs || [],
        detail: answerObligation.detail
      });
    }
    if (answerObligation?.requireSourceBound === true && !allowedSourceIDs.size) {
      issues.push({
        code: "ANSWER_OBLIGATION_SOURCE_UNRESOLVED",
        obligationID: answerObligation.id,
        sourceIDs: [],
        detail: `${answerObligation.detail} No controlling source identifier was resolved.`
      });
    }
    if (covered && answerObligation?.requireSourceBound === true && allowedSourceIDs.size) {
      const sourceBound = supportedPoints.some((point) =>
        obligationCoveredByText(answerObligation, point.text) &&
        point.sourceIDs.size > 0 &&
        Array.from(point.sourceIDs).every((sourceID) => allowedSourceIDs.has(sourceID))
      );
      if (!sourceBound) {
        issues.push({
          code: "ANSWER_OBLIGATION_SOURCE_NOT_BOUND",
          obligationID: answerObligation.id,
          sourceIDs: answerObligation.sourceIDs || [],
          detail: `${answerObligation.detail} The matching supported point is not bound to the controlling source.`
        });
      }
    }
    if (answerObligation?.rejectMisboundCoverage === true && allowedSourceIDs.size) {
      const misbound = supportedPoints.some((point) =>
        obligationCoveredByText(answerObligation, point.text) &&
        point.sourceIDs.size > 0 &&
        Array.from(point.sourceIDs).some((sourceID) => !allowedSourceIDs.has(sourceID))
      );
      if (misbound) {
        issues.push({
          code: "ANSWER_OBLIGATION_SOURCE_MISBOUND",
          obligationID: answerObligation.id,
          sourceIDs: answerObligation.sourceIDs || [],
          detail: `${answerObligation.detail} A supported point assigns that proposition to a different source.`
        });
      }
    }
    for (const pattern of answerObligation?.prohibitedPatterns || []) {
      if (!prohibitedPatternDetected(pattern, text)) continue;
      issues.push({
        code: "ANSWER_OBLIGATION_CONTRADICTED",
        obligationID: answerObligation.id,
        sourceIDs: answerObligation.sourceIDs || [],
        detail: answerObligation.detail
      });
      break;
    }
    for (const claim of answerObligation?.qualifiedClaims || []) {
      // Check the main explanation and each supported point independently:
      // a qualification buried in a different point cannot qualify a claim.
      const units = [answer?.answerText, answer?.conclusion, answer?.explanation, ...supportedPoints.map((point) => point.text)]
        .filter(Boolean).flatMap((unit) => String(unit).split(/\n\s*\n/)).map(compactText);
      const unqualified = units.some((unit) => {
        if (!new RegExp(claim.claimPattern, "i").test(unit)) return false;
        return !Array.from(unit.matchAll(new RegExp(claim.qualifierPattern, "ig"))).some((match) =>
          !/\b(?:not|never|without)\s+(?:(?:be|being)\s+)?$/i.test(unit.slice(0, match.index)));
      });
      if (unqualified) issues.push({
        code: "ANSWER_OBLIGATION_QUALIFICATION_MISSING",
        obligationID: answerObligation.id,
        sourceIDs: answerObligation.sourceIDs || [],
        detail: answerObligation.detail
      });
    }
  }
  const deduplicated = [];
  const seen = new Set();
  for (const issue of issues) {
    const identity = `${issue.code}\u0000${issue.obligationID || ""}\u0000${issue.detail}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    deduplicated.push(issue);
  }
  return {
    schemaVersion: 2,
    plannerVersion: zoningResearchPlannerVersion,
    compilerVersion: zoningResearchCompilerVersion,
    pass: deduplicated.length === 0,
    issues: deduplicated
  };
}

export function zoningResearchPlanCostProjection({
  plan,
  evidenceCharacters = 0,
  sharedPromptCharacters = 8_000,
  answerOutputTokens = 900,
  verifierOutputTokens = 350,
  adverseInputMultiplier = 1.35,
  adverseOutputMultiplier = 1.35,
  pricing = {}
} = {}) {
  const rates = {
    fast: {
      input: Number(pricing.fastInput ?? 0.20),
      cachedInput: Number(pricing.fastCachedInput ?? 0.02),
      output: Number(pricing.fastOutput ?? 1.20)
    },
    accurate: {
      input: Number(pricing.accurateInput ?? 2.00),
      cachedInput: Number(pricing.accurateCachedInput ?? 0.20),
      output: Number(pricing.accurateOutput ?? 12.00)
    }
  };
  const estimatedTokens = (characters) => Math.ceil((Math.max(0, characters) / 4) * 1.25);
  const requestInputTokens = estimatedTokens(sharedPromptCharacters + evidenceCharacters);
  const nominalCalls = [];
  if ((plan?.callPolicy?.maximumProviderCalls || 0) > 0) {
    nominalCalls.push({
      stage: "answer",
      ledger: "production",
      tier: plan?.callPolicy?.initialTier === "accurate" ? "accurate" : "fast",
      inputTokens: requestInputTokens,
      outputTokens: answerOutputTokens
    });
  }
  if (plan?.callPolicy?.subjectiveVerification && (plan?.callPolicy?.maximumProviderCalls || 0) > 1) {
    nominalCalls.push({
      stage: "verification",
      ledger: "production",
      tier: "fast",
      inputTokens: requestInputTokens,
      outputTokens: verifierOutputTokens
    });
  }
  const repairCall = plan?.callPolicy?.repairEligible
    ? {
        stage: "source_bounded_repair",
        ledger: "production",
        tier: "accurate",
        inputTokens: estimatedTokens(3_000 + Math.min(8_000, evidenceCharacters)),
        outputTokens: 900
      }
    : null;
  const adverseCalls = repairCall ? [...nominalCalls, repairCall] : nominalCalls;
  const cost = (call, adverse = false) => {
    const rate = rates[call.tier];
    const input = Math.ceil(call.inputTokens * (adverse ? adverseInputMultiplier : 1));
    const output = Math.ceil(call.outputTokens * (adverse ? adverseOutputMultiplier : 1));
    return (input * rate.input + output * rate.output) / 1_000_000;
  };
  const productionNominalUSD = nominalCalls.reduce((sum, call) => sum + cost(call), 0);
  const productionAdverseUSD = adverseCalls.reduce((sum, call) => sum + cost(call, true), 0);
  return {
    schemaVersion: 2,
    pricing: rates,
    tokenEstimator: "ceil(bytes/4*1.25)",
    calls: adverseCalls,
    nominalCalls,
    adverseCalls,
    production: {
      requestCount: nominalCalls.length,
      nominalRequestCount: nominalCalls.length,
      adverseRequestCount: adverseCalls.length,
      nominalUSD: Number(productionNominalUSD.toFixed(6)),
      adverseUSD: Number(productionAdverseUSD.toFixed(6))
    },
    judge: {
      requestCount: 0,
      nominalUSD: 0,
      adverseUSD: 0
    }
  };
}
