// Offline adaptation of the user's reviewed handoff. Expected answers stay in
// evaluation artifacts; the application runner receives only user questions.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { researchSourceBodyState } from "../research-source-body-state.mjs";
import { buildAcceptanceGradeRequest } from "./research-acceptance-grading-20261005.mjs";

const root = new URL("../", import.meta.url);
const directory = new URL("evals/retrieval-validation-2026-10-05/", root);
const hash = value => createHash("sha256").update(value).digest("hex");
const load = async name => JSON.parse(await readFile(new URL(name, directory), "utf8"));
const scratch = await mkdtemp(join(tmpdir(), "permitext-final-freeze-"));
for (const key of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(key)) delete process.env[key];
Object.assign(process.env, { NODE_ENV: "test", PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "assets"), PERMITEXT_RESEARCH_SEMANTIC_SEARCH: "0",
  PERMITEXT_RESEARCH_PASSAGE_SEARCH: "0", PERMITEXT_RESEARCH_WEB_SUPPORT: "0" });
globalThis.fetch = async () => { throw Error("No network during final input freeze"); };
try {
  const ledgerText = await readFile(new URL("budget-ledger.json", directory));
  const reviewedText = await readFile(new URL("Permitext_Final_40_Reviewed_Data.json", directory));
  const reviewed = JSON.parse(reviewedText);
  const prior = await load("acceptance-model-reviewed-fixture.json");
  const priorManifest = await load("acceptance-model-reviewed-manifest.json");
  const packet = await load("acceptance-model-reviewed-sources.json");
  assert.equal(reviewed.original_sha256, hash(await readFile(new URL("final-test-review.md", directory))));
  assert.equal(reviewed.cases.length, 20);
  const references = new Set(packet.sources.map(source => source.reference));
  const conversations = reviewed.cases.map(item => {
    const original = prior.conversations.find(c => c.id === item.case_id); assert(original);
    assert.deepEqual(item.turns.map(t => t.turn), [1, 2]);
    assert.deepEqual(item.turns.map(t => t.question), original.questions);
    const reviewedRubric = item.turns.map(turn => {
      assert.equal(turn.reviewed_answer_status, "COMPLETE");
      return { turn: turn.turn, status: "clear_from_supplied_text", boundedConclusion: turn.expected_answer,
        materialChecks: turn.must_include.map(criterion => {
          const annotations = [...criterion.matchAll(/\[([^\]]+)\]/g)].map(match => match[1]).join(" ");
          const named = [...annotations.matchAll(/\b(BC|PC|MC|FGC|AC|FC|ZR)\s+(\d[\d.-]*)/g)].map(match => `${match[1]} ${match[2].replace(/[.-]+$/, "")}`);
          const sourceReferences = [...new Set(named.length ? named : original.references)];
          assert(sourceReferences.length && sourceReferences.every(reference => references.has(reference)), criterion);
          return { criterion, sourceReferences };
        }), forbiddenClaims: turn.forbidden_claims, genuineUnknowns: turn.uncertainty_boundaries,
        neededReferences: [], reasoning: "Verbatim criteria and reference answer from the user-supplied reviewed handoff; not external expert certification." };
    });
    return { id: original.id, questions: original.questions, references: original.references,
      checks: item.turns.map(turn => [turn.expected_answer, ...turn.must_include,
        ...turn.forbidden_claims.map(v => `Forbidden: ${v}`), ...turn.uncertainty_boundaries.map(v => `Required uncertainty: ${v}`)].join("\n")),
      reviewedRubric, reviewProvenance: { reviewedHandoffSHA256: hash(reviewedText),
        originalDispositions: item.turns.map(t => t.original_rubric_disposition),
        reviewerIdentityEstablished: false, externalExpertApproval: false } };
  });
  const questionHash = hash(JSON.stringify(conversations.map(({ id, questions }) => ({ id, questions }))));
  assert.equal(questionHash, priorManifest.questionsSHA256);
  const rubricHash = hash(JSON.stringify(conversations.map(({ id, reviewedRubric }) => ({ id, reviewedRubric }))));
  const fixture = { ...prior, status: "frozen_user_reviewed_final_check", providerCalls: 0,
    notReadyForGeneration: false, conversations, rubricSHA256: rubricHash,
    reviewedHandoffSHA256: hash(reviewedText), externalExpertApproval: false };
  const { researchCorpusPlanForTurn, researchCorpusResources, researchBodyForCatalogSection } = await import("../app.mjs");
  const catalogs = new Map();
  const identity = ["codePrefix", "sectionNumber", "corpusID", "codeVersion", "codeEdition", "jurisdiction"];
  for (const source of packet.sources) {
    if (!catalogs.has(source.codePrefix)) {
      const family = source.codePrefix === "FC" ? "Fire Code" : source.codePrefix === "ZR" ? "Zoning Resolution" : "Construction Codes";
      const plan = await researchCorpusPlanForTurn({ question: `Explain current NYC ${family} ${source.reference}.` });
      catalogs.set(source.codePrefix, (await researchCorpusResources(plan)).catalog);
    }
    const catalog = catalogs.get(source.codePrefix);
    const section = catalog.find(s => String(s.id) === source.sectionID && identity.every(field => s[field] === source[field]));
    assert(section, `${source.reference}: exact canonical identity required`);
    const body = await researchBodyForCatalogSection(section);
    const text = (body.blocks || []).map(b => String(b.plainText || "")).filter(Boolean).join("\n\n");
    assert.equal(text, source.text, `${source.reference}: complete body unchanged`);
    assert.equal(hash(text), source.textSHA256);
    source.title = section.title; source.titleIsMetadata = true;
    const state = researchSourceBodyState(section, body);
    if (state) source.sourceBodyState = state;
  }
  packet.status = "frozen_complete_local_snapshots";
  assert.equal(packet.sources.find(s => s.reference === "PC 905.4").sourceBodyState.publicationHeading, undefined);
  assert.equal(packet.sources.find(s => s.reference === "FC 508").sourceBodyState.publicationHeading.text, "FC 508: Reserved");
  // Construct every grading envelope before dispatch; each criterion is exact
  // and complete. This proves mechanics, not answer quality.
  const mockCases = conversations.flatMap(c => c.questions.map((question, i) => ({
    id: `${c.id}-${i + 1}`, question, status: 200, answer: { answerText: "Offline preflight placeholder." } })));
  for (const conversation of conversations) buildAcceptanceGradeRequest(conversation, mockCases, packet.sources);
  const fixtureText = JSON.stringify(fixture, null, 2), sourcePacketText = JSON.stringify(packet, null, 2);
  const codeHashes = {};
  for (const name of [...Object.keys(priorManifest.codeHashes), "research-source-body-state.mjs", "research-search-vocabulary.mjs"])
    codeHashes[name] = hash(await readFile(new URL(name, root)));
  const manifest = { ...priorManifest, status: "frozen_for_one_final_local_check", finalCandidateFrozen: true,
    ownerApproval: { source: "direct_user_authorization", authorizationText: "Ok, finish this last round of checks",
      scope: "Resume the user-authorized API testing for one final round using the reviewed file the user supplied; no deployment or repeated holdout tuning.",
      reviewedRubricSHA256: rubricHash, reviewedQuestionsSHA256: questionHash,
      reviewedHandoffSHA256: hash(reviewedText), externalExpertApproval: false },
    fixtureSHA256: hash(fixtureText), rubricSHA256: rubricHash, sourcePacketSHA256: hash(sourcePacketText),
    candidateCommit: "20a9a919a plus evaluation runner/grading mechanics recorded below", codeHashes,
    gradingCodeSHA256: hash(await readFile(new URL("scripts/research-acceptance-grading-20261005.mjs", root))),
    budgetLedgerSHA256BeforeRun: hash(ledgerText), frozenAt: new Date().toISOString(),
    referenceReview: { method: "user_supplied_reviewed_reference_file", revisedTurns: 6, unchangedQuestions: 40,
      reviewerIdentityEstablished: false, externalExpertApproval: false },
    originalManifestRetained: "acceptance-model-reviewed-manifest.json", providerCalls: 0 };
  for (const [name, value] of [["final-check-fixture.json", fixtureText], ["final-check-sources.json", sourcePacketText],
    ["final-check-manifest.json", JSON.stringify(manifest, null, 2)]])
    await writeFile(new URL(name, directory), value, { flag: "wx" });
  assert.equal(hash(await readFile(new URL("budget-ledger.json", directory))), hash(ledgerText));
  console.log(JSON.stringify({ frozen: true, questions: 40, conversations: 20, completeSnapshots: packet.sources.length,
    gradingEnvelopes: 20, providerCalls: 0, fixtureSHA256: manifest.fixtureSHA256, ledgerUnchanged: true }));
} finally { await rm(scratch, { recursive: true, force: true }); }
