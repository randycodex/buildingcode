// Reviewed reference identities, not an answer key. Every passage still has to
// resolve from the authorized enacted corpus; no numeric rules are supplied here.
// Basis: NYC DOB 2022 BC Chapter 10, Sections 1012, 1014 and 1020.2.
// This is baseline ramp coverage, not the entire referenced accessibility or
// guard standard. Guard scoping stays present; detailed guard design is separate.
export const researchTopicDependencyVersion = "20260903-ramp-dependencies-v1";

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
