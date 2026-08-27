export const researchProjectFactCoverageVersion =
  "20260827-declared-unknowns-and-representations-v1";

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function factParts(value) {
  const fact = compactText(value);
  const separator = fact.indexOf(":");
  if (separator < 0) return { fact, label: "", detail: fact };
  return {
    fact,
    label: compactText(fact.slice(0, separator)),
    detail: compactText(fact.slice(separator + 1))
  };
}

function sentence(value) {
  const text = compactText(value);
  if (!text) return "";
  const capitalized = text[0].toUpperCase() + text.slice(1);
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

export function researchProjectFactIsExplicitlyUnresolved(fact) {
  return /^(?:unknowns?|missing facts?|unresolved(?: project)? facts?|facts? to confirm)\s*:/i.test(
    compactText(fact)
  );
}

export function researchProjectFactRequiresValidation(fact) {
  const { fact: text, label } = factParts(fact);
  return /^(?:applicant assertions?|owner claims?|owner positions?|representations?)$/i.test(label) ||
    /\brepresented by (?:the )?(?:owner|applicant)\b/i.test(text);
}

export function researchUnresolvedProjectFacts(projectFacts = []) {
  return Array.from(new Set(
    (Array.isArray(projectFacts) ? projectFacts : [])
      .map((fact) => compactText(fact))
      .filter((fact) =>
        researchProjectFactIsExplicitlyUnresolved(fact) ||
        researchProjectFactRequiresValidation(fact)
      )
  ));
}

export function researchProjectFactMissingFact(fact) {
  const { fact: text, label, detail } = factParts(fact);
  if (!text) return "";
  if (researchProjectFactIsExplicitlyUnresolved(text)) return sentence(detail);
  if (/^applicant assertions?$/i.test(label)) {
    return sentence(`Verify the applicant assertion: ${detail}`);
  }
  if (/^owner claims?$/i.test(label)) {
    return sentence(`Verify the owner's claim: ${detail}`);
  }
  if (/^owner positions?$/i.test(label)) {
    return sentence(`Verify the owner's position: ${detail}`);
  }
  if (/^representations?$/i.test(label)) {
    return sentence(`Verify the representation: ${detail}`);
  }
  if (/\brepresented by (?:the )?(?:owner|applicant)\b/i.test(text)) {
    return sentence(`Verify the represented project fact: ${text}`);
  }
  return sentence(text);
}

function comparableFact(value) {
  return compactText(value)
    .toLowerCase()
    .replace(/^(?:verify|confirm|establish|determine)\s+(?:the\s+)?/i, "")
    .replace(/^(?:applicant(?:'s)? assertion|owner(?:'s)? claim|owner(?:'s)? position|representation|represented project fact)\s*:\s*/i, "")
    .replace(/\b(?:whether|actual|applicable|proposed|existing|current|documentation|documents?|records?|support for|each|the|a|an|and|or|of|to|for|in|on|with|is|are|was|were|be|been)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function factIsCovered(candidate, existingFacts) {
  const candidateComparable = comparableFact(candidate);
  if (!candidateComparable) return true;
  const candidateTokens = candidateComparable.split(" ").filter((token) => token.length > 2);
  return existingFacts.some((existing) => {
    const existingComparable = comparableFact(existing);
    if (!existingComparable) return false;
    if (
      existingComparable.includes(candidateComparable) ||
      candidateComparable.includes(existingComparable)
    ) return true;
    if (candidateTokens.length < 3) return false;
    const existingTokens = new Set(
      existingComparable.split(" ").filter((token) => token.length > 2)
    );
    return candidateTokens.every((token) => existingTokens.has(token));
  });
}

/**
 * Guarantees that declared unknowns and unverified representations remain
 * visible after model generation or revision. This adds no legal conclusion;
 * it preserves the uncertainty the user supplied with the Project facts.
 */
export function applyResearchProjectFactCoverage(
  interpretation,
  unresolvedProjectFacts = []
) {
  if (!interpretation || typeof interpretation !== "object") return interpretation;
  const existingFacts = (Array.isArray(interpretation.missingFacts)
    ? interpretation.missingFacts
    : [])
    .map((fact) => compactText(fact))
    .filter(Boolean);
  const additions = [];
  for (const unresolvedFact of Array.isArray(unresolvedProjectFacts)
    ? unresolvedProjectFacts
    : []) {
    const missingFact = researchProjectFactMissingFact(unresolvedFact);
    if (!missingFact || factIsCovered(missingFact, [...existingFacts, ...additions])) continue;
    additions.push(missingFact);
  }
  if (!additions.length && Array.isArray(interpretation.missingFacts)) return interpretation;
  return {
    ...interpretation,
    missingFacts: [...existingFacts, ...additions]
  };
}
