import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { researchDOBWorkflowRoute } from "../research-dob-workflow-routing.mjs";
import { reconciledResearchEvaluationInput } from "../evals/research-answer-key-reconciliation.mjs";
import {
  bindResearchWebSupportToOfficialHTML,
  fetchResearchOfficialHTMLPassages,
  researchOfficialHTMLPassages,
  researchOfficialHTMLSectionPassages,
  selectResearchOfficialHTMLPassages
} from "../research-official-html-attribution.mjs";

const boilerURL = "https://www.nyc.gov/site/buildings/safety/boiler-compliance.page";
const boilerHTML = `<!doctype html>
<html><body><main>
  <h1>Boiler Compliance</h1>
  <h2>Low-Pressure Boiler Compliance</h2>
  <p>Annual inspections must be conducted and inspection reports must be filed for H-stamped and E-stamped boilers (not HLW-stamped hot water heaters) located in the following property types:</p>
  <ul>
    <li>residential buildings with six or more families</li>
    <li>commercial and mixed-use buildings, regardless of boiler BTU capacity</li>
    <li>any residential buildings classified as Single Room Occupancy (SRO) dwellings</li>
  </ul>
  <p>The following registered low-pressure boilers <strong>DO NOT</strong> require an annual inspection:</p>
  <ul>
    <li>boilers in residential buildings with 5 families or fewer</li>
    <li>a single boiler located within a single dwelling unit and supplying heat only to that unit</li>
  </ul>
  <p>NOTE: Low-pressure boilers with a heating input of 100,000 BTUs or less are subject to inspection when located anywhere outside a single apartment within a 6 or more residential occupancy, commercial, or mixed-use property, without regard to the number of dwelling units served.</p>
  <h3>Reporting</h3>
  <p>An inspection report must be filed within 14 days.</p>
</main></body></html>`;

const passages = researchOfficialHTMLPassages(boilerHTML, boilerURL);
const sro = passages.find((passage) => /Single Room Occupancy/.test(passage.text));
assert.ok(sro);
assert.match(sro.claim, /Annual inspections must be conducted/);
assert.doesNotMatch(sro.claim, /DO NOT require/);

const fiveFamilies = passages.find((passage) => /5 families or fewer/.test(passage.text));
assert.ok(fiveFamilies);
assert.match(fiveFamilies.claim, /DO NOT require an annual inspection/);

const singleUnit = passages.find((passage) => /single dwelling unit/.test(passage.text));
assert.ok(singleUnit);
assert.match(singleUnit.claim, /supplying heat only to that unit/);
assert.match(singleUnit.claim, /DO NOT require an annual inspection/);

const selected = selectResearchOfficialHTMLPassages(
  passages,
  "Which registered low-pressure boilers require annual inspections, which do not, and what applies to SRO dwellings and 100,000 BTUs?"
);
assert.ok(selected.some((passage) => passage.id === sro.id));
assert.ok(selected.some((passage) => passage.id === fiveFamilies.id));
assert.ok(selected.some((passage) => passage.id === singleUnit.id));
assert.ok(selected.some((passage) => /100,000 BTUs/.test(passage.text)));

const responseFor = (html, url = boilerURL) => new Response(html, {
  status: 200,
  headers: {
    "content-type": "text/html; charset=utf-8",
    "content-length": String(Buffer.byteLength(html)),
    "x-test-url": url
  }
});

const fetched = await fetchResearchOfficialHTMLPassages(boilerURL, {
  officialDomains: ["nyc.gov"],
  fetchImpl: async () => responseFor(boilerHTML)
});
assert.equal(fetched.url, boilerURL);
assert(fetched.passages.some((passage) => /5 families or fewer/.test(passage.text) && /supplying heat only to that unit/.test(passage.text)),
  "Keep a complete exception list together instead of counting its items as independent evidence.");

const faqHTML = `<h1>Workflow</h1><h2>Initial filings</h2>
<div class="faq-questions" data-answer="initial"><p>May the initial filing close with an LOC?</p></div>
<div class="faq-answers" id="initial"><p>Yes, after its required inspections.</p><p>Do not apply this to a subsequent CO filing.</p></div>
<h2>Subsequent CO filings</h2>
<div class="faq-questions" data-answer="subsequent"><p>May a subsequent CO filing close with its own LOC?</p></div>
<div class="faq-answers" id="subsequent"><p>No. Completion uses the initial CO process.</p></div>`;
const faqPassages = researchOfficialHTMLPassages(faqHTML, boilerURL);
assert.equal(faqPassages.length, 2);
assert.match(faqPassages[0].intro, /initial filing/);
assert.match(faqPassages[0].text, /Yes.*Do not apply/);
assert.match(faqPassages[1].claim, /Subsequent CO filings.*May a subsequent CO filing.*No\./);
assert.throws(() => researchOfficialHTMLSectionPassages(faqPassages, ["Initial filings", "Missing condition"], boilerURL),
  { code: "RESEARCH_OFFICIAL_SOURCE_SECTION_UNAVAILABLE" });
