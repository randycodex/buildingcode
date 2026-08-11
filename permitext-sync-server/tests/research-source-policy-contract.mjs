import assert from "node:assert/strict";
import {
  classifyResearchWebSource,
  normalizeResearchOfficialDomains,
  normalizeResearchWebSources,
  researchSourcePolicyConfiguration,
  researchSourcePolicyVersion,
  researchWebSupportTrigger,
  sanitizeResearchWebQuery,
  shouldUseResearchWebSupport
} from "../research-source-policy.mjs";

assert.match(researchSourcePolicyVersion, /^\d{8}-supporting-web-v\d+$/);

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

const sanitized = sanitizeResearchWebQuery(
  "Client: Acme Tower LLC; email lead@acme.example, call (212) 555-0199. " +
  "Project at 123 West 42nd Street, Suite 9. Find NYC BC 1019.3 DOB guidance."
);
assert.doesNotMatch(sanitized, /Acme Tower|lead@|212|123 West 42nd|Suite 9/i);
assert.match(sanitized, /NYC BC 1019\.3 DOB guidance/);

assert.equal(
  shouldUseResearchWebSupport({ question: "Find official DOB guidance about this exception." }, {}),
  true
);
assert.equal(
  shouldUseResearchWebSupport({ question: "Check the referenced standard outside the library." }, {}),
  true
);
assert.equal(shouldUseResearchWebSupport({ question: "What does BC 1019.3 require?" }, {}), false);
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
    sourceClassification: "enacted_code",
    controlling: true
  },
  {
    href: "https://www.nyc.gov/site/buildings/bulletin?a=1&b=2",
    title: "Duplicate"
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
assert.equal(sources[1].url, "https://engineering.example.com/open-stairs");
assert.equal(sources[1].sourceClassification, "secondary_source");
assert.equal(sources[1].sourceRole, "supporting");
assert.equal(sources[1].controlling, false);

console.log("permitext research source policy contract passed");
