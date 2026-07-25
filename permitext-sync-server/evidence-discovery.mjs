import { createHash } from "node:crypto";

export const evidenceDiscoveryVersion = "20260724-hybrid-candidates-v1";
export const evidenceDiscoveryMaximumCandidates = 12;

const stopWords = new Set([
  "a", "about", "after", "all", "also", "an", "and", "any", "are", "as", "at",
  "be", "because", "been", "before", "being", "between", "both", "but", "by",
  "can", "could", "do", "does", "each", "for", "from", "has", "have", "how",
  "if", "in", "into", "is", "it", "its", "may", "must", "no", "not", "of",
  "on", "one", "or", "our", "should", "so", "than", "that", "the", "their",
  "then", "there", "these", "this", "those", "to", "under", "use", "using",
  "was", "we", "what", "when", "where", "whether", "which", "while", "with",
  "without", "would"
]);

const conceptExpansions = [
  {
    pattern: /\b(scissor|stair|stairs|stairway|exit|exits|egress)\b/i,
    terms: ["scissor", "stair", "stairs", "stairway", "exit", "exits", "egress"]
  },
  {
    pattern: /\b(residential|apartment|dwelling|r-2)\b/i,
    terms: ["residential", "apartment", "dwelling", "r-2"]
  },
  {
    pattern: /\b(occupant|occupancy|occupants|load|seating|seats)\b/i,
    terms: ["occupant", "occupants", "occupancy", "load", "seating", "seats"]
  },
  {
    pattern: /\b(assembly|multipurpose|conference|meeting|amenity)\b/i,
    terms: ["assembly", "multipurpose", "conference", "meeting", "amenity"]
  },
  {
    pattern: /\b(plumbing|fixture|fixtures|toilet|lavatory|water closet)\b/i,
    terms: ["plumbing", "fixture", "fixtures", "toilet", "lavatory", "water", "closet"]
  },
  {
    pattern: /\b(accessible|accessibility|disabled|wheelchair)\b/i,
    terms: ["accessible", "accessibility", "wheelchair"]
  },
  {
    pattern: /\b(existing|prior-code|legacy|alteration|enlargement)\b/i,
    terms: ["existing", "prior", "legacy", "alteration", "enlargement"]
  },
  {
    pattern: /\b(fire alarm|alarm system|notification)\b/i,
    terms: ["fire", "alarm", "system", "notification"]
  },
  {
    pattern: /\b(sidewalk caf[eé]|outdoor dining|exterior seating)\b/i,
    terms: ["sidewalk", "cafe", "outdoor", "dining", "exterior", "seating"]
  },
  {
    pattern: /\b(mechanical|ventilation|exhaust|air changes?)\b/i,
    terms: ["mechanical", "ventilation", "exhaust", "air"]
  }
];

