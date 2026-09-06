import assert from "node:assert/strict";
import {
  canonicalResearchOfficialGuidanceNarrative,
  classifyResearchWebSource,
  extractResearchOfficialDocumentReferences,
  normalizeResearchOfficialDomains,
  normalizeResearchWebSources,
  researchDiscoveryNeedsAutomaticWebSupport,
  researchSourcePolicyConfiguration,
  researchSourcePolicyVersion,
  researchWebSupportTrigger,
  sanitizeResearchWebQuery,
  shouldUseResearchWebSupport,
  unresolvedResearchAuthorityAcronyms
} from "../research-source-policy.mjs";

assert.match(researchSourcePolicyVersion, /^\d{8}-supporting-web-v\d+$/);
assert.deepEqual(
  canonicalResearchOfficialGuidanceNarrative(["Same claim.", "Same   claim."]),
  {
    claims: ["Same claim."],
    authorityStatement: "Official supporting guidance — noncontrolling and not an enacted-code conclusion.",
    enactedBoundary: "The assembled enacted evidence did not establish the requested rule; Permitext is reporting only the exact official supporting guidance attributed below.",
    explanation: "- Same claim.",
    answerText: "Official supporting guidance — noncontrolling and not an enacted-code conclusion.\n\n- Same claim."
  }
);

assert.equal(researchSourcePolicyConfiguration({}).webSupportEnabled, true);
for (const disabledValue of ["0", "false", "OFF", "disabled", "no"]) {
  assert.equal(
    researchSourcePolicyConfiguration({ PERMITEXT_RESEARCH_WEB_SUPPORT: disabledValue }).webSupportEnabled,
    false
  );
}
assert.equal(
  researchSourcePolicyConfiguration({ PERMITEXT_RESEARCH_WEB_SUPPORT: "1" }).webSupportEnabled,
  true
);
assert.deepEqual(
  researchSourcePolicyConfiguration({
    PERMITEXT_RESEARCH_WEB_OFFICIAL_DOMAINS: "DOB.Example.gov, https://www.CODE.example.gov/path dob.example.gov"
  }).officialDomains,
  ["dob.example.gov", "code.example.gov"]
);
assert.deepEqual(
  normalizeResearchOfficialDomains(["www.nyc.gov", ".NYC.gov.", "rules.cityofnewyork.us"]),
  ["nyc.gov", "rules.cityofnewyork.us"]
);
assert(researchSourcePolicyConfiguration({}).officialDomains.includes("ny.gov"));
assert(researchSourcePolicyConfiguration({}).officialDomains.includes("ada.gov"));

const sanitized = sanitizeResearchWebQuery(
  "Client: Acme Tower LLC; email lead@acme.example, call (212) 555-0199. " +
  "Project at 123 West 42nd Street, Suite 9. Find NYC BC 1019.3 DOB guidance."
);
assert.doesNotMatch(sanitized, /Acme Tower|lead@|212|123 West 42nd|Suite 9/i);
assert.match(sanitized, /NYC BC 1019\.3 DOB guidance/);

const sanitizedProjectIdentifiers = sanitizeResearchWebQuery(
  "BBL: 2028500003; Block 2850, Lot 3; Jerome Avenue and East 176th Street. " +
  "Find official NYC zoning guidance for off-street parking."
);
assert.doesNotMatch(sanitizedProjectIdentifiers, /2028500003|2850|Lot 3|Jerome|176th/i);
assert.match(sanitizedProjectIdentifiers, /NYC zoning guidance for off-street parking/);

assert.deepEqual(
  extractResearchOfficialDocumentReferences(
    "Use Buildings Bulletin 2022-013, BB 2022-013, and DOB Bulletin No. 2025-001."
  ),
  ["Buildings Bulletin 2022-013", "Buildings Bulletin 2025-001"]
);
assert.deepEqual(extractResearchOfficialDocumentReferences("What does BC 718.2.6 require?"), []);

