import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { discoverRelevantEvidence } from "../evidence-discovery.mjs";

const index = JSON.parse(await readFile(new URL("../config/canonical-section-ids.json", import.meta.url), "utf8"));
const checks = [
  ["An exterior wall is 3 feet from an interior lot line. What rating is required and are unprotected window openings permitted?", ["602.1", "705.8", "705.8.1"]],
  ["Can a four-story open volume be treated as an atrium and what separation and smoke control protections apply?", ["712.1.7", "404.3", "404.5", "404.6"]],
  ["Can a plumbing pipe penetrate a 2-hour shaft enclosure wall?", ["713.8", "713.8.1", "714.3", "714.3.1"]],
  ["Does a major interior alteration require sprinklers in the altered area or the entire building?", ["901.9.4", "901.9.4.1", "901.9.4.2", "901.9.4.3"]],
  ["At what point is a standpipe required and what type of standpipe applies?", ["905.3", "905.3.1"]],
  ["Which high-rise systems require emergency or standby power?", ["403.4.8", "403.4.8.3.2", "403.4.8.4.2", "403.4.8.4.3", "2702.1"]],
  ["Does the number of stories alone establish that an elevator is required?", ["1104.4"]],
  ["In a residential project containing 100 dwelling units, explain which categories of accessible units must be considered and what additional project information is necessary to calculate the required quantities.", ["1107.6", "1107.6.1", "1107.6.1.1", "1107.6.1.2", "1107.6.2", "1107.6.2.1", "1107.6.2.2", "1107.6.3", "1107.7", "1107.7.4"]],
  ["What structural live load applies to a community room?", ["1607.1"]],
  ["Does converting an office to dense file storage require structural evaluation?", ["1604.2", "1607.1"]]
  ,["A small existing establishment proposes an alteration described as a change between Group B and Group M after the 2024 zoning Use Group renumbering. Based only on the selected Building Code passages, can we conclude that the work qualifies for an exception to amending the Certificate of Occupancy, and what accessibility consequence can be stated?", ["1101.3", "1101.3.1"]]
];
const wanted = new Set(checks.flatMap(([, references]) => references));
const catalog = [];
for (const [key, id] of Object.entries(index.byCodeChapterSection)) {
  const [codePrefix, chapterNumber, sectionNumber] = key.split(":");
  if (codePrefix === "BC" && wanted.has(sectionNumber)) {
    catalog.push({ id: String(id), codePrefix, chapterNumber, sectionNumber, title: `BC ${sectionNumber}` });
  }
}
assert.deepEqual(new Set(catalog.map((item) => item.sectionNumber)), wanted, "Every route target must exist in the canonical corpus.");

for (const [question, expected] of checks) {
  const result = await discoverRelevantEvidence({
    question,
    catalog,
    invertedIndex: new Map(),
    readSectionBody: async (section) => ({ blocks: [{ plainText:
      section.sectionNumber === "1101.3"
        ? "The provisions of this chapter shall apply to alterations, including minor alterations but excluding ordinary repairs, and changes of use or occupancy to prior code buildings, portions of such buildings, and spaces within such buildings in accordance with Sections 1101.3.1 through 1101.3.5."
        : section.sectionNumber === "1101.3.1"
          ? "Accessible features and construction governed by this chapter shall be provided:\n\n1. To the entire building where a change is made in the main use.\n\n2. Throughout a space, including the immediate entrance(s) thereto, where an alteration is made that is considered either: (i) a change in occupancy classification of such space in accordance with this code, or (ii) a change in the zoning use group of such space in accordance with the New York City Zoning Resolution.\n\n2.2. A separate rooftop condition applies."
          : `${section.title} enacted provision.`
    }] }),
    limit: 12
  });
  const actual = new Set(result.candidates.map((candidate) => candidate.sectionNumber));
  for (const sectionNumber of expected) {
    assert(actual.has(sectionNumber), `${question} did not route to BC ${sectionNumber}.`);
  }
  if (/Certificate of Occupancy/i.test(question)) {
    for (const candidate of result.candidates) {
      assert.equal(
        candidate.signals.useSelectedPassageOnly,
        true,
        `BC ${candidate.sectionNumber} must preserve the routed passage boundary for this selected-passage question.`
      );
      if (candidate.sectionNumber === "1101.3.1") {
        assert.doesNotMatch(candidate.selectedText, /entire building|rooftop/i);
        assert.match(candidate.selectedText, /Throughout a space, including the immediate entrance/);
      }
    }
  }
}

console.log("permitext distinct evidence-discovery routes contract passed");
