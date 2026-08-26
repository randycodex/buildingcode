import assert from "node:assert/strict";
import {
  bindResearchWebSupportToOfficialHTML,
  fetchResearchOfficialHTMLPassages,
  researchOfficialHTMLPassages,
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
assert.ok(fetched.passages.length >= 9);

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
  (error) => error?.code === "RESEARCH_OFFICIAL_SOURCE_UNSUPPORTED"
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
