import { createHash } from "node:crypto";

export const zoningResearchPlannerVersion = "20260901-question-compiler-v2";

export const zoningResearchCompilerVersion = "20260901-answer-obligations-v2";
export const zoningResearchRepairVersion = "20260901-source-bounded-patch-v2";

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
      effectiveDateEventBinding: path === zoningResearchPaths.effectiveDateHistory,
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

function tableFARValues(question, evidence) {
  const district = questionDistrict(question);
  if (!district) return null;
  for (const source of Array.isArray(evidence) ? evidence : []) {
    const tokens = compactText(sourceText(source)).split(" ");
    const index = tokens.findIndex((token) => token.toUpperCase() === district);
    if (index < 0) continue;
    const values = tokens.slice(index + 1, index + 16)
      .map((token) => token.replace(/[^0-9.]/g, ""))
      .filter((token) => /^\d+\.\d+$/.test(token))
      .map(Number);
    if (values.length < 2) continue;
    return {
      district,
      standardFAR: values[0],
      qualifyingFAR: values[1],
      sourceIDs: [source.sourceID].filter(Boolean)
    };
  }
  return null;
}

function obligation(id, kind, detail, values = [], sourceIDs = [], options = {}) {
  return {
    id,
    kind,
    detail,
    values: unique(values.map((value) => compactText(value))),
    sourceIDs: unique(sourceIDs.map(String)),
    requireAllValues: options.requireAllValues === true
  };
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

function scenarioAnswerObligations({ question, evidence = [], plan, arithmetic }) {
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
    }
  }

  if (
    plan?.path === zoningResearchPaths.definitionCrossReference &&
    /\b(?:tax lots?|common ownership|share ownership|contigu)/i.test(question) &&
    /\(a\).*\(b\).*\(c\).*\(d\)/i.test(flatEvidence)
  ) {
    const definitionChecks = [
      ["definition_historical_branches", "Distinguish the historical definition branches from the current contiguity branches.", ["December 15, 1961"]],
      ["definition_contiguity_threshold", "State the minimum current-branch contiguity threshold.", ["10 linear feet", "10 feet"]],
      ["definition_party_or_declaration", "Identify the party-in-interest or recorded-Declaration requirements for the current branches.", ["party in interest", "Declaration"]],
      ["definition_tax_map_distinction", "Distinguish a zoning lot from a tax lot shown on the official tax map.", ["tax map", "tax lot"]]
    ];
    for (const [id, detail, values] of definitionChecks) {
      obligations.push(obligation(id, "definition_branch", detail, values, sourceIDs));
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
  return obligations;
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
  const arithmetic = plan?.deterministicControls?.arithmeticLedger
    ? arithmeticLedger(compactText(question))
    : { measurements: [], calculations: [] };
  const answerObligations = scenarioAnswerObligations({
    question: compactText(question),
    evidence,
    plan,
    arithmetic
  }).concat(tableLegendObligations(question, evidence));
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
    `DETERMINISTIC_CONTEXT: ${JSON.stringify(deterministicContext || {})}`,
    deterministicContext?.answerObligations?.length
      ? `MANDATORY_ANSWER_OBLIGATIONS: ${JSON.stringify(deterministicContext.answerObligations)}`
      : "",
    "Answer only the planned question path. Treat collateral provisions as reviewed-only and do not create conclusions from them.",
    "Preserve exact table symbols, dates, arithmetic inputs, prerequisite order, passage identifiers, and source hashes supplied by the server.",
    "Cover every mandatory answer obligation explicitly in the user-facing answer and in the supported point bound to its supplied source.",
    "Do not infer property or mapped applicability. Do not rewrite an otherwise supported answer merely to add unrelated context."
  ].filter(Boolean).join("\n");
}

export function evaluateZoningEvidenceReadiness({ question, evidence = [], plan } = {}) {
  const sources = Array.isArray(evidence) ? evidence : [];
  const issues = [];
  if (!sources.length) {
    issues.push({
      code: "GOVERNING_ZONING_EVIDENCE_MISSING",
      detail: "No enacted Zoning passage was resolved for the planned question path."
    });
  }
  if (plan?.path === zoningResearchPaths.structuredTableSymbol &&
      !sources.some((source) => Array.isArray(source?.richSourceGrids) && source.richSourceGrids.length)) {
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
    return { source, sourceID, index, score };
  }).sort((left, right) => right.score - left.score || left.index - right.index);
  const sources = [];
  let characters = 0;
  for (const entry of scored) {
    if (sources.length >= maximumSources) break;
    const remaining = maximumCharacters - characters;
    if (remaining <= 0) break;
    const text = excerptForRepair(entry.source, terms, Math.min(2_400, remaining));
    if (!text) continue;
    sources.push({
      sourceID: entry.sourceID,
      sectionID: String(entry.source?.sectionID || ""),
      codePrefix: compactText(entry.source?.codePrefix),
      sectionNumber: compactText(entry.source?.sectionNumber),
      evidenceRole: sourceRole(entry.source),
      text,
      textHash: stableHash(text)
    });
    characters += text.length;
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
  const normalizedText = text.toLowerCase();
  for (const answerObligation of deterministicContext?.answerObligations || []) {
    const values = Array.isArray(answerObligation?.values) ? answerObligation.values : [];
    const covered = answerObligation?.requireAllValues
      ? values.every((value) => normalizedText.includes(String(value).toLowerCase()))
      : values.some((value) => normalizedText.includes(String(value).toLowerCase()));
    if (!values.length || covered) continue;
    issues.push({
      code: "ANSWER_OBLIGATION_NOT_COVERED",
      obligationID: answerObligation.id,
      sourceIDs: answerObligation.sourceIDs || [],
      detail: answerObligation.detail
    });
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
