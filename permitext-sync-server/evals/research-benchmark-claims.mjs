export const researchBenchmarkClaimsVersion = "20260811-lexical-omission-diagnostic-v1";

const claimRuleKinds = new Set(["required", "forbidden"]);

const stopWords = new Set([
  "a", "about", "above", "after", "again", "against", "all", "also", "am", "an", "and",
  "any", "are", "as", "at", "be", "because", "been", "before", "being", "below", "between",
  "both", "but", "by", "can", "cannot", "could", "did", "do", "does", "doing", "during",
  "each", "for", "from", "further", "had", "has", "have", "having", "here", "how", "if",
  "in", "into", "is", "it", "its", "itself", "may", "might", "more", "most", "must", "no",
  "nor", "not", "of", "off", "on", "once", "only", "or", "other", "otherwise", "our", "out",
  "over", "permitext", "same", "shall", "should", "so", "some", "such", "than", "that", "the",
  "their", "them", "then", "there", "therefore", "these", "they", "this", "those", "through",
  "to", "under", "until", "up", "very", "was", "we", "were", "what", "when", "where", "whether",
  "which", "while", "who", "why", "will", "with", "within", "without", "would"
]);

const canonicalWordAliases = new Map([
  ["allow", "permit"],
  ["allowed", "permit"],
  ["allows", "permit"],
  ["classifies", "classify"],
  ["classified", "classify"],
  ["classification", "classify"],
  ["classifications", "classify"],
  ["determine", "establish"],
  ["determined", "establish"],
  ["determines", "establish"],
  ["established", "establish"],
  ["establishes", "establish"],
  ["needed", "need"],
  ["needs", "need"],
  ["necessary", "need"],
  ["permitted", "permit"],
  ["permits", "permit"],
  ["required", "require"],
  ["requires", "require"],
  ["requirements", "requirement"]
]);

function normalizedText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function canonicalWord(value) {
  let canonical = normalizedText(value).replace(/^['-]+|['-]+$/g, "");
  if (!canonical) return "";
  if (canonicalWordAliases.has(canonical)) return canonicalWordAliases.get(canonical);
  if (canonical.length > 5 && canonical.endsWith("ies")) {
    canonical = `${canonical.slice(0, -3)}y`;
  } else if (canonical.length > 4 && canonical.endsWith("s") && !canonical.endsWith("ss")) {
    canonical = canonical.slice(0, -1);
  }
  if (canonicalWordAliases.has(canonical)) return canonicalWordAliases.get(canonical);
  if (canonical.length > 6 && canonical.endsWith("ing")) canonical = canonical.slice(0, -3);
  else if (canonical.length > 5 && canonical.endsWith("ed")) canonical = canonical.slice(0, -2);
  return canonicalWordAliases.get(canonical) || canonical;
}

function contentTerms(value) {
  const terms = [];
  const seen = new Set();
  for (const token of normalizedText(value).match(/[a-z]+(?:\+[a-z]+)?(?:-[a-z0-9]+)*|\d+(?:\.\d+)*(?:%|sf)?/g) || []) {
    const canonical = canonicalWord(token);
    if (
      !canonical ||
      stopWords.has(canonical) ||
      (/^[a-z]+$/.test(canonical) && canonical.length < 3)
    ) continue;
    if (!seen.has(canonical)) {
      seen.add(canonical);
      terms.push(canonical);
    }
  }
  return terms;
}

function referenceAnchors(value) {
  const references = [];
  const seen = new Set();
  const source = String(value || "");
  const pattern = /(?:(?:\b(?:AC|BC|EBC|FC|FGC|MC|PC)\s+)?(?:§{1,2}|Sections?)\s*|\bTable\s+)([A-Z]?\d+(?:-\d+)?(?:\.[0-9A-Za-z-]+)*)/gi;
  for (const match of source.matchAll(pattern)) {
    const reference = String(match[1] || "").replace(/\.$/, "").toUpperCase();
    if (reference && !seen.has(reference)) {
      seen.add(reference);
      references.push(reference);
    }
  }
  return references;
}

