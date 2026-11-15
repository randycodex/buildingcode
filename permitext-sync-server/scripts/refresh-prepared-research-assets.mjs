// Maintenance of the current public corpus; separate from paid answer/eval campaigns.
// Offline by default. A live run requires an explicit cap no greater than $0.50.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { currentPreparedResearchIndexes, buildPreparedResearchManifest } from "./verify-prepared-research-assets.mjs";
import { evaluationBudget } from "./research-evaluation-budget.mjs";
import { preparedResearchSemanticVectorPath, preparedResearchSemanticManifestPath, loadPreparedResearchSemanticVectors } from "../research-semantic-artifact.mjs";
import { researchPassageEmbeddingText, researchSemanticInputHash, researchSemanticEmbeddingReservation,
  researchSemanticEmbeddingModel, researchSemanticEmbeddingDimensions, researchSemanticEmbeddingTextVersion,
  researchSemanticEmbeddingPricePerMillionTokens, requestResearchEmbeddings,
  loadResearchSemanticVectors, encodeResearchSemanticVectors } from "../research-semantic-passages.mjs";

export function planSemanticRefresh(index, stored, batchSize = 64) {
  assert.match(index.fingerprint, /^[a-f0-9]{64}$/);
  assert(Number.isInteger(batchSize) && batchSize > 0 && batchSize <= 128, "Invalid embedding batch size");
  const inputs = new Map();
  for (const passage of index.passages) {
    const input = researchPassageEmbeddingText(passage);
    assert(input.trim());
    inputs.set(researchSemanticInputHash(input), input);
  }
  const retained = new Map([...inputs].filter(([hash]) => stored.vectors.has(hash)).map(([hash]) => [hash, stored.vectors.get(hash)]));
  const missing = [...inputs].filter(([hash]) => !retained.has(hash));
  const batches = [];
  for (let cursor = 0; cursor < missing.length;) {
    const batch = []; let bytes = 0;
    while (cursor < missing.length && batch.length < batchSize) {
      const item = missing[cursor], size = Buffer.byteLength(item[1]);
      assert(size <= 8192);
      if (batch.length && bytes + size > 250000) break;
      batch.push(item); bytes += size; cursor++;
    }
    batches.push(batch);
  }
  return { inputs, retained, batches, summary: { fingerprint: index.fingerprint,
    passageCount: index.passages.length, inputCount: inputs.size, reusedInputCount: retained.size,
    missingInputCount: missing.length, batchCount: batches.length,
    conservativeReservationUSD: batches.reduce((sum, batch) => sum + researchSemanticEmbeddingReservation(batch.map(([, input]) => input)), 0) } };
}

export function assertRefreshBudget(plan, maximumUSD) {
  assert(Number.isFinite(maximumUSD) && maximumUSD > 0 && maximumUSD <= 0.5, "Maintenance cap must be positive and at most $0.50");
  assert(plan.summary.conservativeReservationUSD <= maximumUSD, "Current refresh exceeds the explicit maintenance cap; stop before provider dispatch");
}

async function atomicWrite(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, bytes, { mode: 0o600 });
  await rename(temporary, path);
}

