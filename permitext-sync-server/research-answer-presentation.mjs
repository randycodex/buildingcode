export const researchAnswerPresentationVersion = "20260902-product-example-contract-v2";

const compactText = (value) => String(value || "").replace(/\s+/g, " ").trim();

const shortAnswerCue = /\b(?:short|brief|quick|quickly|one\s+paragraph|single\s+paragraph|concise)\b/i;
const comparisonCue = /\b(?:compare|comparison|difference|different|similar|similarity|versus|vs\.?|same as|equivalent)\b/i;
const requirementsCue = /\b(?:requirements?|designing|design requirements?|minimums?|what (?:do|does) .* require)\b/i;
const numericCue = /\b(?:maximum|minimum|how (?:much|many|wide|long|high)|square\s+feet|sq\.?\s*ft|width|height|distance|slope|rise|clearance|dimension)\b/i;
const definitionCue = /\b(?:what (?:is|are|does)|define|definition|meaning|appendix)\b/i;
const editionCheckCue = /\b(?:is|was|were|does|did) (?:this|that|it|the (?:answer|requirement|section))\b[\s\S]*\b(?:19|20)\d{2}\b|\bfrom (?:the )?(?:19|20)\d{2}(?:\s+edition|\s+code)?\b/i;
const outsideAuthorityCue = /\b(?:Office of Mental Health|OMH|NYCRR|agency|licensing|funding)\b/i;

function normalizedStartingPoint(source) {
  try {
    const url = new URL(String(source?.sourceURL || "").trim());
    if (url.protocol !== "https:") return null;
    url.hash = "";
    const label = compactText(source?.sourceName || source?.label)
      .replace(/[\[\]]/g, "");
    if (!label) return null;
    return { label, url: url.toString() };
  } catch {
    return null;
  }
}

export function applyResearchOutsideAuthorityStartingPoints(
  answer,
  outsideCurrentLibrary = []
) {
  if (!answer || typeof answer !== "object") return answer;
  const answerText = String(answer.answerText || "").trim();
  const existingURLs = new Set([
    ...Array.from(answerText.matchAll(/https:\/\/[^\s)\]]+/g), (match) => match[0]),
    ...(Array.isArray(answer.supportingSources) ? answer.supportingSources : [])
      .map((source) => String(source?.url || "").trim())
      .filter(Boolean)
  ]);
  const entries = [];
  const seenURLs = new Set();
  for (const source of Array.isArray(outsideCurrentLibrary) ? outsideCurrentLibrary : []) {
    const entry = normalizedStartingPoint(source);
    if (!entry || existingURLs.has(entry.url) || seenURLs.has(entry.url)) continue;
    seenURLs.add(entry.url);
    entries.push(entry);
  }
  if (!entries.length) return answer;
  const links = entries.map(({ label, url }) => `[${label}](${url})`).join("; ");
  const startingPointParagraph =
    `Official starting ${entries.length === 1 ? "point" : "points"}: ${links}. ` +
    `${entries.length === 1 ? "This page identifies" : "These pages identify"} the requested ` +
    `${entries.length === 1 ? "authority" : "authorities"}; Permitext has not treated ` +
    `${entries.length === 1 ? "it" : "them"} as proof of a program-specific requirement.`;
  const startingPointLimitation =
    "An official starting-point link identifies the outside authority but is not a source-bound substantive rule; the controlling program document still must be retrieved before relying on a program-specific minimum.";
  const evidenceLimitations = Array.isArray(answer.evidenceLimitations)
    ? [...answer.evidenceLimitations]
    : [];
  if (!evidenceLimitations.some((value) => /official starting-point link/i.test(String(value)))) {
    evidenceLimitations.push(startingPointLimitation);
  }
  return {
    ...answer,
    answerText: [answerText, startingPointParagraph].filter(Boolean).join("\n\n"),
    evidenceLimitations
  };
}

function evidenceCount(evidence) {
  return new Set((Array.isArray(evidence) ? evidence : [])
    .map((source) => String(source?.sectionID || source?.id || "").trim())
    .filter(Boolean)).size;
}

