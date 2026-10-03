import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  assertPreparedResearchSemanticIndex, loadPreparedResearchSemanticVectors,
  preparedResearchSemanticArtifactVersion, preparedResearchSemanticManifestPath,
  preparedResearchSemanticVectorPath
} from "../research-semantic-artifact.mjs";
import {
  encodeResearchSemanticVectors, researchSemanticEmbeddingDimensions,
  researchSemanticEmbeddingModel, researchSemanticEmbeddingTextVersion
} from "../research-semantic-passages.mjs";
import { researchPassageIndexVersion } from "../research-passage-index.mjs";
import { inspectPreparedResearchFunctionBundle } from "../scripts/verify-prepared-research-assets.mjs";
import { isAllowedCodeAssetFileName } from "../code-asset-store.mjs";
import { buildPublicEntry } from "../scripts/build-public-entry.mjs";

const root = await mkdtemp(join(tmpdir(), "permitext-private-semantic-asset-"));
const vectorPath = join(root, "prepared/research-semantic/current-vectors.bin");
const manifestPath = join(dirname(vectorPath), "current-vectors-manifest.json");
const fingerprint = "a".repeat(64);
const binary = await encodeResearchSemanticVectors({ schemaVersion: 1,
  model: researchSemanticEmbeddingModel, dimensions: researchSemanticEmbeddingDimensions,
  embeddingTextVersion: researchSemanticEmbeddingTextVersion, indexFingerprint: fingerprint,
  entries: [{ inputHash: "b".repeat(64), embedding: Array.from({ length: researchSemanticEmbeddingDimensions }, (_, n) => n === 0 ? 1 : 0) }]
});
const manifest = { schemaVersion: 1, artifactVersion: preparedResearchSemanticArtifactVersion,
  vectorFile: "current-vectors.bin", byteLength: binary.length,
  sha256: createHash("sha256").update(binary).digest("hex"),
  model: researchSemanticEmbeddingModel, dimensions: researchSemanticEmbeddingDimensions,
  embeddingTextVersion: researchSemanticEmbeddingTextVersion, passageIndexVersion: researchPassageIndexVersion,
  inputCount: 1, currentCorpusFingerprint: fingerprint,
  currentCorpora: [{ id: "nyc-2022-construction-codes", codeVersion: "test-current" }],
  authorizedIndexes: [{ fingerprint, passageCount: 1, corpusIDs: ["nyc-2022-construction-codes"] }]
};
const index = { version: researchPassageIndexVersion, fingerprint,
  passages: [{ corpusID: "nyc-2022-construction-codes" }] };