async function main() {
  const args = process.argv.slice(2);
  assert(args.every(arg => arg === "--live" || /^--(?:maximum-usd|checkpoint-directory)=.+$/.test(arg)), "Unknown refresh argument");
  const argument = name => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const live = args.includes("--live");
  const checkpointDirectory = argument("checkpoint-directory") ? resolve(argument("checkpoint-directory")) : null;
  if (live) assert(checkpointDirectory && argument("maximum-usd"), "Live maintenance requires explicit checkpoint directory and spending cap");
  const [current, { vectors: stored }] = await Promise.all([currentPreparedResearchIndexes(), loadPreparedResearchSemanticVectors()]);
  const cached = new Map(stored.vectors);
  if (checkpointDirectory) {
    await mkdir(checkpointDirectory, { recursive: true });
    for (const file of (await readdir(checkpointDirectory)).filter(file => /^batch-[a-f0-9-]+\.bin$/.test(file)).sort()) {
      const checkpoint = await loadResearchSemanticVectors(await readFile(join(checkpointDirectory, file)));
      assert.equal(checkpoint.indexFingerprint, current.fullIndex.fingerprint, "Checkpoint belongs to a different source revision");
      for (const [hash, vector] of checkpoint.vectors) cached.set(hash, vector);
    }
  }
  const plan = planSemanticRefresh(current.fullIndex, { vectors: cached });
  console.info(JSON.stringify({ mode: live ? "live_maintenance" : "offline_inventory", ...plan.summary }));
  if (!live) return;
  const maximumUSD = Number(argument("maximum-usd"));
  assertRefreshBudget(plan, maximumUSD);
  const budget = evaluationBudget(join(checkpointDirectory, "budget-ledger.json"), maximumUSD, {
    model: researchSemanticEmbeddingModel, pricePerMillionInputTokensUSD: researchSemanticEmbeddingPricePerMillionTokens,
    pricingSource: "https://developers.openai.com/api/docs/models/text-embedding-3-small", verified: "2026-11-15" });
  assert(!budget.snapshot().calls.some(call => ["pending", "unknown"].includes(call.status)), "Reconcile unsettled provider calls before resuming");
  let apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const local = await readFile(new URL("../.env.local", import.meta.url), "utf8");
    apiKey = local.match(/^OPENAI_API_KEY=(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, "");
  }
  assert(apiKey, "Embedding key is unavailable");
  const metadata = { schemaVersion: 1, model: researchSemanticEmbeddingModel,
    dimensions: researchSemanticEmbeddingDimensions, embeddingTextVersion: researchSemanticEmbeddingTextVersion,
    indexFingerprint: current.fullIndex.fingerprint };
  let completed = 0;
  for (const batch of plan.batches) {
    const id = randomUUID();
    const result = await requestResearchEmbeddings(batch.map(([, input]) => input), {
      enabled: true, apiKey, timeoutMS: 60000,
      beforeRequest({ reservedUSD }) { budget.reserve({ id, model: researchSemanticEmbeddingModel,
        phase: "current_public_source_maintenance", inputCount: batch.length,
        inputHashes: batch.map(([hash]) => hash), reservedUSD, startedAt: new Date().toISOString() }); },
      afterRequest(result) { budget.settle(id, { ...result, endedAt: new Date().toISOString() }); }
    });
    const normalized = await loadResearchSemanticVectors({ ...metadata, entries: batch.map(([inputHash], position) => ({ inputHash, embedding: result.vectors[position] })) });
    for (const [hash, vector] of normalized.vectors) plan.retained.set(hash, vector);
    await atomicWrite(join(checkpointDirectory, `batch-${id}.bin`), await encodeResearchSemanticVectors({ ...normalized, indexFingerprint: current.fullIndex.fingerprint }));
    completed++;
    if (completed === 1 || completed % 25 === 0 || completed === plan.batches.length) console.info(JSON.stringify({ batches: completed, total: plan.batches.length,
      actualCostUSD: budget.snapshot().calls.reduce((sum, call) => sum + (call.costUSD ?? call.reservedUSD), 0) }));
  }
  assert.equal(plan.retained.size, plan.inputs.size);
  for (const [hash, vector] of stored.vectors) if (plan.inputs.has(hash)) assert.deepEqual(plan.retained.get(hash), vector, "Exact cached vectors must retain their original Float32 values");
  const binary = await encodeResearchSemanticVectors({ ...stored, vectors: plan.retained, indexFingerprint: current.fullIndex.fingerprint });
  const manifest = await buildPreparedResearchManifest(binary, current);
  await atomicWrite(preparedResearchSemanticVectorPath, binary);
  await atomicWrite(preparedResearchSemanticManifestPath, JSON.stringify(manifest, null, 2) + "\n");
  const ledger = budget.snapshot();
  const summary = { ...plan.summary, model: metadata.model, maximumCostUSD: maximumUSD,
    actualCostUSD: ledger.calls.reduce((sum, call) => sum + call.costUSD, 0), providerRequestCount: ledger.calls.length,
    outputSHA256: manifest.sha256, outputBytes: binary.length,
    dataScope: "Current public enacted source text only; no user questions, project data, or generated answers." };
  await atomicWrite(join(checkpointDirectory, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
  console.info(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => {
  console.error(`Prepared Research refresh stopped: ${error.code || error.name}: ${error.message}`);
  process.exitCode = 1;
});
