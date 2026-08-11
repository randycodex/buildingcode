export const researchEvidencePriorityVersion = "20260811-deterministic-legal-function-v1";

export const researchEvidenceFunctions = Object.freeze({
  controllingRule: "controlling_rule",
  exception: "exception",
  calculationTable: "calculation_table",
  definition: "definition",
  supportingCrossReference: "supporting_cross_reference",
  candidate: "candidate"
});

function normalizedText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function descriptor(value = {}) {
  return {
    codePrefix: normalizedText(value.codePrefix).toUpperCase(),
    sectionNumber: normalizedText(value.sectionNumber)
  };
}

function descriptorIdentity(value) {
  const item = descriptor(value);
  return item.codePrefix && item.sectionNumber
    ? `${item.codePrefix}:${item.sectionNumber}`
    : "";
}

function uniqueDescriptors(values) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const item = descriptor(value);
    const identity = descriptorIdentity(item);
    if (!identity || seen.has(identity)) continue;
    seen.add(identity);
    result.push(item);
  }
  return result;
}

function inferredControllingRoots(items) {
  return uniqueDescriptors((Array.isArray(items) ? items : []).filter((item) =>
    item?.signals?.exactTopicRouteTarget === true
  ));
}

function hierarchyDepth(sectionNumber, rootSectionNumber) {
  if (sectionNumber === rootSectionNumber) return 0;
  if (!sectionNumber.startsWith(`${rootSectionNumber}.`)) return null;
  return sectionNumber.slice(rootSectionNumber.length + 1).split(".").filter(Boolean).length;
}

function closestControllingRoot(value, controllingRoots) {
  const item = descriptor(value);
  const matches = controllingRoots
    .filter((root) => root.codePrefix === item.codePrefix)
    .map((root) => ({
      ...root,
      depth: hierarchyDepth(item.sectionNumber, root.sectionNumber)
    }))
    .filter((root) => root.depth !== null)
    .sort((left, right) => left.depth - right.depth || right.sectionNumber.length - left.sectionNumber.length);
  return matches[0] || null;
}

function sourceText(value) {
  return normalizedText([
    value?.title,
    value?.selectedText,
    value?.text,
    value?.canonicalText,
    value?.relationship,
    value?.retrievalReason
  ].filter(Boolean).join(" "));
}

function isPinned(value) {
  return value?.origin === "user_pinned" || /\bpinned by the user\b/i.test(sourceText(value));
}

function isCrossReference(value) {
  return value?.origin === "permitext_cross_reference" ||
    Number(value?.retrievalDepth) > 0 ||
    /\bdirect (?:enacted-text )?cross-reference\b/i.test(sourceText(value));
}

function isDefinition(value, text) {
  return descriptor(value).sectionNumber === "202" ||
    /\bdefinitions?\b/i.test(normalizedText(value?.title)) ||
    /\bthe following (?:terms )?shall.*\bmeanings?\b/i.test(text);
}

function isException(value, text) {
  return value?.signals?.containsException === true ||
    /\bexceptions?\b|\bpermitted to be reduced\b|\bneed not (?:be |provide)|\bnot required\b/i.test(text);
}

function isCalculationOrTable(value, text) {
  return value?.signals?.referencesTable === true ||
    value?.signals?.includesStructuredTable === true ||
    /\btable\s+[A-Z]?\d|\bminimum required number\b|\btotal number of (?:required )?\w+ units\b|\b\d+(?:\.\d+)?\s*% of total\b|\bcalculated?\b.*\b(?:number|quantity|total)\b/i.test(text);
}

function primaryFunction(roles) {
  return [
    researchEvidenceFunctions.controllingRule,
    researchEvidenceFunctions.exception,
    researchEvidenceFunctions.calculationTable,
    researchEvidenceFunctions.definition,
    researchEvidenceFunctions.supportingCrossReference,
    researchEvidenceFunctions.candidate
  ].find((role) => roles.includes(role));
}

