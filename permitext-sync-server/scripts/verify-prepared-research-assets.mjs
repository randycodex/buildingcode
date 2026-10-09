// Offline deployment gate. Existing public-source embeddings are reused; this
// script has no provider request, credentials, project data, or reindex path.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mergeResearchPassageIndexes, researchPassageIndexVersion } from "../research-passage-index.mjs";
import {
  loadResearchSemanticVectors, researchPassageEmbeddingText, researchSemanticInputHash
} from "../research-semantic-passages.mjs";
import {
  assertPreparedResearchSemanticIndex, loadPreparedResearchSemanticVectors,
  preparedResearchSemanticArtifactVersion, preparedResearchSemanticVectorPath, preparedResearchSemanticCorpusIDs,
  preparedResearchSemanticManifestPath, validatePreparedResearchSemanticManifest
} from "../research-semantic-artifact.mjs";

export async function currentPreparedResearchIndexes() {
  const flags = ["PERMITEXT_RESEARCH_PASSAGE_SEARCH", "PERMITEXT_RESEARCH_CURRENT_CORPUS_RECALL", "PERMITEXT_RESEARCH_SEMANTIC_SEARCH"];
  const previous = flags.map(name => process.env[name]);
  const previousFetch = globalThis.fetch;
  let networkAttempts = 0;
  globalThis.fetch = async () => { networkAttempts++; throw new Error("Prepared Research asset verification is offline"); };
  process.env.PERMITEXT_RESEARCH_PASSAGE_SEARCH = "1";
  process.env.PERMITEXT_RESEARCH_CURRENT_CORPUS_RECALL = "1";
  process.env.PERMITEXT_RESEARCH_SEMANTIC_SEARCH = "0";
  try {
    const { researchCorpusPlanForTurn, researchCorpusResources } = await import("../app.mjs");
    const plan = await researchCorpusPlanForTurn({ question: "What requirements apply to an ordinary project?", messages: [], projectFacts: [], pinnedEvidence: [] });
    const eligibleStatuses = new Set(["current-enacted-edition", "current-consolidation", "continuously-amended"]);
    assert.deepEqual(plan.selected.map(corpus => corpus.id).sort(), [...preparedResearchSemanticCorpusIDs].sort(),
      "Prepared semantic source scope differs from the supported current corpora");
    assert(plan.selected.every(corpus => corpus.automaticResearchEligible === true &&
      !corpus.optInRequired && eligibleStatuses.has(corpus.applicabilityStatus)), "Prepared semantic source scope contains ineligible corpora");
    const partitions = await Promise.all(plan.selected.map(corpus => researchCorpusResources({ ...plan, selected: [corpus] })));
    const combinations = [];
    for (let mask = 1; mask < (1 << partitions.length); mask++) {
      const selected = partitions.filter((_, position) => mask & (1 << position));
      combinations.push({ index: mergeResearchPassageIndexes(selected.map(partition => partition.passageIndex)),
        corpusIDs: plan.selected.filter((_, position) => mask & (1 << position)).map(corpus => corpus.id).sort() });
    }
    assert.equal(networkAttempts, 0, "Prepared asset verification attempted a network request");
    return { corpora: plan.selected.map(corpus => ({ id: corpus.id, codeVersion: corpus.codeVersion })).sort((a, b) => a.id.localeCompare(b.id)),
      fullIndex: combinations.at(-1).index, combinations };
  } finally {
    globalThis.fetch = previousFetch;
    flags.forEach((name, position) => previous[position] === undefined ? delete process.env[name] : process.env[name] = previous[position]);
  }
}

