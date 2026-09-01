import { createHash } from "node:crypto";

export const zoningResearchPlannerVersion = "20260901-question-path-v1";

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
    maximumDiscovered: 3,
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
    maximumCharacters: 10_000,
    maximumSupplementalCharacters: 8_000,
    maximumCharactersPerSource: 6_000
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
    maximumTargetedDefinitions: 1,
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

function combinedFactText({ question, projectFacts = [], conversationFactContext = {} } = {}) {
  return compactText([
    question,
    ...(Array.isArray(projectFacts) ? projectFacts : []),
    ...(Array.isArray(conversationFactContext?.established) ? conversationFactContext.established : []),
    ...(Array.isArray(conversationFactContext?.hypothetical) ? conversationFactContext.hypothetical : []),
    ...(Array.isArray(conversationFactContext?.unknown) ? conversationFactContext.unknown : [])
  ].filter(Boolean).join(" "));
}

function questionPath(question) {
  const value = compactText(question);
  const propertyOrMap = /\b(?:address|BBL|mapped zoning district|mapped district|Appendix [A-Z].*(?:map|location)|map and location|specific property|broker says .*subway|unverified transit zone|MIH.*(?:established|historical zoning lot|tax lots? were combined))\b/i.test(value);
  const effectiveOrHistory = /\b(?:amendment history|historical|text in force|effective date|transition|continuation|grandfather|vested|certificate of occupancy|issued (?:before|after)|filed .*\b(?:before|after|on)\b|existed on|December \d|November \d|City of Yes)\b/i.test(value);
  const table = /\b(?:selected table|height-and-setback table|table symbols?|table footnotes?|legend|blank cell|asterisk|dagger)\b/i.test(value) &&
    !/\bconflict between\b/i.test(value);
  const definition = /\b(?:definition|defined|what (?:is|constitutes)|tax lots?.*one zoning lot|treated as one zoning lot|below-grade.*(?:floor area|base plane)|straddles two zoning districts|Section 77-11)\b/i.test(value);
  const calculation = /\b(?:calculate|calculation|how many|how much|FAR|floor area ratio|lot[- ]coverage|percent|percentage|weighted|combine them|fit the .*maximum|maximum permitted|open area enough|rear yard equivalent|enlargement|units allowed|recreation space)\b/i.test(value) &&
    /\d/.test(value);

  if (propertyOrMap) return zoningResearchPaths.propertyMapApplicability;
  if (effectiveOrHistory) return zoningResearchPaths.effectiveDateHistory;
  if (table) return zoningResearchPaths.structuredTableSymbol;
  if (definition) return zoningResearchPaths.definitionCrossReference;
  if (calculation) return zoningResearchPaths.calculationScenario;
  return zoningResearchPaths.directRule;
}