function materialityRank({
  pinned,
  exactReference,
  rootDepth,
  exception,
  calculationTable,
  definition,
  crossReference
}) {
  if (pinned || exactReference) return 0;
  if (rootDepth === 0) return 1;
  if (rootDepth === 1) return 2;
  if (rootDepth !== null && exception) return 3;
  if (rootDepth !== null && calculationTable) return 4;
  if (rootDepth !== null) return 5;
  if (definition) return 6;
  if (crossReference) return 7;
  return 8;
}

export function researchEvidencePriorityMetadata(value, options = {}) {
  const controllingRoots = uniqueDescriptors(options.controllingRoots);
  const controllingRoot = closestControllingRoot(value, controllingRoots);
  const text = sourceText(value);
  const pinned = isPinned(value);
  const exactReference = value?.signals?.exactReference === true;
  const crossReference = isCrossReference(value);
  const definition = isDefinition(value, text);
  const exception = isException(value, text);
  const calculationTable = isCalculationOrTable(value, text);
  const controlling = pinned || exactReference || Boolean(controllingRoot);
  const claimCoverageRequired = controlling && !crossReference;
  const roles = [];
  if (controlling) roles.push(researchEvidenceFunctions.controllingRule);
  if (exception) roles.push(researchEvidenceFunctions.exception);
  if (calculationTable) roles.push(researchEvidenceFunctions.calculationTable);
  if (definition) roles.push(researchEvidenceFunctions.definition);
  if (crossReference) roles.push(researchEvidenceFunctions.supportingCrossReference);
  if (!roles.length) roles.push(researchEvidenceFunctions.candidate);
  const rootDepth = controllingRoot?.depth ?? null;
  return {
    version: researchEvidencePriorityVersion,
    primaryFunction: primaryFunction(roles),
    functions: roles,
    materialityRank: materialityRank({
      pinned,
      exactReference,
      rootDepth,
      exception,
      calculationTable,
      definition,
      crossReference
    }),
    controllingRoot: controllingRoot
      ? `${controllingRoot.codePrefix} ${controllingRoot.sectionNumber}`
      : null,
    hierarchyDepth: rootDepth,
    claimCoverageRequired,
    claimCoverageReason: claimCoverageRequired
      ? pinned
        ? "user-pinned enacted evidence"
        : exactReference
          ? "exact enacted reference requested by the user"
          : rootDepth === 0
            ? "deterministically routed controlling provision"
            : "material descendant of a deterministically routed controlling provision"
      : null,
    reasons: [
      ...(pinned ? ["user-pinned evidence"] : []),
      ...(exactReference ? ["exact code reference in the question"] : []),
      ...(rootDepth === 0 ? ["controlling routed section"] : []),
      ...(rootDepth !== null && rootDepth > 0
        ? [`material descendant of ${controllingRoot.codePrefix} ${controllingRoot.sectionNumber}`]
        : []),
      ...(exception ? ["exception or permitted reduction"] : []),
      ...(calculationTable ? ["calculation or table provision"] : []),
      ...(definition ? ["definition provision"] : []),
      ...(crossReference ? ["supporting cross-reference"] : [])
    ]
  };
}

export function prioritizeResearchEvidence(values, options = {}) {
  const items = Array.isArray(values) ? values : [];
  const controllingRoots = uniqueDescriptors([
    ...(Array.isArray(options.controllingRoots) ? options.controllingRoots : []),
    ...inferredControllingRoots(items)
  ]);
  const requestedLimit = Number.parseInt(String(options.limit ?? items.length), 10);
  const limit = Number.isSafeInteger(requestedLimit) && requestedLimit >= 0
    ? Math.min(requestedLimit, items.length)
    : items.length;
  return items.map((value, originalIndex) => ({
    value,
    originalIndex,
    priority: researchEvidencePriorityMetadata(value, { controllingRoots })
  })).sort((left, right) =>
    left.priority.materialityRank - right.priority.materialityRank ||
    (left.priority.hierarchyDepth ?? Number.MAX_SAFE_INTEGER) -
      (right.priority.hierarchyDepth ?? Number.MAX_SAFE_INTEGER) ||
    left.originalIndex - right.originalIndex
  ).slice(0, limit).map(({ value, priority }) => ({
    ...value,
    evidencePriority: priority
  }));
}
