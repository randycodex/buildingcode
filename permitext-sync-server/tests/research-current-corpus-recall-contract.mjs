import assert from "node:assert/strict";
import { createResearchCorpusRegistry, routeResearchCorpora } from "../research-corpus-registry.mjs";

const registry = createResearchCorpusRegistry({ zoningResearchEligibility: true });
const selected = (question, extra = {}) => routeResearchCorpora({ question, registry, ...extra }).selected.map(c => c.id);
const previous = process.env.PERMITEXT_RESEARCH_CURRENT_CORPUS_RECALL;
try {
  delete process.env.PERMITEXT_RESEARCH_CURRENT_CORPUS_RECALL;
  assert.deepEqual(selected("May hot ashes be put in a combustible container?"), ["nyc-2022-construction-codes"]);
  process.env.PERMITEXT_RESEARCH_CURRENT_CORPUS_RECALL = "1";
  assert.deepEqual(selected("May hot ashes be put in a combustible container?"), [
    "nyc-2022-construction-codes", "nyc-2022-fire-code", "nyc-zoning-resolution"
  ]);
  assert.deepEqual(selected("Under the 2014 Building Code, what ceiling height is required?"), ["nyc-2014-construction-codes"]);
  assert.deepEqual(selected("Under the 1968 Building Code, what ceiling height is required?"), ["nyc-1968-building-code"]);
  assert.deepEqual(selected("Under the 2008 Building Code, what ceiling height is required?"), []);
  assert.deepEqual(selected("Under the future 2027 Existing Building Code, what applies?"), ["nyc-existing-building-code-2027"]);
  assert.deepEqual(selected("Based only on the selected Building Code passages, explain this requirement."), ["nyc-2022-construction-codes"]);
  assert.deepEqual(selected("What ceiling height is required?", { projectCodeVersion: "2014 construction codes" }), ["nyc-2014-construction-codes"]);
  const restricted = createResearchCorpusRegistry();
  assert(!selected("May hot ashes be put in a combustible container?", { registry: restricted }).includes("nyc-zoning-resolution"));
  assert.deepEqual(selected("Under ZR 43-22, what is the yard level?", { registry: restricted }), [], "An ineligible requested corpus must not be bypassed with another source library.");
} finally {
  if (previous === undefined) delete process.env.PERMITEXT_RESEARCH_CURRENT_CORPUS_RECALL;
  else process.env.PERMITEXT_RESEARCH_CURRENT_CORPUS_RECALL = previous;
}
console.log("Current-corpus recall contract passed, including historical, future, project-edition and authorization boundaries.");
