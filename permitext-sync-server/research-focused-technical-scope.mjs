// Narrow recurring decisions whose governing provisions can be identified
// before drafting. These scopes select complete sources, never answer text.
export const researchFocusedTechnicalScopeVersion = "20260909-focused-technical-v1";

const scopeDefinitions = [
  {
    id: "environmental-exhaust-intake-separation", codePrefix: "MC",
    pattern: /^(?=[\s\S]*\benvironmental\s+(?:air\s+)?exhaust\b)(?=[\s\S]*\bmechanical\b)(?=[\s\S]*\bintakes?\b)(?=[\s\S]*\b(?:feet|foot|distance|separation|apart)\b)/i,
    anchors: [["401.4", /Ventilation air intake openings shall comply/i], ["501.3.1", /termination point of exhaust outlets and ducts|Such exhaust outlets shall not be considered hazardous or noxious/i]],
    additionalSources: [["BC", "403.7"]]
  },
  {
    id: "commercial-kitchen-hood-type", codePrefix: "MC",
    pattern: /^(?=[\s\S]*\b(?:commercial\s+(?:kitchen|cooking)|restaurant)\b)(?=[\s\S]*\bhoods?\b)(?=[\s\S]*\bType\s+(?:II|2)\b)(?=[\s\S]*\b(?:grease|medium[- ]duty|heavy[- ]duty)\b)/i,
    anchors: [["507.1", /Commercial kitchen exhaust hoods shall comply/i], ["507.2", /Type I hoods shall be installed where cooking appliances produce grease/i], ["507.3", /Type II hoods shall be installed above dishwashers/i]]
  },
  {
    id: "commercial-kitchen-makeup-controls", codePrefix: "MC",
    pattern: /^(?=[\s\S]*\bcommercial\s+kitchen\b)(?=[\s\S]*\bmake[- ]?up[- ]air\b)(?=[\s\S]*\b(?:mechanical|fan)\b)(?=[\s\S]*\b(?:switch|separately|manual\w*|automatic\w*|simultaneous\w*|interlock\w*|controls?)\b)/i,
    anchors: [["508.1", /Mechanical makeup air systems shall be automatically controlled to start and operate simultaneously/i]]
  },
  {
    id: "permit-exemption-compliance", codePrefix: "AC", enactedScopeSufficient: true,
    pattern: /^(?=[\s\S]*\b(?:qualifies for an? exemption|is exempt|permit[- ]exempt)\b)(?=[\s\S]*\bpermits?\b)(?=[\s\S]*\b(?:disregard|ignore|violat\w*|comply|compliance)\b)(?=[\s\S]*\b(?:zoning|Construction Code|other laws?)\b)/i,
    anchors: [["28-105.4", /Exemptions from permit requirements[\s\S]*shall not be deemed to grant authorization[\s\S]*zoning resolution/i]]
  },
  {
    id: "permit-revocation-material-statement", codePrefix: "AC", enactedScopeSufficient: true,
    pattern: /^(?=[\s\S]*\bpermits?\b)(?=[\s\S]*\b(?:revok\w*|revocat\w*)\b)(?=[\s\S]*\bmaterial\b)(?=[\s\S]*\b(?:false statement|misrepresentation)\b)/i,
    anchors: [["28-105.10", /authorized to suspend or revoke a permit/i], ["28-105.10.1", /false statement[\s\S]*misrepresentation[\s\S]*material fact/i]]
  }
];

export function focusedTechnicalResearchScope(question) {
  const text = String(question || "").replace(/\s+/g, " ").trim();
  // Broader design, historical applicability, source requests and compound
  // questions retain ordinary discovery. Do not infer their completeness.
  if ((text.match(/\?/g) || []).length > 1 ||
      /\b(?:DOB\s*NOW|portal|upload\w*|submit\w*|filing procedure|1968|2008|2014|Energy Code|Energy Conservation Code|Fire Code|guidance|bulletin|web|internet|standard|manufacturer|calculate|sizing|cfm|airflow|combustion|hazardous|noxious|refrigerant|smoke control|fire suppression|rated|accessibility)\b/i.test(text) ||
      /\b(?:all|complete|full)\s+(?:code\s+)?(?:requirements?|design|compliance)\b|\b(?:also|in addition|and|then)\s+(?:explain|check|assess|verify|what|how|which|calculate|review|specify)\b/i.test(text)) return null;
  return scopeDefinitions.find((scope) => scope.pattern.test(text)) || null;
}

export const focusedTechnicalTopicRoutes = scopeDefinitions.map((scope) => ({
  // Discovery's pattern interface deliberately shares the scope predicate.
  pattern: { test: (question) => focusedTechnicalResearchScope(question)?.id === scope.id },
  label: scope.id.replaceAll("-", " "),
  targets: scope.anchors.map(([sectionPrefix]) => ({ codePrefix: scope.codePrefix, sectionPrefix,
    codeEdition: "2022", descendantClaimCoverage: false }))
}));

function matchingAnchors(scope, values, { canonical = false } = {}) {
  const anchors = scope.anchors.map(([number, signature]) => values.find((value) =>
    value.codePrefix === scope.codePrefix && value.sectionNumber === number &&
    /\b2022\b/.test(value.codeEdition || "") &&
    (canonical ? value.canonicalContextComplete === true && !value.truncated : value.signals?.exactTopicRouteTarget === true) &&
    signature.test(value.text || value.selectedText || "")));
  if (anchors.some((value) => !value)) return null;
  if (!["codeEdition", "codeVersion", "corpusID"].every((field) => anchors[0][field] &&
    anchors.every((value) => value[field] === anchors[0][field]))) return null;
  if (anchors[0].corpusID !== "nyc-2022-construction-codes") return null;
  return anchors;
}

export function focusedTechnicalCandidates(query, candidates, pinnedCount) {
  const standalone = query.topicDecision && !query.topicDecision.rootTopic?.text && !query.topicDecision.currentTopic?.text;
  if (pinnedCount || query.projectFactsApplied ||
      ((query.contextDependentFollowUp || query.relevanceComparison) && !standalone)) return candidates;
  const scope = focusedTechnicalResearchScope(query.question);
  if (!scope || !matchingAnchors(scope, candidates)) return candidates;
  const isAnchor = (value) => value.codePrefix === scope.codePrefix && scope.anchors.some(([number]) => number === value.sectionNumber);
  // An independently routed authority makes this a broader source problem.
  if (candidates.some((value) => value.signals?.exactTopicRouteTarget && !isAnchor(value))) return candidates;
  return candidates.filter((value) => isAnchor(value) || scope.additionalSources?.some(([prefix, number]) =>
    value.codePrefix === prefix && value.sectionNumber === number) || value.signals?.exactReference ||
    value.signals?.contextualReference || value.evidencePriority?.primaryFunction === "definition");
}

export function hasCompleteEnactedTechnicalScope(question, evidence = []) {
  const scope = focusedTechnicalResearchScope(question);
  return Array.isArray(evidence) && !!scope?.enactedScopeSufficient && !!matchingAnchors(scope, evidence, { canonical: true });
}