const topicRoutes = [
  {
    pattern: /\bscissor\s+stair|stairs?\s+sharing\s+(?:a\s+)?common|two\s+(?:separate\s+)?exits?\b/i,
    label: "scissor-stair and separate-exit provisions",
    targets: [{ codePrefix: "BC", sectionPrefix: "1007.1.1" }]
  },
  {
    pattern: /\bone\s+exit\s+stair|single\s+stair|served\s+by\s+one\s+(?:exit\s+)?stair/i,
    label: "single-exit story provisions",
    targets: [{ codePrefix: "BC", sectionPrefix: "1006.3.2" }]
  },
  {
    pattern: /\bmultipurpose\b|accessory\s+(?:assembly|occupancy)|fewer\s+than\s+75/i,
    label: "accessory-assembly classification and occupant-load provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "303.1.3" },
      { codePrefix: "BC", sectionPrefix: "1004.1.3" }
    ]
  },
  {
    pattern: /\bplumbing\s+fixtures?|fixture\s+(?:requirements?|ratios?|calculations?)|fractional\s+fixture/i,
    label: "plumbing-fixture classification and calculation provisions",
    targets: [
      { codePrefix: "PC", sectionPrefix: "403.1", includeDescendants: true },
      { codePrefix: "BC", sectionPrefix: "303.1.3" }
    ]
  },
  {
    pattern: /\boccupant\s+load|movable\s+seats?|fixed\s+seats?|nonsimultaneous|load\s+factor/i,
    label: "occupant-load calculation provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "1004.1", includeDescendants: true },
      { codePrefix: "BC", sectionPrefix: "1004.3" }
    ]
  },
  {
    pattern: /\blegacy\s+fire[- ]alarm|prior[- ]code.*fire[- ]alarm|existing.*fire[- ]alarm|fire[- ]alarm.*enlargement/i,
    label: "existing fire-protection and Group B alarm provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "901.9.1" },
      { codePrefix: "BC", sectionPrefix: "901.9.2" },
      { codePrefix: "BC", sectionPrefix: "901.9.3" },
      { codePrefix: "BC", sectionPrefix: "907.2.2.2" }
    ]
  },
  {
    pattern: /\breplace(?:ment)?\b.*\b(?:entire|existing|legacy)\b|\b(?:entire|existing|legacy)\b.*\breplace(?:ment)?\b/i,
    label: "existing-system alteration scope provisions",
    targets: [{ codePrefix: "BC", sectionPrefix: "901.9.1" }]
  },
  {
    pattern: /\b(change|changes)\s+(?:in\s+)?(?:use|occupancy)|prior[- ]code.*accessib|alteration.*accessib/i,
    label: "alteration and change-of-occupancy accessibility provisions",
    targets: [{ codePrefix: "BC", sectionPrefix: "1101.3", includeDescendants: true }]
  },
  {
    pattern: /\bsidewalk\s+caf[eé]|outdoor[- ]dining|exterior\s+seats?\b/i,
    label: "sidewalk-café and dining-surface accessibility provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "3111", includeDescendants: true },
      { codePrefix: "BC", sectionPrefix: "1108.2.9.1" }
    ]
  }
];

const outsideLibrarySignals = [
  { pattern: /\bHCR\b/i, label: "HCR requirements" },
  { pattern: /\bzoning\b/i, label: "zoning requirements" },
  { pattern: /\bFDNY\b|Fire Department/i, label: "Fire Department requirements" },
  { pattern: /\bADA\b|federal accessibility/i, label: "federal accessibility requirements" },
  { pattern: /\blandmarks?\b|LPC\b/i, label: "Landmarks requirements" },
  { pattern: /\bDEP\b|environmental protection/i, label: "environmental-agency requirements" }
];

function normalizedText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u00AD\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function rawTokens(value) {
  return normalizedText(value).match(/[\p{L}\p{N}]+(?:[.-][\p{L}\p{N}]+)*/gu) || [];
}

function singularForms(token) {
  const forms = new Set([token]);
  if (token.length > 4 && token.endsWith("ies")) forms.add(`${token.slice(0, -3)}y`);
  if (token.length > 4 && token.endsWith("es")) forms.add(token.slice(0, -2));
  if (token.length > 3 && token.endsWith("s")) forms.add(token.slice(0, -1));
  return forms;
}

function queryTermWeights(question) {
  const weights = new Map();
  const add = (term, weight) => {
    const normalized = normalizedText(term);
    if (normalized.length < 2 || stopWords.has(normalized)) return;
    for (const form of singularForms(normalized)) {
      weights.set(form, Math.max(weights.get(form) || 0, weight));
    }
  };
  rawTokens(question).forEach((token) => add(token, /\d/.test(token) ? 1.45 : 1));
  conceptExpansions.forEach(({ pattern, terms }) => {
    if (pattern.test(question)) terms.forEach((term) => add(term, 0.56));
  });
  return weights;
}

function codeReferences(question) {
  const references = [];
  const pattern = /\b(BC|EBC|FC|MC|PC)\s*([0-9]{2,4}(?:\.[0-9A-Za-z-]+)+)\b/gi;
  for (const match of String(question || "").matchAll(pattern)) {
    references.push({
      codePrefix: match[1].toUpperCase(),
      sectionNumber: match[2]
    });
  }
  return references;
}

