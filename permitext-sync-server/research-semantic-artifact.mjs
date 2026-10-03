import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { researchPassageIndexVersion } from "./research-passage-index.mjs";
import {
  loadResearchSemanticVectors,
  researchSemanticEmbeddingModel,
  researchSemanticEmbeddingDimensions,
  researchSemanticEmbeddingTextVersion
} from "./research-semantic-passages.mjs";

// These files are function assets only. Neither the public entry builder nor
// the code figure resolver exposes this directory over HTTP.
export const preparedResearchSemanticVectorPath = fileURLToPath(
  new URL("./prepared/research-semantic/current-vectors.bin", import.meta.url)
);
export const preparedResearchSemanticManifestPath = fileURLToPath(
  new URL("./prepared/research-semantic/current-vectors-manifest.json", import.meta.url)
);
export const preparedResearchSemanticArtifactVersion = "20261003-private-current-corpus-v1";
const hashPattern = /^[a-f0-9]{64}$/;
const supportedCorpusIDs = new Set([
  "nyc-2022-construction-codes", "nyc-2022-fire-code", "nyc-zoning-resolution"
]);
const failure = (code, message) => Object.assign(new Error(message), { code });

export function validatePreparedResearchSemanticManifest(manifest) {
  if (manifest?.schemaVersion !== 1 || manifest.artifactVersion !== preparedResearchSemanticArtifactVersion ||
      manifest.vectorFile !== "current-vectors.bin" ||
      manifest.model !== researchSemanticEmbeddingModel ||
      manifest.dimensions !== researchSemanticEmbeddingDimensions ||
      manifest.embeddingTextVersion !== researchSemanticEmbeddingTextVersion ||
      manifest.passageIndexVersion !== researchPassageIndexVersion ||
      !hashPattern.test(manifest.sha256 || "") || !hashPattern.test(manifest.currentCorpusFingerprint || "") ||
      !Number.isSafeInteger(manifest.byteLength) || manifest.byteLength < 12 ||
      !Number.isSafeInteger(manifest.inputCount) || manifest.inputCount < 1 ||
      !Array.isArray(manifest.currentCorpora) || !manifest.currentCorpora.length ||
      !Array.isArray(manifest.authorizedIndexes) || !manifest.authorizedIndexes.length) {
    throw failure("SEMANTIC_ARTIFACT_INVALID", "Unsupported prepared semantic asset manifest");
  }
  const corpusIDs = new Set();
  for (const corpus of manifest.currentCorpora) {
    if (!supportedCorpusIDs.has(corpus?.id) || corpusIDs.has(corpus.id) ||
        typeof corpus.codeVersion !== "string" || !corpus.codeVersion) {
      throw failure("SEMANTIC_ARTIFACT_INVALID", "Invalid prepared semantic corpus scope");
    }
    corpusIDs.add(corpus.id);
  }
  const seen = new Set();
  for (const entry of manifest.authorizedIndexes) {
    if (!hashPattern.test(entry?.fingerprint || "") || seen.has(entry.fingerprint) ||
        !Number.isSafeInteger(entry.passageCount) || entry.passageCount < 1 ||
        !Array.isArray(entry.corpusIDs) || !entry.corpusIDs.length ||
        new Set(entry.corpusIDs).size !== entry.corpusIDs.length ||
        entry.corpusIDs.some(id => !corpusIDs.has(id))) {
      throw failure("SEMANTIC_ARTIFACT_INVALID", "Invalid prepared semantic index scope");
    }
    seen.add(entry.fingerprint);
  }
  if (!manifest.authorizedIndexes.some(entry => entry.fingerprint === manifest.currentCorpusFingerprint &&
      entry.corpusIDs.length === corpusIDs.size && entry.corpusIDs.every(id => corpusIDs.has(id)))) {
    throw failure("SEMANTIC_ARTIFACT_INVALID", "Prepared semantic manifest omits its full current corpus");
  }
  return manifest;
}

/** Throws before a query embedding is requested when the live source changes. */
export function assertPreparedResearchSemanticIndex(index, manifest) {
  validatePreparedResearchSemanticManifest(manifest);
  if (index?.version !== researchPassageIndexVersion || !Array.isArray(index.passages)) {
    throw failure("SEMANTIC_ARTIFACT_STALE", "Prepared semantic passage index version changed");
  }
  const scope = manifest.authorizedIndexes.find(entry => entry.fingerprint === index.fingerprint);
  const corpusIDs = new Set(index.passages.map(passage => passage.corpusID));
  if (!scope || scope.passageCount !== index.passages.length || corpusIDs.size !== scope.corpusIDs.length ||
      scope.corpusIDs.some(id => !corpusIDs.has(id))) {
    throw failure("SEMANTIC_ARTIFACT_STALE", "Prepared semantic vectors do not match the current authorized corpus");
  }
  return true;
}

/** Load only a checksum- and scope-bound asset. Caller supplies lexical fallback. */
export async function loadPreparedResearchSemanticVectors({
  vectorPath = preparedResearchSemanticVectorPath,
  manifestPath = preparedResearchSemanticManifestPath
} = {}) {
  let manifest, binary;
  try {
    manifest = validatePreparedResearchSemanticManifest(JSON.parse(await readFile(manifestPath, "utf8")));
    binary = await readFile(vectorPath);
  } catch (error) {
    if (error.code === "ENOENT") throw failure("SEMANTIC_ARTIFACT_MISSING", "Prepared semantic asset is missing");
    if (error.code?.startsWith("SEMANTIC_ARTIFACT_")) throw error;
    throw failure("SEMANTIC_ARTIFACT_INVALID", "Prepared semantic asset cannot be read");
  }
  if (binary.length !== manifest.byteLength || createHash("sha256").update(binary).digest("hex") !== manifest.sha256) {
    throw failure("SEMANTIC_ARTIFACT_CORRUPT", "Prepared semantic asset checksum changed");
  }
  let vectors;
  try { vectors = await loadResearchSemanticVectors(binary); }
  catch (error) {
    if (error.code?.startsWith("SEMANTIC_ARTIFACT_")) throw error;
    throw failure("SEMANTIC_ARTIFACT_INVALID", "Prepared semantic binary is invalid");
  }
  if (vectors.model !== manifest.model || vectors.dimensions !== manifest.dimensions ||
      vectors.embeddingTextVersion !== manifest.embeddingTextVersion || vectors.inputCount !== manifest.inputCount ||
      vectors.storageFormat !== "normalized-float32le" || vectors.indexFingerprint !== manifest.currentCorpusFingerprint) {
    throw failure("SEMANTIC_ARTIFACT_STALE", "Prepared semantic asset metadata does not match its corpus manifest");
  }
  return { vectors, manifest };
}
