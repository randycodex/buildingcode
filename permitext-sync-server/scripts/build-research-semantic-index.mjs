// Isolated prepared-vector builder. Offline inventory is the default. This
// script never creates user Research history or changes production settings.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluationBudget } from "./research-evaluation-budget.mjs";
import {
  encodeResearchSemanticVectors, loadResearchSemanticVectors, requestResearchEmbeddings,
  researchPassageEmbeddingText, researchSemanticInputHash,
  researchSemanticEmbeddingModel, researchSemanticEmbeddingDimensions,
  researchSemanticEmbeddingTextVersion, researchSemanticEmbeddingPricePerMillionTokens,
  researchSemanticEmbeddingReservation
} from "../research-semantic-passages.mjs";

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function semanticIndexBuilderArguments(args = process.argv.slice(2)) {
  const get = name => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const known = /^(?:--live|--convert-only|--(?:output|binary-output|budget-ledger|campaign-cap-usd|batch-size|limit|inventory-output)=.+)$/;
  assert(args.every(arg => known.test(arg)), "Unknown semantic index builder argument");
  const live = args.includes("--live");
  const convertOnly = args.includes("--convert-only");
  assert(!(live && convertOnly), "Conversion is offline and cannot be combined with --live");
  if (convertOnly) assert(get("binary-output"), "Offline conversion requires --binary-output=<path>");
  const ledger = get("budget-ledger");
  const cap = get("campaign-cap-usd");
  if (live) {
    assert(ledger, "Live index building requires an explicit new campaign budget ledger");
    assert.equal(Number(cap), 13.97, "Live index building requires --campaign-cap-usd=13.97");
  }
  const batchSize = Number(get("batch-size") || 64);
  const limit = get("limit") ? Number(get("limit")) : null;
  assert(Number.isSafeInteger(batchSize) && batchSize >= 1 && batchSize <= 128, "Batch size must be 1–128");
  assert(limit == null || (Number.isSafeInteger(limit) && limit > 0), "Invalid passage input limit");
  return {
    live, convertOnly, ledger: ledger ? resolve(ledger) : null, capUSD: Number(cap || 13.97), batchSize, limit,
    output: resolve(get("output") || `${serverRoot}/.semantic-local/current-passage-vectors.json`),
    binaryOutput: get("binary-output") ? resolve(get("binary-output")) : null,
    inventoryOutput: get("inventory-output") ? resolve(get("inventory-output")) : null
  };
}

export async function writeSemanticIndexArtifact(path, artifact) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(artifact), { mode: 0o600 });
  await rename(temporary, path);
}

export async function convertPreparedResearchSemanticIndex(source, output) {
  assert(output && (typeof source !== "string" || resolve(source) !== resolve(output)), "Binary conversion must preserve its original JSON artifact");
  const binary = await encodeResearchSemanticVectors(source);
  await mkdir(dirname(output), { recursive: true });
  const temporary = `${output}.${randomUUID()}.tmp`;
  await writeFile(temporary, binary, { mode: 0o600 });
  await rename(temporary, output);
  const validated = await loadResearchSemanticVectors(output);
  return { mode: "offline_binary_conversion", output, bytes: binary.length, inputCount: validated.inputCount,
    model: validated.model, dimensions: validated.dimensions, storageFormat: validated.storageFormat };
}

export function researchSemanticEmbeddingInventory(index, { limit = null } = {}) {
  const inputs = new Map();
  for (const passage of index.passages) {
    const input = researchPassageEmbeddingText(passage);
    if (!input) continue;
    const inputHash = researchSemanticInputHash(input);
    if (!inputs.has(inputHash)) inputs.set(inputHash, { inputHash, input });
  }
  return { passageCount: index.passages.length, uniqueInputCount: inputs.size,
    inputs: limit ? [...inputs.values()].slice(0, limit) : [...inputs.values()] };
}

