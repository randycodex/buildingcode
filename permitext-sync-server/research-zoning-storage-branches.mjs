import { zoningContextExcerptVersion } from "./research-zoning-context-excerpts.mjs";

// These checks require coverage, not a prescribed answer. The selected enacted
// paragraph set supplies the branches; no benchmark answer enters production.
// Presence checks do not establish entailment, which still needs the verifier.
export function zoningStorageBranchObligations(evidence = []) {
  return evidence.flatMap((source) => {
    const context = source.targetedZoningContext;
    if (source.codePrefix !== "ZR" || source.sectionNumber !== "42-192" || !source.sourceID ||
        context?.version !== zoningContextExcerptVersion || context.purpose !== "unresolved_storage_applicability") return [];
    const text = String(source.text || "");
    const base = { kind: "conditional_branch_coverage", sourceIDs: [source.sourceID], values: [],
      requireAllValues: false, requireSourceBound: true, allowAdditionalBoundSources: true };
    const obligations = [];
    if (/may be reconstructed on the same zoning lot/.test(text) && /does not exceed the floor area permitted/.test(text)) {
      obligations.push({ ...base, id: "storage_documented_reconstruction_branch",
        detail: "Briefly preserve the supplied reconstruction branch: a damaged or destroyed building with satisfactory DOB documentation may be reconstructed on the same zoning lot, subject to the Section 43-10 floor-area cap. Do not apply it to the unidentified property or invent the cap's numerical value.",
        requiredPatterns: [String.raw`\breconstruct\w*\b`, String.raw`\b(?:damag\w*|destroy\w*|destruction)\b`,
          String.raw`\b(?:same|original)\s+zoning[- ]lot\b`, String.raw`\b(?:document\w*|DOB)\b`,
          String.raw`\bfloor[- ]area\b[^.!?]{0,100}\b(?:limit|cap|maximum|permitted|43-10)\b|\b(?:limit|cap|maximum)\b[^.!?]{0,50}\bfloor[- ]area\b`] });
    }
    if (/does not file such documentation satisfactory/.test(text) && /shall be considered non-conforming/.test(text)) {
      obligations.push({ ...base, id: "storage_undocumented_nonconforming_branch",
        detail: "Briefly preserve the supplied alternative: a facility existing on December 19, 2017 without the satisfactory DOB documentation is nonconforming and subject to Article V. Do not assume either dated existence or documentation for the unidentified property.",
        requiredPatterns: [String.raw`\bnon[- ]?conforming(?:[- ]use)?\b`, String.raw`\b(?:document\w*|DOB)\b`,
          String.raw`\bArticle\s+(?:V|5)\b`] });
    }
    return obligations;
  });
}
