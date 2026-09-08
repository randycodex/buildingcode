// Reviewed reference identities, not an answer key. Every passage still has to
// resolve from the authorized enacted corpus; no numeric rules are supplied here.
// Basis: NYC DOB 2022 BC Chapter 10, Sections 1012, 1014 and 1020.2.
// This is baseline ramp coverage, not the entire referenced accessibility or
// guard standard. Guard scoping stays present; detailed guard design is separate.
import { zoningContextExcerptVersion } from "./research-zoning-context-excerpts.mjs";

export const researchTopicDependencyVersion = "20260908-storage-dependencies-v2";

const rampDependencies = Object.freeze([
  ["1012.6.1", "landing slope"],
  ["1012.6.2", "landing width"],
  ["1012.6.3", "landing length and exceptions"],
  ["1012.6.4", "turning landings and exceptions"],
  ["1012.6.5", "door maneuvering clearance relationship"],
  ["1014.2", "handrail height and exceptions"],
  ["1014.6", "handrail extensions and exceptions"],
  ["1014.7", "handrail clearance"],
  ["1012.7.2", "outdoor drainage and winter conditions"],
  ["1012.10.1", "edge protection dimensions"],
  ["1012.5.2", "egress ramp headroom"],
  ["1012.5.3", "egress width and door restrictions"],
  ["1020.2", "egress width and capacity dependency"],
  ["1012.9", "guard scoping"]
]);

export function researchTopicDependencyPlan({ question = "", sources = [] } = {}) {
  // ZR 42-191 marks self-service storage with both the limited-applicability
  // and additional-conditions notations. A 42-192 excerpt alone cannot supply
  // that row or the 42-193 performance-standard dependency. This plan is only
  // for an independently assembled, unresolved-applicability source excerpt.
  const storageAnchor = sources.find((source) => source.codePrefix === "ZR" && source.sectionNumber === "42-192" &&
    source.targetedZoningContext?.version === zoningContextExcerptVersion &&
    source.targetedZoningContext?.purpose === "unresolved_storage_applicability" &&
    ["codeEdition", "codeVersion", "corpusID", "jurisdiction"].every((field) => String(source[field] || "").trim()));
  if (storageAnchor && /\bself[- ](?:service\s+)?storage\b/i.test(question)) return {
    id: "nyc-zoning-storage-applicability", version: researchTopicDependencyVersion, anchor: storageAnchor,
    label: "Storage applicability", corpusPrefix: "ZR",
    coverageReason: "Use-allowance and additional-condition dependency; retain scope and exceptions.",
    references: [["42-191", "use allowances and notation legend"], ["42-193", "additional conditions"]]
      .map(([sectionNumber, purpose]) => ({ codePrefix: "ZR", sectionNumber, purpose,
        codeEdition: storageAnchor.codeEdition, codeVersion: storageAnchor.codeVersion,
        corpusID: storageAnchor.corpusID, jurisdiction: storageAnchor.jurisdiction }))
  };
  if (!/\bramps?\b/i.test(question) || !/\b(?:requirements?|design(?:ing)?|layout)\b/i.test(question)) return null;
  if (/\b(?:construction[- ]site|construction\s+ramps?|runways?|motor[- ]vehicle|vehicular|curb\s+ramps?)\b/i.test(question)) return null;
  if (/\b(?:only|selected|2014|2008|1968)\b/i.test(question)) return null;
  // Require independently resolved anchors from a single, positively identified
  // edition. Missing identity is not permission to borrow current-edition text.
  const anchors = sources.filter((source) => source.codePrefix === "BC" &&
    ["1012.2", "1012.6", "1012.8"].includes(source.sectionNumber));
  const anchor = anchors.find((source) => /\b2022\b/.test(source.codeEdition || "") &&
    /new york city|nyc/i.test(source.codeEdition || ""));
  if (!anchor || !["codeVersion", "corpusID", "jurisdiction"].every((field) => String(anchor[field] || "").trim()) ||
    new Set(anchors.filter((source) => sameTopicDependencyCorpus(source, anchor))
    .map((source) => source.sectionNumber)).size !== 3) return null;
  return {
    id: "nyc-2022-pedestrian-ramp-design",
    version: researchTopicDependencyVersion,
    anchor,
    label: "Ramp design", corpusPrefix: "BC",
    coverageReason: "Dimensional dependency; retain scope and exceptions.",
    references: rampDependencies.map(([sectionNumber, purpose]) => ({
      codePrefix: "BC", sectionNumber, purpose,
      codeEdition: anchor.codeEdition, codeVersion: anchor.codeVersion,
      corpusID: anchor.corpusID, jurisdiction: anchor.jurisdiction
    }))
  };
}

export function sameTopicDependencyCorpus(source, anchor) {
  return ["codeEdition", "codeVersion", "corpusID", "jurisdiction"]
    .every((field) => String(source?.[field] || "") === String(anchor?.[field] || ""));
}