assert.throws(() => researchOfficialHTMLSectionPassages([{ ...faqPassages[0], claim: "x".repeat(16_001) }], ["Initial filings"], boilerURL),
  { code: "RESEARCH_OFFICIAL_SOURCE_SECTION_TOO_LARGE" });
for (const malformed of [faqHTML.replace('id="initial"', 'id="other"'),
  faqHTML.replace('<div class="faq-answers" id="initial">', '<h2>Unrelated section</h2><div class="faq-answers" id="initial">'),
  faqHTML + '<div id="initial"><p>Duplicate target.</p></div>']) {
  assert(!researchOfficialHTMLPassages(malformed, boilerURL).some((passage) => passage.kind === "faq_pair" && /May the initial filing/.test(passage.intro)),
    "An explicit link must have one adjacent target before its question becomes answer context.");
}

const companionFixture = JSON.parse(await readFile(new URL("../evals/fixtures/dob-companion-source-fragments-20260909.json", import.meta.url)));
const stakeholderFixture = JSON.parse(await readFile(new URL("../evals/fixtures/dob-stakeholder-source-fragments-20260909.json", import.meta.url)));
assert.equal(createHash("sha256").update(stakeholderFixture.html).digest("hex"), stakeholderFixture.fixtureHTMLSHA256);
for (const document of companionFixture.documents) assert.equal(createHash("sha256").update(document.html).digest("hex"), document.fixtureHTMLSHA256);
const reconciled = JSON.parse(await readFile(new URL("../evals/research-reconciled-answer-key.json", import.meta.url)));
const boundCompanions = {};
for (const id of ["DOBNOW-003", "DOBNOW-004", "DOBNOW-012", "DOBNOW-023"]) {
  const question = reconciledResearchEvaluationInput(reconciled.cases.find((item) => item.id === id)).question;
  const route = researchDOBWorkflowRoute(question);
  assert.equal(route.directDocumentRetrieval, true);
  const htmlSources = route.sources.filter((source) => !source.url.endsWith(".pdf"));
  const bound = await bindResearchWebSupportToOfficialHTML({ sources: htmlSources }, {
    question, officialDomains: ["nyc.gov"], requiredPassageTerms: route.passageTerms,
    fetchImpl: async (url) => {
      const document = id === "DOBNOW-023" ? stakeholderFixture : companionFixture.documents.find((document) => document.url === String(url));
      assert(document, `Unexpected companion request: ${url}`);
      assert.equal(document.url, String(url));
      return responseFor(document.html, document.url);
    }
  });
  assert.equal(bound.sources.length, htmlSources.length);
  assert.deepEqual(bound.sourceValidation.failures, []);
  boundCompanions[id] = bound.sources.flatMap((source) => source.attributedClaims.map((claim) => claim.text)).join("\n");
}
assert.match(boundCompanions["DOBNOW-003"], /can be initiated and submitted after the initial job filing is submitted/);
assert.match(boundCompanions["DOBNOW-003"], /subsequent filing in pre-filing status/);
assert.match(boundCompanions["DOBNOW-003"], /Letter of Completion for the subsequent filing of an NB or Alteration-CO filing/);
assert.match(boundCompanions["DOBNOW-003"], /No, the status of the subsequent filings will remain Permit Entire/);
assert.match(boundCompanions["DOBNOW-004"], /Only one PAA can be in progress/);
assert.match(boundCompanions["DOBNOW-004"], /same Applicant of Record as the original filing/);
assert.match(boundCompanions["DOBNOW-004"], /fields are NOT editable.*Work on Floors/s);
assert.match(boundCompanions["DOBNOW-004"], /Work on floors can be changed with a PAA/);
assert.doesNotMatch(boundCompanions["DOBNOW-004"], /The PAA process – BIS Job Filings/);
assert.match(boundCompanions["DOBNOW-012"], /City-owned sewer system.*20,000.*5,000/s);
assert.match(boundCompanions["DOBNOW-012"], /exclusions and definitions/);
assert.match(boundCompanions["DOBNOW-023"], /Roles & Responsibilities: Owner/);
assert.match(boundCompanions["DOBNOW-023"], /Roles & Responsibilities: Professionals/);
assert.match(boundCompanions["DOBNOW-023"], /cannot upload plans or submit filings\/permits/);
assert.match(boundCompanions["DOBNOW-023"], /owner must be logged in with the same email address/);
assert.doesNotMatch(boundCompanions["DOBNOW-023"], /withdrawal option|Demolition Sub-Contractor/i,
  "Other workflows on the same FAQ must not displace the applicable stakeholder sections.");