export async function buildPreparedResearchManifest(binary, current) {
  const vectors = await loadResearchSemanticVectors(binary);
  assert.equal(vectors.storageFormat, "normalized-float32le", "Prepared runtime vectors must use the compact validated binary format");
  assert.equal(vectors.indexFingerprint, current.fullIndex.fingerprint, "Existing vectors are stale for the current full corpus; do not silently publish them");
  const hashes = new Set(current.fullIndex.passages.map(passage => researchSemanticInputHash(researchPassageEmbeddingText(passage))));
  assert.equal(hashes.size, vectors.inputCount, "Prepared semantic input inventory differs from the current corpus");
  assert([...hashes].every(hash => vectors.vectors.has(hash)), "Current source inputs are not completely represented by the prepared vectors");
  return validatePreparedResearchSemanticManifest({ schemaVersion: 1, artifactVersion: preparedResearchSemanticArtifactVersion,
    vectorFile: "current-vectors.bin", byteLength: binary.length, sha256: createHash("sha256").update(binary).digest("hex"),
    model: vectors.model, dimensions: vectors.dimensions, embeddingTextVersion: vectors.embeddingTextVersion,
    passageIndexVersion: researchPassageIndexVersion, inputCount: vectors.inputCount,
    currentCorpusFingerprint: current.fullIndex.fingerprint, currentCorpora: current.corpora,
    authorizedIndexes: current.combinations.map(({ index, corpusIDs }) => ({ fingerprint: index.fingerprint, passageCount: index.passages.length, corpusIDs })),
    dataScope: "Public enacted source relevance vectors only; no project facts, user questions, or generated answers."
  });
}

export async function verifyPreparedResearchAssets() {
  const [{ vectors, manifest }, current] = await Promise.all([loadPreparedResearchSemanticVectors(), currentPreparedResearchIndexes()]);
  const generated = await buildPreparedResearchManifest(await readFile(preparedResearchSemanticVectorPath), current);
  assert.deepEqual(manifest, generated, "Prepared semantic asset manifest is stale");
  for (const { index } of current.combinations) assertPreparedResearchSemanticIndex(index, manifest);
  return { model: vectors.model, dimensions: vectors.dimensions, bytes: manifest.byteLength,
    inputCount: vectors.inputCount, currentCorpusFingerprint: manifest.currentCorpusFingerprint,
    sourceScopeCount: manifest.authorizedIndexes.length, privateRuntimeAsset: true, networkRequests: 0 };
}

export async function inspectPreparedResearchFunctionBundle(functionDirectory, { maximumBytes = 250 * 1024 * 1024 } = {}) {
  let bytes = 0, fileCount = 0;
  const visit = async directory => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() || entry.isSymbolicLink()) { const details = await stat(path); if (details.isFile()) { bytes += details.size; fileCount++; } }
    }
  };
  await visit(resolve(functionDirectory));
  assert(bytes <= maximumBytes, `Function bundle exceeds its confirmed limit: ${bytes} bytes > ${maximumBytes}`);
  return { bytes, fileCount, maximumBytes, headroomBytes: maximumBytes - bytes,
    scope: "Local assembled function output only; hosted eligibility must be checked separately." };
}

async function main() {
  const args = process.argv.slice(2);
  assert(args.every(arg => arg === "--write" || /^--(?:source-vector|function-dir|maximum-function-bytes)=.+$/.test(arg)), "Unknown prepared asset argument");
  const argument = name => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (args.includes("--write")) {
    const source = argument("source-vector");
    assert(source, "Offline packaging requires --source-vector=<existing binary>");
    const binary = await readFile(resolve(source)), current = await currentPreparedResearchIndexes();
    const manifest = await buildPreparedResearchManifest(binary, current);
    await mkdir(dirname(preparedResearchSemanticVectorPath), { recursive: true });
    if (resolve(source) !== preparedResearchSemanticVectorPath) await copyFile(resolve(source), preparedResearchSemanticVectorPath);
    await writeFile(preparedResearchSemanticManifestPath, JSON.stringify(manifest, null, 2) + "\n");
  }
  const summary = await verifyPreparedResearchAssets();
  if (argument("function-dir")) {
    const maximumBytes = Number(argument("maximum-function-bytes") || 250 * 1024 * 1024);
    assert(Number.isSafeInteger(maximumBytes) && maximumBytes > 0 && maximumBytes <= 5 * 1024 * 1024 * 1024, "Invalid confirmed function limit");
    summary.functionBundle = await inspectPreparedResearchFunctionBundle(argument("function-dir"), { maximumBytes });
  }
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(`Prepared Research asset verification failed: ${error.code || error.name}: ${error.message}`); process.exitCode = 1; });
}