function embeddingBatches(inputs, batchSize) {
  const batches = [];
  let cursor = 0;
  while (cursor < inputs.length) {
    const batch = [];
    let bytes = 0;
    while (cursor < inputs.length && batch.length < batchSize) {
      const candidate = inputs[cursor];
      const size = Buffer.byteLength(candidate.input, "utf8");
      assert(size <= 8192, "Embedding input exceeds conservative per-input token bound");
      if (batch.length && bytes + size > 250000) break;
      batch.push(candidate); bytes += size; cursor += 1;
    }
    batches.push(batch);
  }
  return batches;
}

export async function buildPreparedResearchSemanticIndex(index, {
  output, live = false, budgetLedger, capUSD = 13.97, batchSize = 64, limit = null,
  apiKey, fetchImpl = globalThis.fetch, onProgress = () => {}, timeoutMS = 60000
} = {}) {
  assert(output, "Output artifact path is required");
  const inventory = researchSemanticEmbeddingInventory(index, { limit });
  let artifact;
  try {
    artifact = JSON.parse(await readFile(output, "utf8"));
    await loadResearchSemanticVectors(artifact);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    artifact = { schemaVersion: 1, model: researchSemanticEmbeddingModel, dimensions: researchSemanticEmbeddingDimensions,
      embeddingTextVersion: researchSemanticEmbeddingTextVersion, entries: [] };
  }
  const cache = new Map(artifact.entries.map(entry => [entry.inputHash, entry]));
  const checkpointDirectory = `${output}.batches`;
  let checkpointFiles = [];
  try { checkpointFiles = (await readdir(checkpointDirectory)).filter(name => /^batch-[a-f0-9-]+\.json$/.test(name)).sort(); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  for (const name of checkpointFiles) {
    const checkpoint = JSON.parse(await readFile(resolve(checkpointDirectory, name), "utf8"));
    await loadResearchSemanticVectors(checkpoint);
    for (const entry of checkpoint.entries) cache.set(entry.inputHash, entry);
  }
  const missing = inventory.inputs.filter(input => !cache.has(input.inputHash));
  const batches = embeddingBatches(missing, batchSize);
  const estimatedReservation = batches.reduce((sum, batch) => sum + researchSemanticEmbeddingReservation(batch.map(input => input.input)), 0);
  const summary = {
    mode: live ? "live" : "offline_inventory", model: researchSemanticEmbeddingModel,
    dimensions: researchSemanticEmbeddingDimensions, pricePerMillionInputTokensUSD: researchSemanticEmbeddingPricePerMillionTokens,
    indexFingerprint: index.fingerprint, passageCount: inventory.passageCount,
    uniqueInputCount: inventory.uniqueInputCount, selectedInputCount: inventory.inputs.length,
    cachedInputCount: inventory.inputs.length - missing.length, missingInputCount: missing.length,
    utf8InputBytes: missing.reduce((sum, item) => sum + Buffer.byteLength(item.input, "utf8"), 0),
    conservativeBatchedReservationUSD: estimatedReservation, plannedBatchCount: batches.length,
    checkpointDirectory, checkpointCount: checkpointFiles.length,
    actualCostUSD: 0, completedBatchCount: 0, output
  };
  if (!live) return summary;
  assert(budgetLedger && capUSD === 13.97, "Live builder requires its explicitly approved 13.97-dollar campaign ledger");
  assert(apiKey, "No OpenAI API key configured for the isolated builder");
  assert(Number.isSafeInteger(batchSize) && batchSize >= 1 && batchSize <= 128);
  await mkdir(dirname(budgetLedger), { recursive: true });
  const budget = evaluationBudget(budgetLedger, capUSD);
  const snapshot = budget.snapshot();
  assert(!snapshot.calls.some(call => ["pending", "unknown"].includes(call.status)), "Reconcile unsettled calls before building or resuming embeddings");
  let completedInputs = 0;
  for (const batch of batches) {
    const callID = randomUUID();
    const result = await requestResearchEmbeddings(batch.map(item => item.input), {
      enabled: true, apiKey, fetchImpl, timeoutMS,
      beforeRequest({ reservedUSD }) {
        budget.reserve({ id: callID, model: researchSemanticEmbeddingModel, phase: "passage_index_embeddings",
          inputCount: batch.length, inputHashes: batch.map(item => item.inputHash), reservedUSD,
          startedAt: new Date().toISOString(), runDirectory: dirname(output) });
      },
      afterRequest(result) {
        budget.settle(callID, { ...result, endedAt: new Date().toISOString() });
      }
    });
    const entries = batch.map((item, position) => ({ inputHash: item.inputHash, embedding: result.vectors[position] }));
    const checkpoint = { schemaVersion: 1, model: researchSemanticEmbeddingModel, dimensions: researchSemanticEmbeddingDimensions,
      embeddingTextVersion: researchSemanticEmbeddingTextVersion, indexFingerprint: index.fingerprint,
      batchID: callID, usage: result.usage, costUSD: result.costUSD, entries };
    // Each batch writes a small immutable shard. Avoid rewriting hundreds of
    // megabytes of existing vectors after every request. Resume merges valid
    // shards by exact embedding-input hash before any additional spending.
    await writeSemanticIndexArtifact(resolve(checkpointDirectory, `batch-${callID}.json`), checkpoint);
    for (const entry of entries) cache.set(entry.inputHash, entry);
    completedInputs += batch.length;
    summary.completedBatchCount += 1;
    summary.actualCostUSD += result.costUSD;
    summary.remainingInputCount = missing.length - completedInputs;
    onProgress({ ...summary });
  }
  artifact = { ...artifact, indexFingerprint: index.fingerprint, updatedAt: new Date().toISOString(),
    sourceScope: "authorized current Research passage index",
    entries: inventory.inputs.map(item => cache.get(item.inputHash)) };
  await writeSemanticIndexArtifact(output, artifact);
  summary.totalCachedInputCount = cache.size;
  summary.remainingInputCount = 0;
  return summary;
}

async function main() {
  const options = semanticIndexBuilderArguments();
  if (options.convertOnly) {
    console.log(JSON.stringify(await convertPreparedResearchSemanticIndex(options.output, options.binaryOutput), null, 2));
    return;
  }
  // Explicit experiment flags; normal production routing settings are never
  // edited, and historical/future corpora remain excluded by registry gates.
  process.env.PERMITEXT_RESEARCH_PASSAGE_SEARCH = "1";
  process.env.PERMITEXT_RESEARCH_CURRENT_CORPUS_RECALL = "1";
  const { researchCorpusPlanForTurn, researchCorpusResources } = await import("../app.mjs");
  const plan = await researchCorpusPlanForTurn({ question: "What requirements apply to an ordinary project?", messages: [], projectFacts: [], pinnedEvidence: [] });
  const resources = await researchCorpusResources(plan);
  assert(resources.passageIndex?.passages, "Research passage index is unavailable");
  const eligibleStatuses = new Set(["current-enacted-edition", "current-consolidation", "continuously-amended"]);
  assert(plan.selected.every(corpus => corpus.automaticResearchEligible === true && !corpus.optInRequired && eligibleStatuses.has(corpus.applicabilityStatus)), "Embedding corpus is outside authorized current Research scope");
  let apiKey;
  if (options.live) {
    apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const local = await readFile(resolve(serverRoot, ".env.local"), "utf8");
      apiKey = local.match(/^OPENAI_API_KEY=(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, "");
    }
    assert(apiKey, "OpenAI key is unavailable");
  }
  const summary = await buildPreparedResearchSemanticIndex(resources.passageIndex, {
    ...options, budgetLedger: options.ledger, apiKey,
    onProgress(result) { console.log(JSON.stringify({ batches: result.completedBatchCount, remainingInputs: result.remainingInputCount, actualCostUSD: result.actualCostUSD })); }
  });
  if (options.live && options.binaryOutput) summary.binaryArtifact = await convertPreparedResearchSemanticIndex(options.output, options.binaryOutput);
  if (options.inventoryOutput) await writeSemanticIndexArtifact(options.inventoryOutput, summary);
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`Semantic index builder stopped: ${error.code || error.name}: ${error.message}`); process.exitCode = 1; });
}