function sentenceClaims(value) {
  const sentences = String(value || "")
    .replace(/\r\n?/g, "\n")
    .split(/(?<=[.!?])\s+(?=(?:["“']?[A-Z0-9§]))|\n{2,}/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const merged = [];
  for (let index = 0; index < sentences.length; index += 1) {
    const sentence = sentences[index];
    if (/^(?:yes|no|not necessarily|it depends)\b/i.test(sentence) && sentences[index + 1]) {
      merged.push(`${sentence} ${sentences[index + 1]}`);
      index += 1;
    } else {
      merged.push(sentence);
    }
  }
  return merged;
}

function minimumTermMatches(terms, references) {
  if (!terms.length) return 0;
  const ratio = references.length ? 0.3 : 0.4;
  return Math.min(6, Math.max(1, Math.ceil(terms.length * ratio)));
}

function claimRule(kind, text, index) {
  const references = referenceAnchors(text);
  const terms = contentTerms(text)
    .filter((term) => !references.some((reference) => reference.toLowerCase() === term));
  return {
    id: `${kind}-${String(index + 1).padStart(2, "0")}`,
    kind,
    text: String(text || "").trim(),
    match: {
      mode: kind === "required" ? "lexical-anchor-recall" : "semantic-review-only",
      referenceAnchors: references,
      termAnchors: terms,
      minimumTermMatches: kind === "required" ? minimumTermMatches(terms, references) : null,
      distinctiveTermAnchors: [],
      minimumDistinctiveTermMatches: kind === "required" ? 0 : null
    }
  };
}

export function benchmarkClaimRequirements(idealAnswer, forbiddenClaims = []) {
  const required = sentenceClaims(idealAnswer).map((text, index) => claimRule("required", text, index));
  const termFrequency = new Map();
  for (const rule of required) {
    for (const term of new Set(rule.match.termAnchors)) {
      termFrequency.set(term, (termFrequency.get(term) || 0) + 1);
    }
  }
  for (const rule of required) {
    rule.match.distinctiveTermAnchors = rule.match.termAnchors
      .filter((term) => (termFrequency.get(term) || 0) === 1);
    rule.match.minimumDistinctiveTermMatches = Math.min(
      2,
      rule.match.distinctiveTermAnchors.length
    );
  }
  return {
    schemaVersion: 1,
    version: researchBenchmarkClaimsVersion,
    diagnosticOnly: true,
    required,
    forbidden: (Array.isArray(forbiddenClaims) ? forbiddenClaims : [])
      .map((text, index) => claimRule("forbidden", text, index))
  };
}

function answerStrings(value, output = []) {
  if (typeof value === "string") {
    output.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => answerStrings(item, output));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => answerStrings(item, output));
  }
  return output;
}

function answerReferenceSet(value) {
  const source = answerStrings(value).join("\n");
  const references = new Set(referenceAnchors(source));
  for (const match of source.matchAll(/\b(?:AC|BC|EBC|FC|FGC|MC|PC)\s+([A-Z]?\d+(?:-\d+)?(?:\.[0-9A-Za-z-]+)*)/gi)) {
    references.add(String(match[1] || "").replace(/\.$/, "").toUpperCase());
  }
  return references;
}

function validateClaimRule(rule, expectedKind, caseID) {
  if (!rule || typeof rule !== "object" || rule.kind !== expectedKind || !claimRuleKinds.has(rule.kind)) {
    throw new Error(`${caseID} has an invalid ${expectedKind} claim rule.`);
  }
  if (!new RegExp(`^${expectedKind}-\\d{2,}$`).test(String(rule.id || "")) || !String(rule.text || "").trim()) {
    throw new Error(`${caseID} has an invalid ${expectedKind} claim identity.`);
  }
  if (!Array.isArray(rule.match?.referenceAnchors) ||
      !Array.isArray(rule.match?.termAnchors) ||
      !Array.isArray(rule.match?.distinctiveTermAnchors)) {
    throw new Error(`${caseID} has incomplete anchors for ${rule.id}.`);
  }
  if (new Set(rule.match.referenceAnchors).size !== rule.match.referenceAnchors.length ||
      new Set(rule.match.termAnchors).size !== rule.match.termAnchors.length ||
      new Set(rule.match.distinctiveTermAnchors).size !== rule.match.distinctiveTermAnchors.length) {
    throw new Error(`${caseID} repeats anchors for ${rule.id}.`);
  }
  if (expectedKind === "required") {
    if (rule.match.mode !== "lexical-anchor-recall") {
      throw new Error(`${caseID} has an unsupported required-claim matcher for ${rule.id}.`);
    }
    const minimum = Number(rule.match.minimumTermMatches);
    const minimumDistinctive = Number(rule.match.minimumDistinctiveTermMatches);
    if (!Number.isInteger(minimum) || minimum < 0 || minimum > rule.match.termAnchors.length ||
        !Number.isInteger(minimumDistinctive) || minimumDistinctive < 0 ||
        minimumDistinctive > rule.match.distinctiveTermAnchors.length ||
        rule.match.distinctiveTermAnchors.some((term) => !rule.match.termAnchors.includes(term))) {
      throw new Error(`${caseID} has an invalid term threshold for ${rule.id}.`);
    }
  } else if (rule.match.mode !== "semantic-review-only" ||
      rule.match.minimumTermMatches !== null ||
      rule.match.minimumDistinctiveTermMatches !== null) {
    throw new Error(`${caseID} must keep forbidden claim ${rule.id} semantic-review-only.`);
  }
}

export function validateBenchmarkClaimRequirements(requirements, {
  caseID = "benchmark case",
  legacyForbiddenClaims = []
} = {}) {
  if (
    requirements?.schemaVersion !== 1 ||
    requirements.version !== researchBenchmarkClaimsVersion ||
    requirements.diagnosticOnly !== true
  ) {
    throw new Error(`${caseID} has an invalid claim-requirements contract.`);
  }
  if (!Array.isArray(requirements.required) || !requirements.required.length) {
    throw new Error(`${caseID} has no required claim rules.`);
  }
  if (!Array.isArray(requirements.forbidden) || !requirements.forbidden.length) {
    throw new Error(`${caseID} has no forbidden claim rules.`);
  }
  requirements.required.forEach((rule) => validateClaimRule(rule, "required", caseID));
  requirements.forbidden.forEach((rule) => validateClaimRule(rule, "forbidden", caseID));
  const forbiddenTexts = requirements.forbidden.map((rule) => rule.text);
  if (
    forbiddenTexts.length !== legacyForbiddenClaims.length ||
    forbiddenTexts.some((text, index) => text !== legacyForbiddenClaims[index])
  ) {
    throw new Error(`${caseID} claim rules do not preserve its forbidden-claim rubric.`);
  }
  return requirements;
}

export function scoreBenchmarkAnswerOmissions(testCase, answer) {
  const requirements = validateBenchmarkClaimRequirements(testCase?.claimRequirements, {
    caseID: testCase?.id || "benchmark case",
    legacyForbiddenClaims: testCase?.forbiddenClaims || []
  });
  const answerTerms = new Set(contentTerms(answerStrings(answer).join("\n")));
  const answerReferences = answerReferenceSet(answer);
  const required = requirements.required.map((rule) => {
    const matchedReferences = rule.match.referenceAnchors.filter((item) => answerReferences.has(item));
    const matchedTerms = rule.match.termAnchors.filter((item) => answerTerms.has(item));
    const matchedDistinctiveTerms = rule.match.distinctiveTermAnchors
      .filter((item) => answerTerms.has(item));
    const referenceAnchorsSatisfied = matchedReferences.length === rule.match.referenceAnchors.length;
    const termAnchorsSatisfied = matchedTerms.length >= rule.match.minimumTermMatches;
    const distinctiveTermAnchorsSatisfied = matchedDistinctiveTerms.length >=
      rule.match.minimumDistinctiveTermMatches;
    return {
      id: rule.id,
      text: rule.text,
      omitted: !(referenceAnchorsSatisfied && termAnchorsSatisfied && distinctiveTermAnchorsSatisfied),
      referenceAnchors: {
        required: rule.match.referenceAnchors,
        matched: matchedReferences
      },
      termAnchors: {
        required: rule.match.termAnchors,
        minimumMatches: rule.match.minimumTermMatches,
        matched: matchedTerms
      },
      distinctiveTermAnchors: {
        required: rule.match.distinctiveTermAnchors,
        minimumMatches: rule.match.minimumDistinctiveTermMatches,
        matched: matchedDistinctiveTerms
      }
    };
  });
  const matchedCount = required.filter((item) => !item.omitted).length;
  return {
    schemaVersion: 1,
    version: researchBenchmarkClaimsVersion,
    diagnosticOnly: true,
    interpretation: "Lexical omission signal only; human or semantic review is required for legal-answer correctness and forbidden-claim evaluation.",
    score: required.length ? matchedCount / required.length : 0,
    matchedCount,
    omittedCount: required.length - matchedCount,
    required,
    omittedClaimIDs: required.filter((item) => item.omitted).map((item) => item.id),
    forbiddenClaims: requirements.forbidden
  };
}
