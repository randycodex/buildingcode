import { stipulatedFountainSubstitutionQuestion } from "./evidence-discovery.mjs";

const compact = (value) => String(value || "").replace(/\s+/g, " ").trim();
const escapePattern = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function visibleReplacementHeight(answerText, inches, millimeters) {
  const units = [`${escapePattern(inches)}\\s*[- ]?\\s*(?:inches|inch|in\\b|[″"])`];
  if (millimeters) units.push(`${escapePattern(millimeters)}\\s*[- ]?\\s*mm\\b`);
  const dimension = new RegExp(`\\b(?:${units.join("|")})`, "i");
  const sentences = String(answerText || "").replace(/[*_`]/g, "")
    .split(/(?<=[.!?])\s+|\n+/);
  return sentences.some((sentence) => {
    const actor = sentence.match(/\b(?:replacement|substitut(?:ed|e)|dedicated|bottle[- ]filling)\s+(?:(?:bottle[- ]filling|container[- ]filling)\s+)?(?:fixtures?|stations?|units?)\b/i);
    if (!actor) return false;
    const condition = sentence.slice(actor.index + actor[0].length);
    const measurement = condition.match(dimension);
    if (!measurement) return false;
    // A height subsequently attributed to a retained fountain does not supply
    // the replacement-fixture condition. This detects omission, not truth;
    // the ordinary semantic verifier still judges the entire resulting answer.
    // A later adjacency clause can legitimately name the retained fountain.
    // Only a subject change before the dimension makes that height ambiguous.
    const beforeMeasurement = condition.slice(0, measurement.index);
    return !/\bdrinking[- ]fountains?\b/i.test(beforeMeasurement) &&
      !/\b(?:width|diameter)\b/i.test(condition) &&
      /\b(?:containers?|bottles?)\b/i.test(condition) &&
      /\b(?:height|high|tall|fill\w*|accommodat\w*|accept\w*)\b/i.test(condition);
  });
}

/** Complete only obligations already present in exact cited enacted passages.
 * Call before semantic verification. This function cannot approve an answer.
 * No reference answer, canonical expansion, new source or outside text is used.
 */
export function applyResearchPlumbingSourceRepairs(answer, evidence = [], { question = "" } = {}) {
  if (!answer || typeof answer !== "object") return answer;
  const cited = new Set((answer.citations || []).flatMap((citation) => citation.sourceIDs || []));
  const sources = (Array.isArray(evidence) ? evidence : []).filter((source) =>
    source?.sourceID && cited.has(source.sourceID) && compact(source.codePrefix).toUpperCase() === "PC" &&
    !["contextual", "irrelevant"].includes(source.evidenceRole || source.evidencePriority?.evidenceRole)
  );
  let result = answer;
  const replacements = sources.filter((source) => compact(source.sectionNumber) === "410.3" &&
    source.evidencePriority?.claimCoverageRequired === true);
  if (replacements.length === 1 && stipulatedFountainSubstitutionQuestion(question)) {
    const source = replacements[0];
    const condition = compact(source.text).match(/dedicated plumbing fixtures with faucets designed for filling a container at least (\d+(?:\.\d+)?) inches(?:\s*\((\d+(?:\.\d+)?)\s*mm\))? in height/i);
    const hasBoundPoint = (answer.supportedPoints || []).some((point) => point.sourceIDs?.includes(source.sourceID));
    if (condition && hasBoundPoint && !visibleReplacementHeight(answer.answerText, condition[1], condition[2])) {
      const metric = condition[2] ? ` (${condition[2]} mm)` : "";
      const sentence = `Each replacement bottle-filling fixture must have a faucet designed to fill a container at least ${condition[1]} inches${metric} high (PC § 410.3).`;
      const answerText = [answer.answerText, sentence].filter(Boolean).join("\n\n");
      const paragraphs = answerText.split(/\n\s*\n/);
      result = { ...answer, answerText,
        ...(typeof answer.conclusion === "string" ? { conclusion: paragraphs[0] } : {}),
        ...(typeof answer.explanation === "string" ? { explanation: paragraphs.slice(1).join("\n\n") } : {}) };
    }
  }

  const laundry = sources.filter((source) => compact(source.sectionNumber) === "412.4" &&
    /central washing facilities[\s\S]*automatic clothes washers[\s\S]*floor drains[\s\S]*provided with lint strainers/i.test(compact(source.text)));
  const outletIDs = new Set(sources.filter((source) => compact(source.sectionNumber) === "412.3")
    .map((source) => source.sourceID));
  if (laundry.length === 1 && outletIDs.size) {
    let changed = false;
    const supportedPoints = (result.supportedPoints || []).map((point) => {
      if (!/\blint strainers?\b/i.test(compact(point.explanation)) ||
          !point.sourceIDs?.some((sourceID) => outletIDs.has(sourceID)) ||
          point.sourceIDs.includes(laundry[0].sourceID)) return point;
      changed = true;
      return { ...point, sourceIDs: [...point.sourceIDs, laundry[0].sourceID] };
    });
    if (changed) result = { ...result, supportedPoints };
  }
  return result;
}
