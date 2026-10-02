import assert from "node:assert/strict";
import { assembledResearchEvidenceForTurn } from "../app.mjs";

const cases = [
  { question: "Under the 2022 NYC Building Code, is 0.5 footcandle sufficient for normal illumination of an ordinary office exit-access corridor? There is no performance or existing photoluminescent-system exception.", prefix: "BC", section: "1008.2.1", text: /footcandle/i },
  { question: "Under the 2022 NYC Mechanical Code, what minimum level working space is required at the control side of an ordinary HVAC appliance?", prefix: "MC", section: "306.1", text: /30 inches/i },
  {
    question: "Under the ordinary 2022 NYC Fuel Gas Code pressure-test duration rule, is 10 minutes enough? Assume no provision requires a longer special test.",
    prefix: "FGC", section: "406.4.2", text: /(?:1\s*\/\s*2|half).*hour/i
  },
  {
    question: "Under 2022 NYC plumbing rules, what is the minimum fall for 60 feet of 4-inch horizontal sanitary drainage pipe?",
    prefix: "PC", section: "704.1", text: /slope/i
  },
  {
    question: "Can a delivery truck park in a designated NYC fire lane if its driver stays inside?",
    prefix: "FC", section: "503", text: /unlawful to park on a fire lane/i
  }
];
for (const item of cases) {
  const packet = await assembledResearchEvidenceForTurn({
    question: item.question, messages: [], projectFacts: [], pinnedEvidence: []
  });
  const source = packet.sources.find(source => source.codePrefix === item.prefix && source.sectionNumber === item.section);
  assert(source, `Missing controlling source ${item.prefix} ${item.section}`);
  assert.match(source.text, item.text, "The actual decisive text must reach the evidence package.");
}
console.log("Independent pilot retrieval contract passed: illumination, working space, duration, drainage fall and fire-lane authority.");
