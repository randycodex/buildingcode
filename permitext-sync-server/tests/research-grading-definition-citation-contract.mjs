// Replay against the saved final cohort; no provider or application rerun.
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gradingCanonicalCitation } from "../scripts/research-grading-canonical-citation-20261005.mjs";
const scratch = await mkdtemp(join(tmpdir(), "permitext-grading-definition-contract-"));
for (const key of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(key)) delete process.env[key];
Object.assign(process.env, { NODE_ENV: "test", PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "assets"), PERMITEXT_RESEARCH_SEMANTIC_SEARCH: "0",
  PERMITEXT_RESEARCH_PASSAGE_SEARCH: "0" });
let networkAttempts = 0;
globalThis.fetch = () => { networkAttempts++; throw Error("No provider calls in grading definition contracts"); };
try {
  const { researchCorpusPlanForTurn, researchCorpusResources, researchBodyForCatalogSection } = await import("../app.mjs");
  const result = JSON.parse(await readFile(new URL("../evals/retrieval-validation-2026-10-05/final-local-native-cohort-20261005/results.json", import.meta.url)));
  let tested = 0, rejected = 0;
  for (const citation of result.cases.flatMap(item => item.answer?.citations || [])) {
    const plan = await researchCorpusPlanForTurn({ question: `Explain NYC ${citation.codePrefix} ${citation.publishedCitationReference?.carrierSectionNumber || citation.sectionNumber}` });
    const catalog = (await researchCorpusResources(plan)).catalog;
    const section = catalog.find(s => String(s.id) === citation.sectionID && s.codeVersion === citation.codeVersion && s.codePrefix === citation.codePrefix);
    assert(section);
    const body = await researchBodyForCatalogSection(section);
    const before = JSON.stringify(citation), snapshot = gradingCanonicalCitation(section, body, citation);
    assert.equal(JSON.stringify(citation), before);
    if (!snapshot.completeDefinitionEntries) continue;
    tested++;
    for (const mutate of [c => { c.codeEdition = "foreign"; }, c => {
      c.supportingPassages[0].selectedText = c.supportingPassages[0].selectedText.slice(0, -10);
    }]) {
      const bad = structuredClone(citation); mutate(bad);
      assert.throws(() => gradingCanonicalCitation(section, body, bad)); rejected++;
    }
    if (citation.publishedCitationReference) {
      const bad = structuredClone(citation); bad.publishedCitationReference.sourceBindings[0].selectedTextHash = "0".repeat(64);
      assert.throws(() => gradingCanonicalCitation(section, body, bad)); rejected++;
    }
  }
  assert.equal(tested, 3); assert.equal(networkAttempts, 0);
  console.log(JSON.stringify({ status: "passed", canonicalDefinitionCitations: tested,
    corruptionsRejected: rejected, candidateAnswersUnchanged: true, networkAttempts }));
} finally { await rm(scratch, { recursive: true, force: true }); }
