// Resolve explicit narrative references to supplied evidence before verification.
// This does not infer a rule, its applicability, or an unmentioned authority.
export const researchNarrativeSourceBindingVersion = "20260909-explicit-narrative-citations-v1";
const compact = value => String(value || "").replace(/\s+/g, " ").trim();
const normalize = value => String(value || "").replace(/[*_`]/g, "").replace(/[‐‑‒–−]/g, "-");
const number = String.raw`(?:\d{1,3}-\d{2,3}(?:\.\d+)*|\d{2,4}(?:\.\d+)+)`;
const reference = String.raw`\b(AC|BC|EBC|FC|FGC|MC|PC|ZR)\s+(?:§\s*|section\s+)?(${number})(?![\w.(-])`;
const predicate = String.raw`(?:requires?|provides?|permits?|allows?|prohibits?|establishes?|defines?|excludes?|includes?|authorizes?|limits?|applies|states?|specifies|governs?)`;
const subject = new RegExp(`${reference}\\s+(?:(?:also|expressly|specifically|itself)\\s+)?${predicate}\\b`, "gi");
const condition = new RegExp(String.raw`\bsubject\s+to\s+${reference}(?=\s*[,;:]|\s+(?:requirements?|rules?|provisions?)\b)`, "gi");

export function bindResearchNarrativeSources(answer, evidence = []) {
  const unchanged = { answer, repairs: [] };
  if (!answer || typeof answer.answerText !== "string" || !Array.isArray(answer.citations) ||
      !Array.isArray(evidence)) return unchanged;
  const declarations = new Map();
  const text = normalize(answer.answerText);
  for (const pattern of [subject, condition]) for (const match of text.matchAll(pattern)) {
    const codePrefix = match[1].toUpperCase(), sectionNumber = match[2];
    declarations.set(`${codePrefix} ${sectionNumber}`, { codePrefix, sectionNumber });
  }
  const citations = [...answer.citations], repairs = [];
  for (const [label, declaration] of declarations) {
    const matches = evidence.filter(source => compact(source.codePrefix).toUpperCase() === declaration.codePrefix &&
      compact(source.sectionNumber) === declaration.sectionNumber);
    // Multiple passages/editions, repeated IDs and missing source text require
    // ordinary review. A parent section or incorporated reference is not enough.
    if (matches.length !== 1) continue;
    const source = matches[0];
    if (!source.sourceID || !source.sectionID || !compact(source.text) ||
        evidence.filter(other => other.sourceID === source.sourceID).length !== 1 ||
        evidence.some(other => other.sectionID === source.sectionID &&
          ["codePrefix", "sectionNumber", "corpusID", "codeVersion", "codeEdition"].some(field => other[field] !== source[field])) ||
        [source.evidenceRole, source.evidencePriority?.evidenceRole].some(role => ["contextual", "irrelevant"].includes(role)) ||
        [source.topicRouteRelationship, source.evidencePriority?.topicRouteRelationship].includes("collateral")) continue;
    // Never replace, merge or bless an existing conflicting citation identity.
    if (citations.some(citation => citation.sourceIDs?.includes(source.sourceID) ||
      String(citation.sectionID || "") === String(source.sectionID) ||
      (compact(citation.codePrefix).toUpperCase() === declaration.codePrefix && compact(citation.sectionNumber) === declaration.sectionNumber))) continue;
    const citation = { sectionID: source.sectionID, sourceIDs: [source.sourceID],
      relevance: `Provides the ${label} rule referenced in the answer.` };
    citations.push(citation);
    repairs.push({ ...declaration, sectionID: source.sectionID, sourceID: source.sourceID, citationIndex: citations.length - 1 });
  }
  return repairs.length ? { answer: { ...answer, citations }, repairs } : unchanged;
}