export function researchRequestedAreaConversions({ question, evidence = [] } = {}) {
  if (!/\b(?:sq\.?\s*ft|square\s+feet|square\s+foot)\b/i.test(compactText(question))) return [];
  const conversions = [];
  const seen = new Set();
  for (const source of Array.isArray(evidence) ? evidence : []) {
    const text = compactText(source?.text || source?.plainText);
    for (const match of text.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:square\s+inches|sq\.?\s*in\.?)(?!\w)/gi)) {
      const squareInches = Number(match[1]);
      if (!Number.isFinite(squareInches)) continue;
      const key = String(squareInches);
      if (seen.has(key)) continue;
      seen.add(key);
      conversions.push(Object.freeze({
        squareInches,
        squareFeet: squareInches / 144,
        sourceIDs: Object.freeze([String(source?.sourceID || "").trim()].filter(Boolean))
      }));
    }
  }
  return conversions;
}

function contractFor(mode, preferredStructure, requiredElements) {
  return Object.freeze({
    version: researchAnswerPresentationVersion,
    mode,
    preferredStructure,
    directAnswerFirst: true,
    requiredElements: Object.freeze(requiredElements),
    universalRules: Object.freeze([
      "Place each material code citation next to the claim it supports.",
      "Separate governing enacted requirements from outside guidance or unsupplied standards.",
      "Preserve material applicability conditions, exceptions, and unresolved facts.",
      "Do not add a heading, table, list, calculation, or follow-up question unless it helps answer this question."
    ])
  });
}

export function researchAnswerPresentationContract({ question, evidence = [] } = {}) {
  const text = compactText(question);
  const sourceCount = evidenceCount(evidence);
  const requestedAreaConversions = researchRequestedAreaConversions({ question: text, evidence });

  if (shortAnswerCue.test(text)) {
    return contractFor("compact-paragraph", "one compact paragraph", [
      "Answer the requested point in the first sentence.",
      "Use a second paragraph only when a material qualification cannot safely fit in the first."
    ]);
  }

  if (editionCheckCue.test(text)) {
    return contractFor("edition-check", "direct confirmation or correction", [
      "Begin with Yes, No, or a direct correction.",
      "Name the exact edition and correct any earlier overgeneralization before adding detail.",
      "Cite only sections from the confirmed edition."
    ]);
  }

  if (comparisonCue.test(text)) {
    return contractFor("comparison-table", "short conclusion, compact Markdown table, practical distinction", [
      "State the controlling relationship before the table.",
      "Use a table only for shared features that can be compared on the supplied evidence.",
      "End with the practical design or applicability distinction, without repeating the table."
    ]);
  }

  if (outsideAuthorityCue.test(text) && requirementsCue.test(text)) {
    return contractFor("external-authority-boundary", "conditional answer with separated authorities", [
      "Identify which requested authority is established by enacted evidence or attributable official supporting material and which is still unresolved.",
      "When attributable official supporting claims are supplied, summarize those exact claims and label their authority separately from the enacted Permitext code.",
      "Do not invent ratios, dimensions, or program rules from an unsupplied agency or standard.",
      "Give responsive established requirements first, then request only the program type, controlling source, or project fact that remains missing."
    ]);
  }

  if (requirementsCue.test(text) && sourceCount >= 4) {
    return contractFor("requirements-table", "direct scope statement, Item/Requirement/Authority table, practical calculation", [
      "Summarize the usable baseline rules before requesting project facts.",
      "Use one row per parallel dimensional or configuration requirement.",
      "Include a short calculation or design implication only when the evidence and stated facts support it."
    ]);
  }

  if (numericCue.test(text)) {
    return contractFor("numeric-rule", "number first, scope, exceptions", [
      "Lead with the supported number or explain immediately why one number cannot be selected.",
      "State the condition to which the number applies.",
      "Identify any materially different exception or alternate category supplied by the evidence.",
      ...requestedAreaConversions.map(({ squareInches, squareFeet }) =>
        `Because the user asked for square feet, convert the supplied ${squareInches} square inches to ${squareFeet.toFixed(3)} square feet and label that arithmetic as a derived conversion.`
      )
    ]);
  }

  if (requirementsCue.test(text)) {
    return contractFor("requirements-checklist", "direct answer with compact checklist", [
      "Use a checklist only for genuinely parallel requirements.",
      "Keep each item complete enough to preserve its condition and citation."
    ]);
  }

  if (definitionCue.test(text)) {
    return contractFor("definition-status", "definition, current status, practical consequence", [
      "Define the term or provision directly.",
      "When an edition is material, distinguish its historical and current status.",
      "Ask for context only if it changes which provision controls."
    ]);
  }

  return contractFor("direct-answer", "plain-language paragraphs", [
    "Resolve the question in the first sentence.",
    "Add only the rule, application, and qualifications needed to support that result."
  ]);
}