function factRequirements(path, facts, question) {
  const requirements = [];
  if (path === zoningResearchPaths.propertyMapApplicability) {
    const asksSourceBoundary = /\bwhat can .* establish\b|\bwhat .*cannot be made\b|\bwithout identifying\b/i.test(question);
    const historicMIHLot = /\bMIH\b|Mandatory Inclusionary Housing/i.test(question) &&
      /\b(?:established in|date of establishment|combined in|historical zoning lot|small[- ]development exception)\b/i.test(question);
    const needsMappedDistrict = /\b(?:mapped zoning district|mapped district|transit zone|Appendix [A-Z]|subarea|specific property|self-service storage)\b/i.test(question);
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
    if (needsMappedDistrict && !mappedStatusPresent) {
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
  if (path === zoningResearchPaths.effectiveDateHistory) {
    if (/\b(?:determine|reconstruct) (?:the )?(?:text|rules?) in force|what (?:did|was) .* (?:require|allow) on\b/i.test(question) &&
        !/\b(?:official archived|dated enacted)\b/i.test(facts)) {
      requirements.push({
        id: "dated_substantive_text",
        label: "dated enacted or official archived substantive text",
        present: false,
        reason: "Amendment metadata and transition text do not reconstruct the prior substantive rule."
      });
    }
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
  const subjectiveVerification = [
    zoningResearchPaths.structuredTableSymbol,
    zoningResearchPaths.effectiveDateHistory
  ].includes(path);
  const maximumProviderCalls = disposition === zoningResearchDispositions.ready
    ? subjectiveVerification ? 2 : 1
    : 0;
  const clarification = missingFacts.length
    ? `Before Permitext can make the requested Zoning conclusion, provide ${missingFacts.map((item) => item.label).join(" and ")}.`
    : null;
  const plan = {
    schemaVersion: 1,
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
      effectiveDateEventBinding: path === zoningResearchPaths.effectiveDateHistory,
      arithmeticLedger: path === zoningResearchPaths.calculationScenario,
      propertyAndMapPrerequisites: path === zoningResearchPaths.propertyMapApplicability
    },
    callPolicy: {
      initialTier: "fast",
      initialModelRole: "luna_first",
      subjectiveVerification,
      verifierTier: subjectiveVerification ? "fast" : null,
      maximumProviderCalls,
      allowFullAnswerRewrite: false,
      terraEscalation: "provider_failure_or_separately_authorized_narrow_repair_only"
    },
    questionSignals: {
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
  const number = Number(String(value || "").replace(/,/g, ""));
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
  const affordableShare = question.match(
    /(\d[\d,]*(?:\.\d+)?)\s*square feet of (?:residential )?floor area[^.]{0,100}\bincluding\s+(\d[\d,]*(?:\.\d+)?)\s*square feet[^.]{0,40}\baffordable/i
  );
  if (affordableShare) addRatio("affordable_floor_area_share", affordableShare[2], affordableShare[1], "percentage");
  return { measurements, calculations };
}

export function zoningResearchDeterministicContext({ question, evidence = [], plan } = {}) {
  const dates = unique(Array.from(compactText(question).matchAll(calendarDatePattern), (match) => match[0]));
  const structuredTables = (Array.isArray(evidence) ? evidence : [])
    .filter((source) => Array.isArray(source?.richSourceGrids) && source.richSourceGrids.length > 0)
    .map((source) => ({
      sourceID: source.sourceID,
      contentHash: source.richSourceContentHash || stableHash(source.richSourceGrids),
      gridHash: stableHash(source.richSourceGrids),
      gridCount: source.richSourceGrids.length
    }));
  const passages = (Array.isArray(evidence) ? evidence : []).map((source) => ({
    sourceID: source.sourceID,
    sectionID: source.sectionID,
    sectionNumber: source.sectionNumber,
    textHash: source.sectionTextHash || stableHash(sourceText(source)),
    evidenceRole: sourceRole(source),
    topicRouteRelationship: sourceRelationship(source)
  }));
  const context = {
    schemaVersion: 1,
    plannerVersion: zoningResearchPlannerVersion,
    planHash: plan?.planHash || null,
    path: plan?.path || null,
    dates,
    arithmetic: plan?.deterministicControls?.arithmeticLedger
      ? arithmeticLedger(compactText(question))
      : { measurements: [], calculations: [] },
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
    `DETERMINISTIC_CONTEXT: ${JSON.stringify(deterministicContext || {})}`,
    "Answer only the planned question path. Treat collateral provisions as reviewed-only and do not create conclusions from them.",
    "Preserve exact table symbols, dates, arithmetic inputs, prerequisite order, passage identifiers, and source hashes supplied by the server.",
    "Do not infer property or mapped applicability. Do not rewrite an otherwise supported answer merely to add unrelated context."
  ].join("\n");
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

function proposedCitationIDs(answer) {
  return unique((Array.isArray(answer?.citations) ? answer.citations : [])
    .flatMap((citation) => citation?.sourceIDs || []));
}

export function evaluateZoningDeterministicControls({
  plan,
  deterministicContext,
  answer = {},
  providerRequestCount = 0
} = {}) {
  const text = proposedAnswerText(answer);
  const citationIDs = new Set(proposedCitationIDs(answer));
  const issues = [];
  if (
    plan?.disposition !== zoningResearchDispositions.ready &&
    Number(providerRequestCount) > 0
  ) {
    issues.push({
      code: "MODEL_CALLED_WITH_MISSING_PREREQUISITES",
      detail: "A Zoning model request was attempted before required facts were established."
    });
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
  return {
    schemaVersion: 1,
    plannerVersion: zoningResearchPlannerVersion,
    pass: issues.length === 0,
    issues
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
  const calls = [];
  if ((plan?.callPolicy?.maximumProviderCalls || 0) > 0) {
    calls.push({ stage: "answer", ledger: "production", tier: "fast", inputTokens: requestInputTokens, outputTokens: answerOutputTokens });
  }
  if (plan?.callPolicy?.subjectiveVerification && (plan?.callPolicy?.maximumProviderCalls || 0) > 1) {
    calls.push({ stage: "verification", ledger: "production", tier: "fast", inputTokens: requestInputTokens, outputTokens: verifierOutputTokens });
  }
  const cost = (call, adverse = false) => {
    const rate = rates[call.tier];
    const input = Math.ceil(call.inputTokens * (adverse ? adverseInputMultiplier : 1));
    const output = Math.ceil(call.outputTokens * (adverse ? adverseOutputMultiplier : 1));
    return (input * rate.input + output * rate.output) / 1_000_000;
  };
  const productionNominalUSD = calls.reduce((sum, call) => sum + cost(call), 0);
  const productionAdverseUSD = calls.reduce((sum, call) => sum + cost(call, true), 0);
  return {
    schemaVersion: 1,
    pricing: rates,
    tokenEstimator: "ceil(bytes/4*1.25)",
    calls,
    production: {
      requestCount: calls.length,
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
