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
  ["What structural live load applies to a community room?", ["1607.1"]],
  ["Does converting an office to dense file storage require structural evaluation?", ["1604.2", "1607.1"]]
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
    readSectionBody: async (section) => ({ blocks: [{ plainText: `${section.title} enacted provision.` }] }),
    limit: 12
  });
  const actual = new Set(result.candidates.map((candidate) => candidate.sectionNumber));
  for (const sectionNumber of expected) {
    assert(actual.has(sectionNumber), `${question} did not route to BC ${sectionNumber}.`);
  }
}

console.log("permitext distinct evidence-discovery routes contract passed");