const bound = await bindResearchWebSupportToOfficialHTML({
  summary: "SRO dwellings are exempt.",
  sources: [{
    id: "web-boiler",
    url: boilerURL,
    title: "Boiler Compliance",
    sourceClassification: "official_guidance",
    sourceRole: "supporting",
    attributedClaims: [{ id: "provider-wrong", text: "SRO dwellings are exempt." }]
  }]
}, {
  question: "Which registered low-pressure boilers require annual inspections and which do not? Include SRO dwellings.",
  officialDomains: ["nyc.gov"],
  fetchImpl: async () => responseFor(boilerHTML)
});
assert.equal(bound.sources.length, 1);
assert.equal(bound.sources[0].sourceValidation, "official_html");
assert.ok(bound.sources[0].attributedClaims.some((claim) =>
  /Annual inspections must be conducted/.test(claim.text) && /SRO/.test(claim.text)
));
assert.ok(bound.sources[0].attributedClaims.some((claim) =>
  /DO NOT require/.test(claim.text) && /5 families or fewer/.test(claim.text)
));
assert.ok(bound.sources[0].attributedClaims.every((claim) => claim.id !== "provider-wrong"));
assert.ok(bound.sources[0].attributedClaims.every((claim) => claim.contentHash));

const changedPassages = researchOfficialHTMLPassages(
  boilerHTML.replace("six or more families", "seven or more families"),
  boilerURL
);
assert.notEqual(changedPassages[0].contentHash, passages[0].contentHash);
assert.notEqual(changedPassages[0].id, passages[0].id);

const failed = await bindResearchWebSupportToOfficialHTML({
  sources: [{ id: "web-boiler", url: boilerURL, attributedClaims: [{ id: "claim", text: "boiler" }] }]
}, {
  question: "boiler",
  officialDomains: ["nyc.gov"],
  fetchImpl: async () => new Response("Forbidden", {
    status: 403,
    headers: { "content-type": "text/plain" }
  })
});
assert.deepEqual(failed.sources, []);
assert.equal(failed.sourceValidation.failures[0].code, "RESEARCH_OFFICIAL_SOURCE_UNAVAILABLE");

const redirected = await bindResearchWebSupportToOfficialHTML({
  sources: [{ id: "web-boiler", url: boilerURL, attributedClaims: [{ id: "claim", text: "boiler" }] }]
}, {
  question: "boiler",
  officialDomains: ["nyc.gov"],
  fetchImpl: async () => new Response(null, {
    status: 302,
    headers: { location: "https://example.com/untrusted" }
  })
});
assert.deepEqual(redirected.sources, []);
assert.equal(
  redirected.sourceValidation.failures[0].code,
  "RESEARCH_OFFICIAL_SOURCE_REDIRECT_REJECTED"
);

await assert.rejects(
  () => fetchResearchOfficialHTMLPassages(boilerURL, {
    officialDomains: ["nyc.gov"],
    fetchImpl: async () => new Response("PDF", {
      status: 200,
      headers: { "content-type": "application/pdf" }
    })
  }),
  (error) => error?.code === "RESEARCH_OFFICIAL_PDF_INVALID"
);

await assert.rejects(
  () => fetchResearchOfficialHTMLPassages(boilerURL, {
    officialDomains: ["nyc.gov"],
    maximumBytes: 10,
    fetchImpl: async () => new Response(boilerHTML, {
      status: 200,
      headers: {
        "content-type": "text/html",
        "content-length": String(Buffer.byteLength(boilerHTML))
      }
    })
  }),
  (error) => error?.code === "RESEARCH_OFFICIAL_SOURCE_TOO_LARGE"
);

console.log("Research official HTML attribution contract passed.");
