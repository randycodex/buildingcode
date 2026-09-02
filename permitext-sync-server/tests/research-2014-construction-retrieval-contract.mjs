import assert from "node:assert/strict";
import { discoverRelevantEvidence } from "../evidence-discovery.mjs";
import {
  historicalConstructionCodePrefixes,
  historicalConstructionSearchIndex,
  historicalConstructionSection,
  historicalConstructionSectionCatalog
} from "../historical-construction-content.mjs";

const [catalog, invertedIndex] = await Promise.all([
  historicalConstructionSectionCatalog(),
  historicalConstructionSearchIndex()
]);

async function retrieve(question, limit = 12) {
  return discoverRelevantEvidence({
    question,
    catalog,
    invertedIndex,
    readSectionBody: (section) => historicalConstructionSection(section.id),
    availableCodePrefixes: historicalConstructionCodePrefixes,
    limit
  });
}

const visionLite = await retrieve(
  "maximum square feet for a vision light in a fire-rated door - 2014 NYC Building Code"
);
assert.equal(visionLite.candidates[0]?.sectionNumber, "715.4.7.1");
assert.match(visionLite.candidates[0]?.selectedText || "", /not more than 100 square inches/i);
assert.match(visionLite.candidates[0]?.selectedText || "", /dimension exceeding 10 inches/i);
assert.equal(visionLite.candidates[0]?.codeVersion.includes("2014"), true);
assert.equal(visionLite.candidates[0]?.applicabilityStatus, "prior-edition-case-specific");
assert.equal(
  visionLite.candidates.some((candidate) => candidate.sectionNumber.startsWith("716.5")),
  false,
  "A 2014 question must not be routed to the 2022 fire-door section family."
);

const ramp = await retrieve("what are the requirements for designing a ramp under the 2014 NYC Building Code?");
const rampReferences = new Set(ramp.candidates.map((candidate) =>
  `${candidate.codePrefix} ${candidate.sectionNumber}`
));
for (const reference of [
  "BC 1010.1",
  "BC 1010.2",
  "BC 1010.3",
  "BC 1010.4",
  "BC 1010.5.1",
  "BC 1010.6",
  "BC 1010.6.3",
  "BC 1010.6.4",
  "BC 1010.7.1",
  "BC 1010.7.2",
  "BC 1010.8",
  "BC 1010.9"
]) {
  assert(rampReferences.has(reference), `2014 ramp retrieval is missing ${reference}.`);
}
assert(ramp.candidates.every((candidate) =>
  candidate.signals.exactTopicRouteTarget === true &&
  candidate.signals.topicRoutes.includes("pedestrian ramp design and accessibility provisions")
));
assert.equal(
  ramp.candidates.some((candidate) => candidate.sectionNumber.startsWith("1012.")),
  false,
  "The 2022 ramp section numbers must not displace the 2014 ramp provisions."
);
assert.match(
  ramp.candidates.find((candidate) => candidate.sectionNumber === "1010.2")?.selectedText || "",
  /one unit vertical in 12 units horizontal/i
);
assert.match(
  ramp.candidates.find((candidate) => candidate.sectionNumber === "1010.5.1")?.selectedText || "",
  /36 inches \(914 mm\) minimum/i
);

const corridor = await retrieve(
  "What's the minimum hall toward a fire escape that does not require ADA under the 2014 NYC Building Code?"
);
assert(
  corridor.candidates.some((candidate) => candidate.sectionNumber === "1018.2"),
  "2014 corridor-width retrieval must include BC 1018.2."
);
assert.equal(
  corridor.candidates.some((candidate) => candidate.sectionNumber === "1020.2"),
  false,
  "The 2022 corridor-width number must not be treated as the 2014 provision."
);
assert.match(
  corridor.candidates.find((candidate) => candidate.sectionNumber === "1018.2")?.selectedText || "",
  /not less than 44 inches/i
);

console.log("Permitext 2014 full-corpus retrieval regression passed; paid model calls: no.");
