import assert from "node:assert/strict";
import { structuredRichSources } from "../evidence-discovery.mjs";
import { assembleResearchEvidence } from "../research-evidence-assembly.mjs";

const splitTableBody = {
  blocks: [{
    id: "caption",
    kind: "html",
    plainText: "Exit access travel distance shall not exceed Table 1017.2. Table 1017.2 Exit Access Travel Distance a",
    html: '<div>Exit access travel distance shall not exceed Table 1017.2.</div><a title="BC Table 1017.2"></a><strong>Table 1017.2<br>Exit Access Travel Distance</strong><sup>a</sup>'
  }, {
    id: "table",
    kind: "table",
    html: '<ScrollTable><table><tbody><tr><th>Occupancy</th><th>Without Sprinkler System (feet)</th><th>With Sprinkler System (feet)</th></tr><tr><td>E, F-1, M, R, S-1</td><td>150</td><td>200 <sup>b</sup></td></tr><tr><td>B</td><td>200</td><td>300 <sup>c</sup></td></tr></tbody></table></ScrollTable>'
  }, {
    id: "footnotes",
    kind: "html",
    plainText: "For SI: 1 foot = 304.8 mm. a. See the listed sections for modifications. b. Buildings equipped throughout with an automatic sprinkler system in accordance with Section 903.3.1.1 or 903.3.1.2. c. Buildings equipped throughout with an automatic sprinkler system in accordance with Section 903.3.1.1.",
    html: '<div class="Small">For SI: 1 foot = 304.8 mm</div><div class="Small">a. See the listed sections for modifications.</div><div class="Small">b. Buildings equipped throughout with an automatic sprinkler system in accordance with Section 903.3.1.1 or 903.3.1.2.</div><div class="Small">c. Buildings equipped throughout with an automatic sprinkler system in accordance with Section 903.3.1.1.</div>'
  }]
};

const [table10172] = structuredRichSources(splitTableBody);
assert(table10172, "The split canonical table must produce a structured source.");
assert.equal(table10172.reference, "BC Table 1017.2");
assert.equal(table10172.rowCount, 3);
assert.match(table10172.text, /E, F-1, M, R, S-1 150 200 b/);
assert.match(table10172.text, /a\. See the listed sections for modifications\./);
assert.match(
  table10172.text,
  /b\. Buildings equipped throughout with an automatic sprinkler system in accordance with Section 903\.3\.1\.1 or 903\.3\.1\.2\./
);
assert.match(
  table10172.text,
  /c\. Buildings equipped throughout with an automatic sprinkler system in accordance with Section 903\.3\.1\.1\./
);

const question = "An existing Group R-2 building is fully sprinklered and has an exit access travel distance of 120 feet. Under BC 1017.2, does it comply?";
const assembled = await assembleResearchEvidence({
  question,
  discover: async () => ({
    retrievalVersion: "travel-distance-table-test-v1",
    paidModelCall: false,
    candidates: [{
      sectionID: "construction-table",
      codePrefix: "BC",
      sectionNumber: "601.1",
      title: "Construction classification",
      selectedText: "Construction types are listed in Table 601.",
      rank: 1,
      signals: {
        exactTopicRouteTarget: true,
        topicRoutes: ["construction-type and building-element ratings"],
        referencesTable: true
      }
    }, {
      sectionID: "travel-distance-table",
      codePrefix: "BC",
      sectionNumber: "1017.2",
      title: "Exit access travel distance",
      selectedText: "Exit access travel distance shall not exceed Table 1017.2.",
      rank: 2,
      signals: {
        exactReference: true,
        exactTopicRouteTarget: true,
        topicRoutes: ["exit-access travel-distance limits and measurement"],
        referencesTable: true,
        includesStructuredTable: true
      }
    }]
  }),
  resolveSection: async (request) => request.sectionNumber === "1017.2"
    ? {
        sectionID: "travel-distance-table",
        codePrefix: "BC",
        sectionNumber: "1017.2",
        title: "Exit access travel distance",
        canonicalText: splitTableBody.blocks.map((block) => block.plainText || "").join(" "),
        body: splitTableBody,
        richSources: [table10172]
      }
    : {
        sectionID: "construction-table",
        codePrefix: "BC",
        sectionNumber: "601.1",
        title: "Construction classification",
        canonicalText: "Construction types are listed in Table 601."
      },
  limits: {
    maximumCandidates: 2,
    maximumDiscovered: 2,
    maximumCrossReferences: 1,
    maximumCharacters: 4_000,
    maximumCharactersPerSource: 2_000
  }
});

assert.equal(assembled.sources[0].sectionNumber, "1017.2", "The explicitly requested travel-distance rule must be prioritized.");
assert.equal(assembled.sources[0].evidencePriority.evidenceRole, "governing");
assert.equal(assembled.sources[0].evidencePriority.topicRouteRelationship, "aligned");
assert.equal(assembled.sources[0].richSourceReference, "BC Table 1017.2");
assert.equal(assembled.sources[0].richSourceRowCount, 3);
assert.match(assembled.sources[0].text, /E, F-1, M, R, S-1 150 200 b/);
assert.match(assembled.sources[0].text, /Section 903\.3\.1\.1 or 903\.3\.1\.2/);
assert.equal(assembled.discovery.retrievalVersion, "travel-distance-table-test-v1");
assert.equal(assembled.usage.characterCount <= assembled.limits.maximumCharacters, true);

console.log("Permitext BC 1017.2 structured row-and-footnote assembly contract passed; paid model calls: no.");
