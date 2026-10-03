import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildResearchPassageIndex } from "../research-passage-index.mjs";
import {
  createResearchSemanticSearch, encodeResearchSemanticVectors, loadResearchSemanticVectors, requestResearchEmbeddings,
  researchPassageEmbeddingText, researchSemanticInputHash, searchResearchSemanticPassages,
  researchSemanticEmbeddingModel, researchSemanticEmbeddingDimensions,
  researchSemanticEmbeddingTextVersion, researchSemanticEmbeddingReservation
} from "../research-semantic-passages.mjs";
import {
  buildPreparedResearchSemanticIndex, convertPreparedResearchSemanticIndex, semanticIndexBuilderArguments, writeSemanticIndexArtifact
} from "../scripts/build-research-semantic-index.mjs";

const basis = position => Array.from({ length: researchSemanticEmbeddingDimensions }, (_, index) => Number(index === position));
const current = { id: "current", codePrefix: "FC", codeEdition: "2022", codeVersion: "current-1", sectionNumber: "315", title: "Combustible materials storage" };
const historical = { ...current, id: "historical", codeEdition: "1968", codeVersion: "historic-1" };
const plumbing = { id: "plumbing", codePrefix: "PC", codeEdition: "2022", codeVersion: "plumbing-1", sectionNumber: "1002.1", title: "Fixture traps" };
const body = { blocks: [{ id: "storage", plainText: "315.2.3 Equipment rooms.\n\nCombustible material shall not be stored in mechanical rooms." }] };
const index = await buildResearchPassageIndex([current, plumbing], async section => section.id === "plumbing" ? { blocks: [{ id: "traps", plainText: "A fixture shall not be double trapped." }] } : body);
const oldIndex = await buildResearchPassageIndex([historical], async () => body);
const artifact = {
  schemaVersion: 1, model: researchSemanticEmbeddingModel, dimensions: researchSemanticEmbeddingDimensions,
  embeddingTextVersion: researchSemanticEmbeddingTextVersion,
  entries: [...index.passages, ...oldIndex.passages].map((passage, position) => ({
    inputHash: researchSemanticInputHash(researchPassageEmbeddingText(passage)), embedding: basis(position)
  }))
};
const loaded = await loadResearchSemanticVectors(artifact);
const hits = searchResearchSemanticPassages(index, loaded, basis(0));
assert.equal(hits[0].sectionID, "current");
assert.equal(hits[0].subsectionNumber, "315.2.3");
assert.match(hits[0].text, /shall not be stored/);
assert(hits.every(hit => hit.sectionID !== "historical"), "Vectors outside the authorized live corpus must never nominate sections.");
assert.equal(searchResearchSemanticPassages(index, loaded, basis(2)).length, 0, "A historical vector alone cannot reintroduce a historical source.");
const changedIndex = await buildResearchPassageIndex([current], async () => ({ blocks: [{ id: "storage", plainText: "315.2.3 Equipment rooms.\n\nUpdated enacted rule text." }] }));
assert.equal(searchResearchSemanticPassages(changedIndex, loaded, basis(0)).length, 0, "Stale vectors must not match changed source input.");
assert.equal(researchPassageEmbeddingText({ ...index.passages[0], searchText: "x".repeat(10000) }).length, 6200);
assert(Buffer.byteLength(researchPassageEmbeddingText({ ...index.passages[0], searchText: "🔥".repeat(10000) }), "utf8") <= 8192);
await assert.rejects(loadResearchSemanticVectors({ ...artifact, model: "another-model" }), /Unsupported/);
await assert.rejects(loadResearchSemanticVectors({ ...artifact, dimensions: 128 }), /Unsupported/);
await assert.rejects(loadResearchSemanticVectors({ ...artifact, entries: [artifact.entries[0], artifact.entries[0]] }), /duplicate/);
await assert.rejects(loadResearchSemanticVectors({ ...artifact, entries: [{ ...artifact.entries[0], embedding: [1, 2] }] }), /dimensions/);
await assert.rejects(loadResearchSemanticVectors({ ...artifact, entries: [{ ...artifact.entries[0], embedding: basis(0).fill(0) }] }), /Empty semantic vector/);
await assert.rejects(loadResearchSemanticVectors({ ...artifact, entries: [{ ...artifact.entries[0], embedding: basis(0).fill(NaN) }] }), /Non-finite/);
const nuanced = { ...artifact, entries: artifact.entries.map((entry, position) => ({ ...entry,
  embedding: Array.from({ length: 256 }, (_, index) => Math.sin((index + 1) * (position + 1)) * 0.037) })) };