function queryBigrams(question) {
  const tokens = rawTokens(question).filter((token) => token.length >= 3 && !stopWords.has(token));
  return tokens.slice(0, 50).flatMap((token, index) =>
    index ? [`${tokens[index - 1]} ${token}`] : []
  );
}

function comparableSectionID(value) {
  return String(value || "").trim();
}

function sectionText(section, body) {
  return [
    section.codePrefix,
    section.sectionNumber,
    section.title,
    section.headerLine,
    section.headingLine,
    ...(body?.blocks || []).map((block) => block.plainText || "")
  ].filter(Boolean).join("\n");
}

function passageSegments(body) {
  const segments = [];
  for (const block of body?.blocks || []) {
    const plainText = String(block.plainText || "").replace(/\s+/g, " ").trim();
    if (!plainText) continue;
    if (plainText.length <= 1_800) {
      segments.push({ blockID: String(block.id || ""), text: plainText });
      continue;
    }
    const sentences = plainText.split(/(?<=[.!?;:])\s+(?=[A-Z0-9(])/);
    let current = "";
    for (const sentence of sentences) {
      if (current && current.length + sentence.length + 1 > 1_600) {
        segments.push({ blockID: String(block.id || ""), text: current });
        current = "";
      }
      current = [current, sentence].filter(Boolean).join(" ");
    }
    if (current) segments.push({ blockID: String(block.id || ""), text: current });
  }
  return segments;
}

function passageScore(text, terms, bigrams) {
  const normalized = normalizedText(text);
  const tokens = new Set(rawTokens(normalized));
  let score = 0;
  let matched = 0;
  for (const [term, weight] of terms) {
    if (tokens.has(term) || normalized.includes(term)) {
      score += weight;
      matched += 1;
    }
  }
  score += bigrams.filter((bigram) => normalized.includes(bigram)).length * 1.2;
  if (/\bexception\b/i.test(text)) score += 0.35;
  if (/\b(section|table|chapter)\s+\d/i.test(text)) score += 0.18;
  return { score, matched };
}

function bestPassage(body, terms, bigrams) {
  const ranked = passageSegments(body)
    .map((segment) => ({
      ...segment,
      ...passageScore(segment.text, terms, bigrams)
    }))
    .sort((left, right) =>
      right.score - left.score ||
      right.matched - left.matched ||
      left.text.length - right.text.length
    );
  return ranked[0] || null;
}

function candidateExplanation({ matchedTerms, section, passage, exactReference, matchedRoutes }) {
  const reasons = [];
  if (exactReference) reasons.push(`The question names ${section.codePrefix} ${section.sectionNumber}.`);
  if (matchedRoutes.length) {
    reasons.push(`It falls within the ${matchedRoutes.slice(0, 2).join(" and ")}.`);
  }
  if (matchedTerms.length) {
    reasons.push(`It matches ${matchedTerms.slice(0, 5).map((term) => `“${term}”`).join(", ")}.`);
  }
  if (/\bexception\b/i.test(passage?.text || "")) {
    reasons.push("The proposed passage contains exception language that needs professional review.");
  }
  if (/\b(section|table|chapter)\s+\d/i.test(passage?.text || "")) {
    reasons.push("The proposed passage includes a cross-reference that may require additional evidence.");
  }
  return reasons.join(" ") || "Its enacted text has lexical overlap with the project question.";
}

export function evidenceDiscoveryFeatureEnabled(environment = process.env) {
  return String(environment.PERMITEXT_EVIDENCE_DISCOVERY_BETA || "").trim() === "1";
}

export function validateEvidenceDiscoveryQuestion(value) {
  const question = String(value || "").replace(/\s+/g, " ").trim();
  if (question.length < 3 || question.length > 2_000) {
    throw new Error("Evidence discovery questions must contain between 3 and 2,000 characters.");
  }
  return question;
}

export async function discoverRelevantEvidence({
  question,
  catalog,
  invertedIndex,
  readSectionBody,
  limit = 8
}) {
  const normalizedQuestion = validateEvidenceDiscoveryQuestion(question);
  const sections = Array.isArray(catalog) ? catalog : [];
  const index = invertedIndex instanceof Map ? invertedIndex : new Map();
  const terms = queryTermWeights(normalizedQuestion);
  const bigrams = queryBigrams(normalizedQuestion);
  const references = codeReferences(normalizedQuestion);
  const catalogByID = new Map(sections.map((section) => [comparableSectionID(section.id), section]));
  const scores = new Map();
  const matchedTermsByID = new Map();
  const exactReferenceIDs = new Set();
  const routesByID = new Map();

  for (const reference of references) {
    sections.filter((section) =>
      String(section.codePrefix || "").toUpperCase() === reference.codePrefix &&
      String(section.sectionNumber || "") === reference.sectionNumber
    ).forEach((section) => exactReferenceIDs.add(comparableSectionID(section.id)));
  }
  for (const route of topicRoutes.filter(({ pattern }) => pattern.test(normalizedQuestion))) {
    for (const target of route.targets) {
      for (const section of sections) {
        const sectionNumber = String(section.sectionNumber || "");
        if (
          String(section.codePrefix || "").toUpperCase() !== target.codePrefix ||
          (
            sectionNumber !== target.sectionPrefix &&
            !(target.includeDescendants && sectionNumber.startsWith(`${target.sectionPrefix}.`))
          )
        ) {
          continue;
        }
        const id = comparableSectionID(section.id);
        const routeMatch = routesByID.get(id) || { score: 0, labels: new Set() };
        routeMatch.score += 45;
        routeMatch.labels.add(route.label);
        routesByID.set(id, routeMatch);
      }
    }
  }

  for (const [term, weight] of terms) {
    const posting = index.get(term);
    if (!posting?.size) continue;
    const inverseFrequency = Math.log((sections.length + 1) / (posting.size + 1)) + 1;
    for (const rawID of posting) {
      const id = comparableSectionID(rawID);
      if (!catalogByID.has(id)) continue;
      scores.set(id, (scores.get(id) || 0) + weight * inverseFrequency);
      const matches = matchedTermsByID.get(id) || new Set();
      matches.add(term);
      matchedTermsByID.set(id, matches);
    }
  }
  exactReferenceIDs.forEach((id) => scores.set(id, (scores.get(id) || 0) + 100));
  routesByID.forEach(({ score }, id) => scores.set(id, (scores.get(id) || 0) + score));

  const preliminary = Array.from(scores, ([id, score]) => ({ id, score }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 160);
  const detailed = [];
  for (const entry of preliminary) {
    const section = catalogByID.get(entry.id);
    const body = await readSectionBody(section);
    const fullText = sectionText(section, body);
    if (!fullText.trim()) continue;
    const normalizedFullText = normalizedText(fullText);
    const matchedTerms = Array.from(matchedTermsByID.get(entry.id) || [])
      .filter((term) => normalizedFullText.includes(term));
    const originalTerms = rawTokens(normalizedQuestion)
      .filter((term) => term.length >= 2 && !stopWords.has(term));
    const originalMatches = new Set(
      originalTerms.filter((term) => normalizedFullText.includes(term))
    );
    const coverage = originalTerms.length
      ? originalMatches.size / new Set(originalTerms).size
      : 0;
    const titleText = normalizedText(`${section.sectionNumber || ""} ${section.title || ""}`);
    const titleMatches = originalTerms.filter((term) => titleText.includes(term)).length;
    const phraseMatches = bigrams.filter((bigram) => normalizedFullText.includes(bigram)).length;
    const exactReference = exactReferenceIDs.has(entry.id);
    const routeMatch = routesByID.get(entry.id);
    const passage = bestPassage(body, terms, bigrams);
    if (!passage) continue;
    const finalScore = entry.score +
      coverage * 12 +
      titleMatches * 2.6 +
      phraseMatches * 1.5 +
      passage.score * 1.2 +
      (routeMatch?.score || 0) +
      (exactReference ? 100 : 0);
    detailed.push({
      section,
      passage,
      score: finalScore,
      coverage,
      exactReference,
      matchedRoutes: Array.from(routeMatch?.labels || []),
      matchedTerms: Array.from(new Set([...matchedTerms, ...originalMatches]))
    });
  }

  detailed.sort((left, right) =>
    right.score - left.score ||
    right.coverage - left.coverage ||
    String(left.section.sectionNumber || "").localeCompare(
      String(right.section.sectionNumber || ""),
      undefined,
      { numeric: true, sensitivity: "base" }
    )
  );
  const candidateLimit = Math.min(
    Math.max(Number(limit) || 8, 1),
    evidenceDiscoveryMaximumCandidates
  );
  const topScore = detailed[0]?.score || 1;
  const candidates = detailed.slice(0, candidateLimit).map((item, index) => {
    const relativeScore = item.score / topScore;
    const candidateID = `evidence-candidate-${createHash("sha256")
      .update([
        evidenceDiscoveryVersion,
        normalizedQuestion,
        item.section.id,
        item.passage.text
      ].join("\u001f"))
      .digest("hex")
      .slice(0, 24)}`;
    return {
      id: candidateID,
      candidateState: "candidate",
      rank: index + 1,
      relevance: relativeScore >= 0.72 ? "strong" : relativeScore >= 0.42 ? "possible" : "exploratory",
      score: Math.round(item.score * 1_000) / 1_000,
      sectionID: comparableSectionID(item.section.id),
      codePrefix: String(item.section.codePrefix || ""),
      chapterNumber: String(item.section.chapterNumber || ""),
      sectionNumber: String(item.section.sectionNumber || ""),
      title: String(item.section.title || "Section"),
      selectedText: item.passage.text,
      blockID: item.passage.blockID || null,
      whyRelevant: candidateExplanation(item),
      signals: {
        matchedTerms: item.matchedTerms.slice(0, 12),
        topicRoutes: item.matchedRoutes,
        exactReference: item.exactReference,
        containsException: /\bexception\b/i.test(item.passage.text),
        containsCrossReference: /\b(section|table|chapter)\s+\d/i.test(item.passage.text)
      }
    };
  });

  const coverageLimitations = [{
    kind: "candidate-review-required",
    text: "These are unapproved candidates. Only passages you approve can enter Analyze Selected Evidence."
  }, {
    kind: "retrieval-completeness",
    text: "Lexical retrieval can miss exceptions, cross-references, tables, definitions, or requirements expressed with different terminology."
  }];
  if (/\b(this|that|the above|attached)\s+(section|passage|requirement)\b/i.test(normalizedQuestion) && !references.length) {
    coverageLimitations.push({
      kind: "query-context-required",
      text: "The question refers to a section without identifying it. Add the code citation or open the section and select its enacted text."
    });
  }
  const outsideCurrentLibrary = outsideLibrarySignals
    .filter(({ pattern }) => pattern.test(normalizedQuestion))
    .map(({ label }) => ({
      kind: "outside-current-library",
      label,
      text: `${label} may require authoritative material outside Permitext's current 2022 NYC Construction Codes library.`
    }));
  if (outsideCurrentLibrary.length) {
    coverageLimitations.push({
      kind: "outside-current-library",
      text: "The current candidate set does not establish requirements controlled by the outside authorities identified below."
    });
  }

  return {
    schemaVersion: 1,
    retrievalVersion: evidenceDiscoveryVersion,
    question: normalizedQuestion,
    candidateState: "unreviewed",
    candidates,
    coverageLimitations,
    outsideCurrentLibrary,
    searchedSectionCount: sections.length
  };
}