assert.equal(
  shouldUseResearchWebSupport({ question: "Find official DOB guidance about this exception." }, {}),
  true
);
assert.equal(
  shouldUseResearchWebSupport({ question: "Check the referenced standard outside the library." }, {}),
  true
);
assert.equal(shouldUseResearchWebSupport({ question: "What does BC 1019.3 require?" }, {}), false);
const selectedRampSummary = "Using the selected 2014 BC 1010.2 passage, summarize the ramp slope rule and its stated exceptions for this synthetic Project. Keep the Project’s assumptions and partial sprinkler coverage explicit; do not treat them as confirmed applicability or whole-building sprinkler protection. Identify what must be verified before applying the rule.";
for (const question of [
  selectedRampSummary,
  "Summarize the selected BC 1010.2 passage and identify its limits.",
  "Explain the supplied Building Code text and keep unconfirmed facts explicit.",
  "From the provided passages, restate the rule and its exceptions."
]) {
  assert.deepEqual(researchWebSupportTrigger({
    question, outsideLibraryRequired: true, referencedStandardUnavailable: true
  }, {}).reasons, ["selected_evidence_boundary"],
  "Outside-library discovery must not expand a selected-text summary into a web lookup.");
  assert.equal(shouldUseResearchWebSupport({ question, outsideLibraryRequired: true }, {}), false);
}
for (const suffix of [
  " Find and summarize Buildings Bulletin 2022-013.",
  " Also check current official DOB guidance.",
  " Consult the referenced standard outside the library.",
  " Review the manufacturer's instructions.",
  " Open the official DOB website and verify the current requirements."
]) {
  assert.equal(shouldUseResearchWebSupport({ question: selectedRampSummary + suffix }, {}), true,
    `An explicit outside request must override the summary boundary: ${suffix}`);
}
assert.equal(shouldUseResearchWebSupport({ question: selectedRampSummary, guidanceRequested: true }, {}), true);
assert.equal(shouldUseResearchWebSupport({
  question: "What are all the requirements for designing a ramp?", outsideLibraryRequired: true
}, {}), true, "A general design request must retain automatic outside-library support.");
assert.deepEqual(
  researchWebSupportTrigger({
    question: "Does the current Permitext Construction Code evidence prove that this cellar bathroom is permitted under Buildings Bulletin 2011-010?",
    outsideLibraryRequired: true
  }, {}),
  {
    useWeb: false,
    reasons: ["selected_evidence_boundary"],
    configuration: researchSourcePolicyConfiguration({})
  },
  "A question about the limits of selected evidence must not fail merely because an outside authority named in the question cannot be retrieved."
);
assert.deepEqual(
  researchWebSupportTrigger({
    question: "Based on AC 28-102.4, AC 28-102.4.2, AC 28-118.3.1, and AC 28-118.3.2, may the former occupancy resume automatically?",
    outsideLibraryRequired: true
  }, {}),
  {
    useWeb: false,
    reasons: ["selected_evidence_boundary"],
    configuration: researchSourcePolicyConfiguration({})
  },
  "A question expressly bounded to named enacted provisions must not add automatic web guidance."
);
assert.equal(
  researchWebSupportTrigger({
    question: "Find and summarize Buildings Bulletin 2011-010 from the official DOB website."
  }, {}).useWeb,
  true,
  "An explicit request to retrieve a named outside authority must still use attributable official web support."
);
assert.equal(
  shouldUseResearchWebSupport(
    { question: "Find official guidance." },
    { PERMITEXT_RESEARCH_WEB_SUPPORT: "off" }
  ),
  false
);
assert.deepEqual(
  researchWebSupportTrigger({ corpusCoverage: "incomplete" }, {}).reasons,
  ["outside_library_support_needed"]
);
assert.equal(
  researchDiscoveryNeedsAutomaticWebSupport({
    outsideCurrentLibrary: [{
      label: "NYC Zoning Resolution Research",
      sourceName: "NYC Zoning Resolution"
    }],
    unavailableCorpora: [{
      id: "nyc-zoning-resolution",
      label: "NYC Zoning Resolution",
      blockedReason: "Zoning Research is intentionally disabled."
    }]
  }),
  false,
  "An intentionally blocked corpus must not be routed around its governance gate through automatic web support."
);
assert.equal(
  researchDiscoveryNeedsAutomaticWebSupport({
    outsideCurrentLibrary: [{
      label: "Manufacturer installation instructions",
      sourceName: "Equipment manufacturer"
    }],
    unavailableCorpora: [{
      id: "nyc-zoning-resolution",
      label: "NYC Zoning Resolution"
    }]
  }),
  true,
  "A genuinely separate outside-library source may still trigger automatic supporting-web research."
);
assert.deepEqual(unresolvedResearchAuthorityAcronyms("Does HCR require a vanity?"), ["HCR"]);
assert.deepEqual(unresolvedResearchAuthorityAcronyms("What does OMH require?"), []);
assert.deepEqual(
  researchWebSupportTrigger({
    question: "This feasibility must comply with NYS Office of Mental Health guidelines. Research the minimum bathroom, toilet, and ADA requirements.",
    outsideLibraryRequired: true
  }, {}).reasons,
  ["outside_library_support_needed"]
);
assert.equal(
  classifyResearchWebSource({ url: "https://omh.ny.gov/omhweb/guidance" }).sourceClassification,
  "official_guidance"
);
assert.deepEqual(
  unresolvedResearchAuthorityAcronyms("What does Homes and Community Renewal (HCR) require?"),
  []
);
assert.deepEqual(
  researchWebSupportTrigger({
    question: "Does this section prove that HCR requires a vanity?",
    outsideLibraryRequired: true
  }, {}),
  {
    useWeb: false,
    reasons: ["outside_authority_identity_required"],
    configuration: researchSourcePolicyConfiguration({})
  }
);
assert.deepEqual(
  researchWebSupportTrigger({
    question: "Using current official NYC Department of Buildings web guidance, summarize the boiler inspection exemptions."
  }, {}).reasons,
  ["official_guidance_requested", "outside_library_support_needed"]
);
assert.equal(
  researchWebSupportTrigger({
    question: "On the current official NYC Department of Buildings Boiler Compliance page, which registered low-pressure boilers require annual inspections?"
  }, {}).reasons.includes("official_guidance_requested"),
  true,
  "A named official agency page must use source-bound guidance even when the word guidance is omitted."
);
assert.equal(
  researchWebSupportTrigger({ question: "Check this referenced standard outside the library." }, {})
    .reasons.includes("official_guidance_requested"),
  false,
  "An automatic outside-library lookup must not authorize a guidance-only answer."
);

