import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const scratch = await mkdtemp(join(tmpdir(), "permitext-source-state-"));
for (const key of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(key)) delete process.env[key];
Object.assign(process.env, { NODE_ENV: "test", PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "assets"), PERMITEXT_RESEARCH_SEMANTIC_SEARCH: "0",
  PERMITEXT_RESEARCH_PASSAGE_SEARCH: "0", PERMITEXT_RESEARCH_WEB_SUPPORT: "0" });
let networkAttempts = 0;
globalThis.fetch = async () => { networkAttempts += 1; throw new Error("No network access in source-state preflight."); };
const root = new URL("../evals/retrieval-validation-2026-10-05/", import.meta.url);
const json = async name => JSON.parse(await readFile(new URL(name, root), "utf8"));
const hash = text => createHash("sha256").update(text).digest("hex");
const ledgerBefore = hash(await readFile(new URL("budget-ledger.json", root)));
try {
  const { assembledResearchEvidenceForTurn, researchBodyForCatalogSection, researchInputForEvidence } = await import("../app.mjs");
  const packets = [];
  for (const name of ["acceptance-reserved-vent-handoff-offline-retrieval.json", "acceptance-reserved-fire-section-handoff-offline-retrieval.json"]) {
    const before = await json(name);
    const after = await assembledResearchEvidenceForTurn({ question: before.question, messages: [], pinnedEvidence: [], projectFacts: [] });
    if (name.includes("fire-section")) assert.deepEqual(after.sources.map(source => source.sourceID), before.sources.map(source => source.sourceID),
      "The placeholder classification preserves retained Fire Code passage identities.");
    for (const source of after.sources) {
      const prior = before.sources.find(value => value.sectionID === source.sectionID && value.corpusID === source.corpusID && value.codeVersion === source.codeVersion);
      if (!prior) continue;
      assert.equal(source.text, prior.text);
      for (const field of ["sectionID", "codePrefix", "sectionNumber", "corpusID", "codeVersion", "codeEdition", "jurisdiction"])
        assert.equal(source[field], prior[field]);
    }
    assert(after.usage.characterCount <= after.usage.initialSupplementalCharacterCeiling);
    packets.push(after);
  }
  const [empty, fire] = packets;
  const unavailable = empty.sourceAvailability.find(value => value.sectionID === "12550");
  assert(unavailable, "The normal first-turn assembly must carry the exact empty PC record boundary.");
  assert.equal(unavailable.bodyStatus, "plain_text_empty");
  assert.equal(unavailable.bodyTextSHA256, hash(""));
  assert.equal(unavailable.publicationHeading, undefined,
    "A catalog label alone cannot establish publication status for the empty supplied-record case.");
  assert(!empty.sources.some(source => source.sectionID === "12550"));
  const reserved = fire.sources.find(source => source.sectionID === "31004730");
  assert.equal(reserved.sourceBodyState.bodyStatus, "importer_placeholder_only");
  assert.equal(reserved.sourceBodyState.publicationHeading.text, "FC 508: Reserved");
  assert.equal(reserved.sourceBodyState.publicationHeading.refreshedThisTurn, false);
  assert.equal(reserved.canonicalContextComplete, false);
  const emptyInput = researchInputForEvidence(empty.question, empty.sources, { sourceAvailability: empty.sourceAvailability });
  assert.match(emptyInput, /SOURCE_AVAILABILITY — LOCAL RECORD STATE/);
  assert.match(emptyInput, /"sectionID":"12550"/);
  assert.match(emptyInput, /does not establish legal Reserved status/);
  assert.doesNotMatch(emptyInput, /ENACTED_TEXT: 905\.4 Reserved/);
  const fireInput = researchInputForEvidence(fire.question, fire.sources, { sourceAvailability: fire.sourceAvailability });
  assert.match(fireInput, /SUPPLIED_RECORD_TEXT: 508 FC 508: Reserved \[Repealed or reserved/);
  assert.doesNotMatch(fireInput, /ENACTED_TEXT: 508 FC 508: Reserved/);
  assert.equal(fireInput.split("An importer placeholder is synthetic text").length - 1, 1,
    "Explain placeholder provenance once, without inflating each source's prompt.");

  let completeBodies = 0;
  for (const source of (await json("acceptance-model-reviewed-sources.json")).sources) {
    const body = await researchBodyForCatalogSection({ ...source, id: source.sectionID });
    const text = (body.blocks || []).map(block => String(block.plainText || "")).filter(Boolean).join("\n\n");
    assert.equal(hash(text), source.textSHA256, `${source.reference}: complete authoritative body unchanged`);
    assert.equal(text, source.text);
    completeBodies += 1;
  }
  const { buildResearchRequestEnvelopeBuilders } = await import("./research-request-envelope-preflight.mjs");
  const policy = await json("luna-model-policy.json");
  const env = { ...policy.configuration, PERMITEXT_RESEARCH_PRICING_VERSION: "offline-contract",
    PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "offline-contract", PERMITEXT_RESEARCH_MAX_REQUEST_USD: "1" };
  const { buildAnswerRequest, buildVerifierRequest } = await buildResearchRequestEnvelopeBuilders(env);
  for (const packet of packets) {
    const options = { sourceAvailability: packet.sourceAvailability, responseStyle: "conversational" };
    const draft = buildAnswerRequest(packet.question, packet.sources, "offline-source-state", options);
    const source = packet.sources[0];
    const answer = { answerText: "The source record supplies no operative requirement or historical wording for the requested provision.",
      supportedPoints: [], citations: [{ sectionID: source.sectionID, sourceIDs: [source.sourceID], relevance: "Inspected record boundary." }],
      assumptions: [], missingFacts: [], followUpQuestions: [], evidenceLimitations: [], additionalEvidenceNeeded: [], supportingSourceUses: [] };
    const review = buildVerifierRequest(packet.question, packet.sources, answer, "offline-source-state", options);
    assert.equal(draft.model, "gpt-6-luna"); assert.equal(draft.reasoning.effort, "low");
    assert.equal(review.model, "gpt-6-luna"); assert.equal(review.reasoning.effort, "medium");
    assert.equal(draft.store, false); assert.equal(review.store, false);
    assert.match(review.input, /SOURCE_(?:BODY_STATE|AVAILABILITY)/);
    assert.match(review.input, /PROPOSED ANSWER JSON/);
    assert(review.text.format.schema.required.includes("materialScopeReview"), "Fresh substantive scope review remains required.");
    assert.equal(review.input.includes("\"sectionID\":\"12550\""), packet === empty);
    if (packet === fire) assert.match(review.input, /SUPPLIED_RECORD_TEXT: 508 FC 508: Reserved/);
  }
  assert.equal(networkAttempts, 0);
  assert.equal(hash(await readFile(new URL("budget-ledger.json", root))), ledgerBefore);
  console.log(JSON.stringify({ status: "passed", offlineRetrievalCases: packets.length, completeBodies,
    canonicalIdentitiesPreserved: true, firePassageIDsPreserved: true, draftReviewEnvelopes: 4, networkAttempts, ledgerUnchanged: true }));
} finally { await rm(scratch, { recursive: true, force: true }); }