const save = async value => writeFile(manifestPath, JSON.stringify(value));
let providerCalls = 0;
const provider = async () => { providerCalls++; };
// Same call ordering required by the hosted integration: load, live-source
// scope gate, then provider. A failed asset never creates a paid request.
const probe = async liveIndex => {
  try {
    const loaded = await loadPreparedResearchSemanticVectors({ vectorPath, manifestPath });
    assertPreparedResearchSemanticIndex(liveIndex, loaded.manifest);
    await provider();
    return "semantic";
  } catch (error) { return error.code; }
};
try {
  await mkdir(dirname(vectorPath), { recursive: true });
  await writeFile(vectorPath, binary); await save(manifest);
  const loaded = await loadPreparedResearchSemanticVectors({ vectorPath, manifestPath });
  assert.equal(loaded.vectors.inputCount, 1);
  assert.equal(loaded.vectors.indexFingerprint, fingerprint);
  assert.equal(assertPreparedResearchSemanticIndex(index, loaded.manifest), true);
  assert.equal(await probe({ ...index, fingerprint: "c".repeat(64) }), "SEMANTIC_ARTIFACT_STALE");
  assert.equal(await probe({ ...index, version: "prior-index-version" }), "SEMANTIC_ARTIFACT_STALE");
  assert.equal(await probe({ ...index, passages: [] }), "SEMANTIC_ARTIFACT_STALE");
  assert.equal(await probe({ ...index, passages: [{ corpusID: "nyc-2014-construction-codes" }] }), "SEMANTIC_ARTIFACT_STALE");
  for (const changed of [
    { ...manifest, model: "unexpected-model" },
    { ...manifest, dimensions: 128 },
    { ...manifest, embeddingTextVersion: "outdated-text-version" },
    { ...manifest, passageIndexVersion: "outdated-index-version" },
    { ...manifest, currentCorpora: [{ id: "nyc-2014-construction-codes", codeVersion: "historical" }] },
    { ...manifest, authorizedIndexes: [...manifest.authorizedIndexes, manifest.authorizedIndexes[0]] }
  ]) {
    await save(changed);
    assert.equal(await probe(index), "SEMANTIC_ARTIFACT_INVALID");
  }
  await save({ ...manifest, inputCount: 2 });
  assert.equal(await probe(index), "SEMANTIC_ARTIFACT_STALE");
  await save(manifest);
  const changedBytes = Buffer.from(binary); changedBytes[changedBytes.length - 1] ^= 1;
  await writeFile(vectorPath, changedBytes);
  assert.equal(await probe(index), "SEMANTIC_ARTIFACT_CORRUPT");
  await writeFile(vectorPath, binary.subarray(0, binary.length - 4));
  assert.equal(await probe(index), "SEMANTIC_ARTIFACT_CORRUPT");
  await rm(vectorPath);
  assert.equal(await probe(index), "SEMANTIC_ARTIFACT_MISSING");
  await writeFile(vectorPath, binary); await writeFile(manifestPath, "{");
  assert.equal(await probe(index), "SEMANTIC_ARTIFACT_INVALID");
  await rm(manifestPath);
  assert.equal(await probe(index), "SEMANTIC_ARTIFACT_MISSING");
  assert.equal(providerCalls, 0, "Missing, stale and corrupt assets must fall back before query spending");
  await save(manifest);
  assert.equal(await probe(index), "semantic");
  assert.equal(providerCalls, 1);

  const publicSource = join(root, "public"), publicOutput = join(root, "deployment-public");
  await mkdir(publicSource); await writeFile(join(publicSource, "index.html"), "workspace");
  await writeFile(join(publicSource, "home.html"), "home");
  await buildPublicEntry(publicSource, publicOutput);
  await assert.rejects(readFile(join(publicOutput, "prepared/research-semantic/current-vectors.bin")), { code: "ENOENT" });
  assert(!isAllowedCodeAssetFileName("current-vectors.bin"));
  assert(!isAllowedCodeAssetFileName("current-vectors-manifest.json"));
  assert(preparedResearchSemanticVectorPath.includes("/prepared/research-semantic/"));
  assert(!preparedResearchSemanticVectorPath.includes("/public/"));
  assert.equal(dirname(preparedResearchSemanticVectorPath), dirname(preparedResearchSemanticManifestPath));
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  assert(config.buildCommand.includes("node scripts/verify-prepared-research-assets.mjs"));
  const include = config.functions["api/index.mjs"].includeFiles;
  assert(include.includes("prepared/research-semantic/current-vectors.bin"));
  assert(include.includes("prepared/research-semantic/current-vectors-manifest.json"));
  assert(!include.includes("CodeContent"), "Vector packaging must not duplicate canonical content includes");
  const bundle = await inspectPreparedResearchFunctionBundle(dirname(vectorPath), { maximumBytes: 10000 });
  assert(bundle.bytes > binary.length && bundle.headroomBytes > 0);
  await assert.rejects(inspectPreparedResearchFunctionBundle(dirname(vectorPath), { maximumBytes: 1 }), /confirmed limit/);
  console.log("Prepared Research asset contract passed: checksum, metadata, live source scope, no-spend fallback, private output and size gate.");
} finally { await rm(root, { recursive: true, force: true }); }