const nuancedJSON = await loadResearchSemanticVectors(nuanced);
const binary = await encodeResearchSemanticVectors(nuanced);
const nuancedBinary = await loadResearchSemanticVectors(binary);
assert.equal(nuancedBinary.storageFormat, "normalized-float32le");
for (const [inputHash, vector] of nuancedJSON.vectors) {
  assert.deepEqual([...nuancedBinary.vectors.get(inputHash)], [...vector], "Binary storage must preserve exactly the normalized Float32 values used by JSON retrieval.");
}
const query = Array.from({ length: 256 }, (_, index) => Math.cos(index * 2.3));
assert.deepEqual(searchResearchSemanticPassages(index, nuancedBinary, query), searchResearchSemanticPassages(index, nuancedJSON, query), "Cosine retrieval scores and source hits must remain identical.");
assert(binary.equals(await encodeResearchSemanticVectors({ ...nuanced, entries: [...nuanced.entries].reverse() })), "Binary output is deterministic independent of JSON entry ordering.");
const corruptBinary = Buffer.from(binary);
corruptBinary[corruptBinary.length - 1] ^= 1;
await assert.rejects(loadResearchSemanticVectors(corruptBinary), /changed semantic binary payload/);
await assert.rejects(loadResearchSemanticVectors(binary.subarray(0, binary.length - 4)), /Truncated/);
const wrongBinaryDimensions = Buffer.from(binary);
const headerSize = wrongBinaryDimensions.readUInt32LE(8);
const headerText = wrongBinaryDimensions.toString("utf8", 12, 12 + headerSize).replace('"dimensions":256', '"dimensions":128');
wrongBinaryDimensions.write(headerText, 12, "utf8");
await assert.rejects(loadResearchSemanticVectors(wrongBinaryDimensions), /Unsupported/);

let calls = 0;
let active = 0;
let maximumActive = 0;
const requests = [];
const mockProvider = async (url, request) => {
  calls += 1; active += 1; maximumActive = Math.max(maximumActive, active);
  assert.equal(url, "https://api.openai.com/v1/embeddings");
  const sent = JSON.parse(request.body);
  requests.push(sent);
  assert.equal(sent.model, researchSemanticEmbeddingModel);
  assert.equal(sent.dimensions, 256);
  assert.equal(sent.encoding_format, "float");
  await new Promise(resolve => setTimeout(resolve, 2));
  active -= 1;
  return { ok: true, status: 200, headers: new Headers(), json: async () => ({
    model: sent.model, usage: { prompt_tokens: sent.input.length * 10, total_tokens: sent.input.length * 10 },
    data: sent.input.map((_, index) => ({ index, embedding: basis(0) }))
  }) };
};
const disabled = createResearchSemanticSearch({ vectors: loaded, apiKey: "test-key", fetchImpl: mockProvider });
assert.equal((await disabled.search(index, "Can I keep cardboard there?")).metadata.fallbackReason, "semantic_search_disabled");
assert.equal(calls, 0);
const noKey = createResearchSemanticSearch({ enabled: true, vectors: loaded, fetchImpl: mockProvider });
assert.equal((await noKey.search(index, "Can I keep cardboard there?")).metadata.fallbackReason, "semantic_key_missing");
assert.equal(calls, 0);
const unavailable = createResearchSemanticSearch({ enabled: true, vectors: loaded, apiKey: "test-key", fetchImpl: mockProvider });
assert.equal((await unavailable.search(changedIndex, "Storage?")).metadata.fallbackReason, "semantic_vectors_outdated_or_out_of_scope");
assert.equal(calls, 0, "Do not pay for a query when no authorized source vectors exist.");
const accounting = [];
const search = createResearchSemanticSearch({ enabled: true, vectors: loaded, apiKey: "test-key", fetchImpl: mockProvider, cacheLimit: 2,
  beforeRequest(value) { accounting.push({ phase: "before", ...value }); }, afterRequest(value) { accounting.push({ phase: "after", ...value }); } });
const first = await search.search(index, "Can I keep cardboard in this room?");
assert.equal(first.hits[0].sectionID, "current");
assert.equal(first.metadata.queryCached, false);
assert.equal(first.metadata.costUSD, 10 * .02 / 1e6);
const repeated = await search.search(index, "Can I keep cardboard in this room?");
assert.equal(repeated.metadata.queryCached, true);
assert.equal(calls, 1);
await Promise.all([search.search(index, "Second distinct question?"), search.search(index, "Third distinct question?")]);
assert.equal(maximumActive, 1, "Paid embedding calls should remain serialized.");
assert.equal(search.cacheSize, 2, "Query embedding cache must be bounded.");
assert.equal(accounting.filter(item => item.phase === "before").length, 3);
assert(accounting.filter(item => item.phase === "after").every(item => item.status === "settled"));
const timeout = createResearchSemanticSearch({ enabled: true, vectors: loaded, apiKey: "test-key", timeoutMS: 3,
  fetchImpl: async (_, request) => new Promise((resolve, reject) => {
    const lifetime = setTimeout(() => reject(new Error("Mock should have aborted")), 100);
    request.signal.addEventListener("abort", () => { clearTimeout(lifetime); reject(request.signal.reason); });
  }) });
const timeoutResult = await timeout.search(index, "Does this room allow storage?");
assert.equal(timeoutResult.metadata.fallbackReason, "semantic_provider_timeout");
assert.equal(timeoutResult.hits.length, 0);
assert.equal(timeout.cacheSize, 0, "A failed query must not become a permanently cached success.");
await assert.rejects(requestResearchEmbeddings(["question"], { apiKey: "test-key", fetchImpl: mockProvider }), /disabled/);
assert(researchSemanticEmbeddingReservation(["question"]) > 10 * .02 / 1e6);

