// Reviewed reference identities, not an answer key. Every passage still has to
// resolve from the authorized enacted corpus; no numeric rules are supplied here.
// Basis: NYC DOB 2022 BC Chapter 10, Sections 1012, 1014 and 1020.2.
// This is baseline ramp coverage, not the entire referenced accessibility or
// guard standard. Guard scoping stays present; detailed guard design is separate.
import { zoningContextExcerptVersion } from "./research-zoning-context-excerpts.mjs";

export const researchTopicDependencyVersion = "20260930-transparency-applicability-definitions-v7";

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
  const streetscapeAnchor = sources.find(source => source.codePrefix === "ZR" &&
    ["37-34", "32-321"].includes(source.sectionNumber) && source.canonicalContextComplete &&
    ["codeEdition", "codeVersion", "corpusID", "jurisdiction"].every(field => String(source[field] || "").trim()));
  if (streetscapeAnchor && /\b(?:transparency|streetscape|street[- ]wall|primary frontage)\b/i.test(question)) {
    // The query may append the prior topic and property inventory. Scope this
    // turn from its own question so a sill-height follow-up does not repeat the
    // entire frontage-classification investigation.
    const currentQuestion = String(question).replace(/^Follow-up:\s*/i, "").split("\n")[0];
    const measurementOnly = /\b(?:measur\w*|sills?|slop(?:e|es|ing)|glazing[- ]start|start[- ]height)\b/i.test(currentQuestion) &&
      !/\b(?:governing|applicab\w*|classif\w*|exceptions?|alternatives?|which\s+(?:rule|standard|section))\b/i.test(currentQuestion);
    // These are reviewed source identities, not a classification of the lot.
    // 32-301 defines tiers; 32-302 supplies exceptions, not tier definitions.
    // Keep the default, alternative, existing-work and Tier C relationships
    // together before asking a user for a legal conclusion we can investigate.
    const references = ["37-31", "37-311", "37-34", "32-30", "32-321",
      ...(!measurementOnly ? ["32-301", "32-302", "32-31", "32-311", "32-322", "32-33", "32-34"] : []),
      ...(!measurementOnly && /\bparking\b/i.test(currentQuestion) ? ["32-312"] : [])]
      .map(sectionNumber => ({ codePrefix: "ZR", sectionNumber,
        purpose: "frontage applicability and transparency rule", claimCoverageRequired: false,
        applicabilityCandidate: true,
        codeEdition: streetscapeAnchor.codeEdition, codeVersion: streetscapeAnchor.codeVersion,
        corpusID: streetscapeAnchor.corpusID, jurisdiction: streetscapeAnchor.jurisdiction }));
    if (!measurementOnly) references.push({ codePrefix: "ZR", sectionNumber: "12-10",
      purpose: "complete definitions used by frontage applicability and the community-facility-building exception",
      definitionLabels: ["special streetscape area", "community facility building"],
      claimCoverageRequired: false, codeEdition: streetscapeAnchor.codeEdition,
      codeVersion: streetscapeAnchor.codeVersion, corpusID: streetscapeAnchor.corpusID,
      jurisdiction: streetscapeAnchor.jurisdiction });
    return {
      id: "nyc-zoning-transparency-applicability", version: researchTopicDependencyVersion,
      anchor: streetscapeAnchor, label: "Transparency applicability", corpusPrefix: "ZR",
      preserveGenericExpansion: false, maximumGenericCrossReferences: 0,
      coverageReason: "Explain transparency together with its applicability and frontage definitions; retrieval does not establish the property's district.",
      references
    };
  }
  const doorAnchor = sources.find(source => source.codePrefix === "BC" && source.sectionNumber === "1010.1.2.2" &&
    source.canonicalContextComplete === true && !source.truncated && source.corpusID === "nyc-2022-construction-codes" &&
    /\b2022\b/.test(source.codeEdition || "") &&
    ["codeEdition", "codeVersion", "corpusID", "jurisdiction"].every(field => String(source[field] || "").trim()));
  if (doorAnchor && /\bdoor\b.*\bswings?\b/i.test(question) &&
      !/\b(?:selected|pinned|only|2014|2008|1968)\b/i.test(question)) return {
    id: "nyc-2022-door-swing-exit-count", version: researchTopicDependencyVersion, anchor: doorAnchor,
    label: "Exit-count dependency of door swing", corpusPrefix: "BC", preserveGenericExpansion: true,
    coverageReason: "Review the exit-count rule before asking the user for a legal conclusion; request unresolved physical facts instead.",
    references: ["1006.2.1"].map(sectionNumber => ({ codePrefix: "BC", sectionNumber,
      purpose: "room exit-count and common-path conditions", claimCoverageRequired: false,
      codeEdition: doorAnchor.codeEdition, codeVersion: doorAnchor.codeVersion,
      corpusID: doorAnchor.corpusID, jurisdiction: doorAnchor.jurisdiction }))
  };
  // The alteration overview refers to value and work-specific triggers. Keep
  // those operative passages available even when lexical ranking favors
  // occupancy branches; retrieval does not establish their applicability.
  const alterationAnchor = sources.find(source => source.codePrefix === "BC" && source.sectionNumber === "901.9" &&
    source.corpusID === "nyc-2022-construction-codes" && /\b2022\b/.test(source.codeEdition || "") &&
    ["codeEdition", "codeVersion", "corpusID", "jurisdiction"].every(field => String(source[field] || "").trim()));
  if (alterationAnchor && /\bsprinklers?\b/i.test(question)) return {
    id: "nyc-2022-sprinkler-alteration-review", version: researchTopicDependencyVersion, anchor: alterationAnchor,
    label: "Existing-building fire-protection review", corpusPrefix: "BC", preserveGenericExpansion: true,
    coverageReason: "Review referenced alteration triggers without assuming every branch applies.",
    references: ["901.9.1", "901.9.2", "901.9.3", "901.9.4", "901.9.4.1", "901.9.4.2", "901.9.4.3", "901.9.5", "901.9.6",
      ...(/\b(?:Group\s+B|office)\b/i.test(question) ? ["903.2.2", "903.2.2.1", "903.2.2.2"] : [])]
      .map(sectionNumber => ({ codePrefix: "BC", sectionNumber, purpose: "alteration applicability review",
        claimCoverageRequired: false, codeEdition: alterationAnchor.codeEdition, codeVersion: alterationAnchor.codeVersion,
        corpusID: alterationAnchor.corpusID, jurisdiction: alterationAnchor.jurisdiction }))
  };
  // The general issuance rule does not contain temporary/interim eligibility.
  // Make the complete alternative sources available for review, without
  // requiring a readiness checklist or asserting that an alternative applies.
  const occupancyDecision = /\bcertificate\s+of\s+occupancy\b/i.test(question) &&
    /\b(?:can|may)\b[^?]{0,120}\b(?:occupy|use)\b|\boccupancy\s+(?:allowed|permitted|lawful|legal)\b|\b(?:authoriz\w*|permit\w*)\s+(?:the\s+)?occupancy\b/i.test(question) &&
    !/\b(?:DOB\s*NOW|portal|selected|pinned)\b/i.test(question);
  const occupancyAnchors = sources.filter(source => source.codePrefix === "AC" && source.sectionNumber === "28-118.1" &&
    source.canonicalContextComplete === true && !source.truncated && source.corpusID === "nyc-2022-construction-codes" &&
    /\b2022\b/.test(source.codeEdition || "") &&
    ["codeEdition", "codeVersion", "corpusID", "jurisdiction"].every(field => String(source[field] || "").trim()) &&
    /No building or open lot shall be used or occupied without a certificate of occupancy issued by the commissioner\./i.test(source.text || ""));
  if (occupancyDecision && occupancyAnchors.length === 1) {
    const anchor = occupancyAnchors[0];
    return {
      id: "nyc-2022-occupancy-certificate-alternatives", version: researchTopicDependencyVersion, anchor,
      label: "Occupancy certificate alternatives", corpusPrefix: "AC", preserveGenericExpansion: true,
      coverageReason: "Review complete certificate eligibility and validity; do not infer applicability from a certificate name.",
      references: [
        ["28-118.15", "temporary certificate authority, safety condition and validity period"],
        ["28-118.15.1", "interim certificate eligibility and exceptions"],
        ["28-118.15.1.1", "interim certificate issuance"],
        ["28-118.15.1.2", "interim certificate duration"],
        ["28-118.15.2", "temporary and interim certificate revocation or suspension"],
        ["28-118.20", "partial certificate scope and conditions"]
      ].map(([sectionNumber, purpose]) => ({ codePrefix: "AC", sectionNumber, purpose,
        claimCoverageRequired: false, codeEdition: anchor.codeEdition, codeVersion: anchor.codeVersion,
        corpusID: anchor.corpusID, jurisdiction: anchor.jurisdiction }))
    };
  }
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