assert.deepEqual(
  classifyResearchWebSource(
    { url: "https://bulletins.dob.example.gov/notice" },
    { officialDomains: ["dob.example.gov"] }
  ),
  {
    sourceClassification: "official_guidance",
    sourceRole: "supporting",
    controlling: false
  }
);
assert.equal(
  classifyResearchWebSource(
    { url: "https://example.com/commentary" },
    { officialDomains: ["dob.example.gov"] }
  ).sourceClassification,
  "secondary_source"
);

const sources = normalizeResearchWebSources([
  {
    url: "https://WWW.NYC.GOV/site/buildings/bulletin/?utm_source=newsletter&b=2&a=1#section",
    title: "  DOB Bulletin  ",
    publisher: " NYC DOB ",
    attributedClaims: [
      "  The bulletin clarifies the **applicable condition**.  ",
      "A literal 10`-0\" dimension, GRID__A identifier, and 2**3 expression remain unchanged."
    ],
    sourceClassification: "enacted_code",
    controlling: true
  },
  {
    href: "https://www.nyc.gov/site/buildings/bulletin?a=1&b=2",
    title: "Duplicate",
    attributedClaims: ["The bulletin clarifies the applicable condition.", "A second cited claim."]
  },
  {
    url: "https://engineering.example.com/open-stairs/",
    title: " Commentary "
  },
  { url: "http://nyc.gov/insecure" },
  { url: "not a URL" }
]);
assert.equal(sources.length, 2);
assert.equal(sources[0].url, "https://www.nyc.gov/site/buildings/bulletin?a=1&b=2");
assert.equal(sources[0].title, "DOB Bulletin");
assert.equal(sources[0].sourceClassification, "official_guidance");
assert.equal(sources[0].sourceRole, "supporting");
assert.equal(sources[0].controlling, false);
assert.equal(sources[0].sourcePolicyVersion, researchSourcePolicyVersion);
assert.deepEqual(sources[0].attributedClaims, [
  "The bulletin clarifies the applicable condition.",
  "A literal 10`-0\" dimension, GRID__A identifier, and 2**3 expression remain unchanged.",
  "A second cited claim."
]);
assert.equal(sources[1].url, "https://engineering.example.com/open-stairs");
assert.equal(sources[1].sourceClassification, "secondary_source");
assert.equal(sources[1].sourceRole, "supporting");
assert.equal(sources[1].controlling, false);

console.log("permitext research source policy contract passed");