const directory = await mkdtemp(join(tmpdir(), "permitext-semantic-contract-"));
try {
  const output = join(directory, "vectors.json");
  const ledger = join(directory, "spend.json");
  const initialCalls = calls;
  const inventory = await buildPreparedResearchSemanticIndex(index, { output, fetchImpl: mockProvider });
  assert.equal(inventory.mode, "offline_inventory");
  assert.equal(inventory.missingInputCount, index.passages.length);
  assert.equal(calls, initialCalls, "Inventory mode cannot make provider calls.");
  await assert.rejects(readFile(output), /ENOENT/, "Inventory should not write a paid vector artifact.");
  const built = await buildPreparedResearchSemanticIndex(index, { output, live: true, budgetLedger: ledger, capUSD: 13.97, apiKey: "test-key", fetchImpl: mockProvider, batchSize: 1 });
  assert.equal(built.completedBatchCount, index.passages.length);
  const written = await loadResearchSemanticVectors(output);
  assert.equal(written.inputCount, index.passages.length);
  const audit = JSON.parse(await readFile(ledger, "utf8"));
  assert.equal(audit.capUSD, 13.97);
  assert(audit.calls.every(call => call.status === "settled" && call.model === researchSemanticEmbeddingModel));
  assert.equal(audit.calls.reduce((sum, call) => sum + call.costUSD, 0), built.actualCostUSD);
  const afterBuild = calls;
  await rm(output);
  const resumed = await buildPreparedResearchSemanticIndex(index, { output, live: true, budgetLedger: ledger, capUSD: 13.97, apiKey: "test-key", fetchImpl: mockProvider });
  assert.equal(resumed.missingInputCount, 0);
  assert.equal(calls, afterBuild, "Hash-addressed checkpoints must resume without re-embedding unchanged sources, even before consolidation exists.");
  assert.equal(resumed.checkpointCount, index.passages.length);
  assert.equal((await loadResearchSemanticVectors(output)).inputCount, index.passages.length);
  const binaryOutput = join(directory, "vectors.bin");
  const converted = await convertPreparedResearchSemanticIndex(output, binaryOutput);
  assert.equal(converted.mode, "offline_binary_conversion");
  assert.equal(converted.inputCount, index.passages.length);
  assert.equal((await loadResearchSemanticVectors(binaryOutput)).inputCount, index.passages.length);
  assert.equal(calls, afterBuild, "Offline binary conversion cannot make provider calls.");
  await assert.rejects(convertPreparedResearchSemanticIndex(output, output), /preserve/);
  await writeSemanticIndexArtifact(join(directory, "invalid.json"), { ...artifact, model: "invalid" });
  await assert.rejects(buildPreparedResearchSemanticIndex(index, { output: join(directory, "invalid.json") }), /Unsupported/);
  const failedLedger = join(directory, "failed-spend.json");
  let failureCalls = 0;
  const fail = async () => { failureCalls += 1; throw new Error("provider outcome unknown"); };
  await assert.rejects(buildPreparedResearchSemanticIndex(index, { output: join(directory, "failure.json"), live: true, budgetLedger: failedLedger, capUSD: 13.97, apiKey: "test-key", fetchImpl: fail }), /unknown/);
  const failedAudit = JSON.parse(await readFile(failedLedger, "utf8"));
  assert.equal(failedAudit.calls[0].status, "unknown");
  assert(failedAudit.calls[0].reservedUSD > 0);
  await assert.rejects(buildPreparedResearchSemanticIndex(index, { output: join(directory, "failure.json"), live: true, budgetLedger: failedLedger, capUSD: 13.97, apiKey: "test-key", fetchImpl: fail }), /Reconcile unsettled/);
  assert.equal(failureCalls, 1, "Unknown outcomes block paid retries and resumed batches.");
} finally { await rm(directory, { recursive: true, force: true }); }

assert.equal(semanticIndexBuilderArguments([]).live, false);
assert.throws(() => semanticIndexBuilderArguments(["--live", "--convert-only"]), /cannot be combined/);
assert.throws(() => semanticIndexBuilderArguments(["--convert-only"]), /binary-output/);
assert.equal(semanticIndexBuilderArguments(["--convert-only", "--binary-output=/tmp/vectors.bin"]).convertOnly, true);
assert.throws(() => semanticIndexBuilderArguments(["--live"]), /budget ledger/);
assert.throws(() => semanticIndexBuilderArguments(["--live", "--budget-ledger=test.json"]), /13.97/);
assert.throws(() => semanticIndexBuilderArguments(["--live", "--budget-ledger=test.json", "--campaign-cap-usd=15.73"]), /13.97/);
assert.equal(semanticIndexBuilderArguments(["--live", "--budget-ledger=test.json", "--campaign-cap-usd=13.97"]).capUSD, 13.97);
console.log("Semantic passage contracts passed: source hashes and corpus boundaries, complete source hits, opt-in provider use, bounded cache, timeout fallback, atomic resumable indexing and shared-budget unknown-outcome stops.");
