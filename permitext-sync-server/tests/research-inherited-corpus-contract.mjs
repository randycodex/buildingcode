import assert from "node:assert/strict";
import { createResearchCorpusRegistry, routeResearchCorpora } from "../research-corpus-registry.mjs";
const registry = createResearchCorpusRegistry();
const fire = registry.find(corpus => corpus.id === "nyc-2022-fire-code");
const source = { codePrefix: "FC", sectionNumber: "315", corpusID: fire.id, codeVersion: fire.codeVersion,
  codeEdition: fire.codeEdition, applicabilityStatus: fire.applicabilityStatus,
  supportingPassages: [{ selectedText: "Combustible material shall not be stored in mechanical rooms. Combustible storage shall not obstruct means of egress." }] };
const history = [
  { role: "user", question: "Can combustible storage block exits?" },
  { role: "assistant", answer: { verification: { pass: true }, citations: [source] } }
];
const selected = (question, previousMessages = history) => routeResearchCorpora({ question, previousMessages, registry }).selected;
assert(selected("Can boxes be stored in the mechanical rooms?").some(corpus => corpus.id === fire.id));
assert(!selected("Under the Plumbing Code, what does a cleanout require?").some(corpus => corpus.id === fire.id));
assert(!selected("New topic: what is the required accessible door width?").some(corpus => corpus.id === fire.id));
const stale = [...history, { role: "assistant", answer: { verification: { pass: false }, citations: [source] } }];
assert(!selected("Can boxes be stored in the mechanical rooms?", stale).some(corpus => corpus.id === fire.id));
const wrongVersion = structuredClone(history);
wrongVersion[1].answer.citations[0].codeVersion = "unmatched-historical-storage-version";
assert(!selected("Can boxes be stored in the mechanical rooms?", wrongVersion).some(corpus => corpus.id === fire.id));
const editions = [{ role: "user", question: "What is the 2022 Building Code ramp width?" },
  { role: "user", question: "What about 1968?" }];
assert.deepEqual(selected("What is the minimum ramp width?", editions).map(corpus => corpus.id), ["nyc-1968-building-code"]);
console.log("Inherited corpus routing passed: latest verified edition identity, implicit subject, explicit authority/switch precedence, unmatched identity and newer-failure exclusion.");
