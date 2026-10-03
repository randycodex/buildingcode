import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export const researchSemanticPassagesVersion = "20261002-semantic-passage-search-v1";
export const researchSemanticEmbeddingModel = "text-embedding-3-small";
export const researchSemanticEmbeddingDimensions = 256;
export const researchSemanticEmbeddingMaximumCharacters = 6200;
export const researchSemanticEmbeddingPricePerMillionTokens = 0.02;
export const researchSemanticEmbeddingTextVersion = "20261002-passage-title-context-v1";
const embeddingEndpoint = "https://api.openai.com/v1/embeddings";
const binaryMagic = Buffer.from("PTXSEM01", "ascii");
const binaryRecordBytes = 32 + researchSemanticEmbeddingDimensions * 4;
const nativeLittleEndian = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
const compact = value => String(value ?? "").replace(/\s+/g, " ").trim();
const alignedIndexes = new WeakMap();

function boundedEmbeddingText(value) {
  let text = String(value).slice(0, researchSemanticEmbeddingMaximumCharacters);
  if (/^[\uD800-\uDBFF]$/.test(text.slice(-1))) text = text.slice(0, -1);
  // UTF-8 bytes are a conservative token upper bound. This also keeps unusually
  // dense multilingual/emoji input below the provider's 8,192-token maximum.
  while (Buffer.byteLength(text, "utf8") > 8192) text = text.slice(0, Math.floor(text.length * 0.9));
  if (/^[\uD800-\uDBFF]$/.test(text.slice(-1))) text = text.slice(0, -1);
  return text;
}

/** Stable input only; returned answers must use the unchanged enacted source. */
export function researchPassageEmbeddingText(passage) {
  const values = [
    compact([passage.codePrefix, passage.codeEdition, passage.subsectionNumber || passage.sectionNumber].filter(Boolean).join(" ")),
    compact(passage.parentTitle || passage.title),
    compact(passage.passageTitle),
    compact(passage.searchText ?? passage.text)
  ].filter(Boolean);
  return boundedEmbeddingText(values.join("\n"));
}

export function researchSemanticInputHash(input) {
  return createHash("sha256").update(String(input)).digest("hex");
}

export function researchSemanticEmbeddingReservation(inputs) {
  const serialized = JSON.stringify({ model: researchSemanticEmbeddingModel, dimensions: researchSemanticEmbeddingDimensions, input: inputs, encoding_format: "float" });
  return (Buffer.byteLength(serialized, "utf8") + 8192) * researchSemanticEmbeddingPricePerMillionTokens * 1.1 / 1e6;
}

export function researchSemanticEmbeddingCost(usage) {
  if (!Number.isSafeInteger(usage?.total_tokens) || usage.total_tokens < 0) return null;
  return usage.total_tokens * researchSemanticEmbeddingPricePerMillionTokens / 1e6;
}

function normalizedVector(value) {
  if (!(Array.isArray(value) || ArrayBuffer.isView(value)) || value.length !== researchSemanticEmbeddingDimensions) {
    throw Object.assign(new Error("Invalid semantic vector dimensions"), { code: "SEMANTIC_VECTOR_INVALID" });
  }
  let norm = 0;
  for (const coordinate of value) {
    if (!Number.isFinite(coordinate)) throw Object.assign(new Error("Non-finite semantic vector"), { code: "SEMANTIC_VECTOR_INVALID" });
    norm += coordinate * coordinate;
  }
  if (!Number.isFinite(norm) || norm <= 0) throw Object.assign(new Error("Empty semantic vector"), { code: "SEMANTIC_VECTOR_INVALID" });
  const denominator = Math.sqrt(norm);
  return Float32Array.from(value, coordinate => coordinate / denominator);
}

/** Load validated hash-addressed vectors. They supply relevance, not authority. */
export async function loadResearchSemanticVectors(pathOrArtifact) {
  const source = typeof pathOrArtifact === "string" ? await readFile(pathOrArtifact) : pathOrArtifact;
  if (Buffer.isBuffer(source) && source.subarray(0, binaryMagic.length).equals(binaryMagic)) return loadBinaryVectors(source);
  const artifact = Buffer.isBuffer(source) ? JSON.parse(source.toString("utf8")) : source;
  if (artifact?.schemaVersion !== 1 || artifact.model !== researchSemanticEmbeddingModel ||
      artifact.dimensions !== researchSemanticEmbeddingDimensions || artifact.embeddingTextVersion !== researchSemanticEmbeddingTextVersion || !Array.isArray(artifact.entries)) {
    throw Object.assign(new Error("Unsupported semantic vector artifact"), { code: "SEMANTIC_ARTIFACT_INVALID" });
  }
  const vectors = new Map();
  for (const entry of artifact.entries) {
    if (!/^[a-f0-9]{64}$/.test(String(entry?.inputHash || "")) || vectors.has(entry.inputHash)) {
      throw Object.assign(new Error("Invalid or duplicate semantic input hash"), { code: "SEMANTIC_ARTIFACT_INVALID" });
    }
    vectors.set(entry.inputHash, normalizedVector(entry.embedding));
  }
  return { schemaVersion: 1, model: artifact.model, dimensions: artifact.dimensions,
    embeddingTextVersion: artifact.embeddingTextVersion, vectors, inputCount: vectors.size,
    storageFormat: "json", indexFingerprint: artifact.indexFingerprint ?? null };
}

function validateNormalizedVector(vector) {
  if (!(vector instanceof Float32Array) || vector.length !== researchSemanticEmbeddingDimensions) {
    throw Object.assign(new Error("Invalid normalized semantic vector"), { code: "SEMANTIC_ARTIFACT_INVALID" });
  }
  let norm = 0;
  for (const coordinate of vector) {
    if (!Number.isFinite(coordinate)) throw Object.assign(new Error("Non-finite semantic vector"), { code: "SEMANTIC_ARTIFACT_INVALID" });
    norm += coordinate * coordinate;
  }
  if (!Number.isFinite(norm) || Math.abs(norm - 1) > 0.00001) {
    throw Object.assign(new Error("Unnormalized semantic binary vector"), { code: "SEMANTIC_ARTIFACT_INVALID" });
  }
}

function loadBinaryVectors(buffer) {
  if (buffer.length < 12) throw Object.assign(new Error("Truncated semantic binary header"), { code: "SEMANTIC_ARTIFACT_INVALID" });
  const headerLength = buffer.readUInt32LE(8);
  if (headerLength < 1 || headerLength > 8192 || buffer.length < 12 + headerLength) {
    throw Object.assign(new Error("Invalid semantic binary header length"), { code: "SEMANTIC_ARTIFACT_INVALID" });
  }
  const header = JSON.parse(buffer.toString("utf8", 12, 12 + headerLength));
  if (header.schemaVersion !== 1 || header.model !== researchSemanticEmbeddingModel ||
      header.dimensions !== researchSemanticEmbeddingDimensions || header.embeddingTextVersion !== researchSemanticEmbeddingTextVersion ||
      header.storageFormat !== "normalized-float32le" || !Number.isSafeInteger(header.inputCount) || header.inputCount < 0 ||
      !/^[a-f0-9]{64}$/.test(String(header.payloadHash || ""))) {
    throw Object.assign(new Error("Unsupported semantic binary artifact"), { code: "SEMANTIC_ARTIFACT_INVALID" });
  }
  const dataOffset = Math.ceil((12 + headerLength) / 4) * 4;
  if (buffer.length !== dataOffset + header.inputCount * binaryRecordBytes ||
      createHash("sha256").update(buffer.subarray(dataOffset)).digest("hex") !== header.payloadHash) {
    throw Object.assign(new Error("Truncated or changed semantic binary payload"), { code: "SEMANTIC_ARTIFACT_INVALID" });
  }
  const vectors = new Map();
  for (let position = 0; position < header.inputCount; position += 1) {
    const offset = dataOffset + position * binaryRecordBytes;
    const inputHash = buffer.toString("hex", offset, offset + 32);
    if (vectors.has(inputHash)) throw Object.assign(new Error("Duplicate semantic binary input hash"), { code: "SEMANTIC_ARTIFACT_INVALID" });
    const vectorOffset = offset + 32;
    // Native little-endian hosts can use views into one immutable buffer.
    // Other hosts decode LE explicitly. Neither path normalizes again: these
    // are the exact Float32 values already used by the validated JSON loader.
    const vector = nativeLittleEndian && (buffer.byteOffset + vectorOffset) % 4 === 0
      ? new Float32Array(buffer.buffer, buffer.byteOffset + vectorOffset, researchSemanticEmbeddingDimensions)
      : Float32Array.from({ length: researchSemanticEmbeddingDimensions }, (_, index) => buffer.readFloatLE(vectorOffset + index * 4));
    validateNormalizedVector(vector);
    vectors.set(inputHash, vector);
  }
  return { schemaVersion: 1, model: header.model, dimensions: header.dimensions,
    embeddingTextVersion: header.embeddingTextVersion, vectors, inputCount: vectors.size,
    storageFormat: header.storageFormat, indexFingerprint: header.indexFingerprint ?? null };
}

/** Deterministic binary conversion; reuses existing Float32s, no quantization. */
export async function encodeResearchSemanticVectors(pathOrArtifact) {
  const loaded = pathOrArtifact?.vectors instanceof Map ? pathOrArtifact : await loadResearchSemanticVectors(pathOrArtifact);
  if (loaded.schemaVersion !== 1 || loaded.model !== researchSemanticEmbeddingModel ||
      loaded.dimensions !== researchSemanticEmbeddingDimensions || loaded.embeddingTextVersion !== researchSemanticEmbeddingTextVersion) {
    throw Object.assign(new Error("Unsupported semantic vector artifact"), { code: "SEMANTIC_ARTIFACT_INVALID" });
  }
  const entries = [...loaded.vectors.entries()].sort(([left], [right]) => left.localeCompare(right));
  const payload = Buffer.alloc(entries.length * binaryRecordBytes);
  for (const [position, [inputHash, vector]] of entries.entries()) {
    if (!/^[a-f0-9]{64}$/.test(inputHash)) throw Object.assign(new Error("Invalid semantic input hash"), { code: "SEMANTIC_ARTIFACT_INVALID" });
    validateNormalizedVector(vector);
    const offset = position * binaryRecordBytes;
    Buffer.from(inputHash, "hex").copy(payload, offset);
    for (let index = 0; index < vector.length; index += 1) payload.writeFloatLE(vector[index], offset + 32 + index * 4);
  }
  const header = Buffer.from(JSON.stringify({ schemaVersion: 1, model: loaded.model, dimensions: loaded.dimensions,
    embeddingTextVersion: loaded.embeddingTextVersion, storageFormat: "normalized-float32le", inputCount: entries.length,
    indexFingerprint: loaded.indexFingerprint ?? null, payloadHash: createHash("sha256").update(payload).digest("hex") }), "utf8");
  const output = Buffer.alloc(Math.ceil((12 + header.length) / 4) * 4 + payload.length);
  binaryMagic.copy(output); output.writeUInt32LE(header.length, 8); header.copy(output, 12);
  payload.copy(output, Math.ceil((12 + header.length) / 4) * 4);
  return output;
}

function alignedPassages(index, loadedVectors) {
  const vectors = loadedVectors?.vectors instanceof Map ? loadedVectors.vectors : loadedVectors;
  if (!(vectors instanceof Map) || !Array.isArray(index?.passages)) throw new TypeError("Live passage index and validated vectors are required.");
  const previous = alignedIndexes.get(index);
  if (previous?.vectors === vectors) return previous.passages;
  const passages = [];
  // A prepared artifact may cover the whole current library. Alignment only
  // walks the caller's authorized live index, so historical/other-code vectors
  // never nominate sources excluded by project edition or explicit scope.
  for (const passage of index.passages) {
    const inputHash = researchSemanticInputHash(researchPassageEmbeddingText(passage));
    const vector = vectors.get(inputHash);
    if (vector) passages.push({ passage, inputHash, vector });
  }
  alignedIndexes.set(index, { vectors, passages });
  return passages;
}

export function searchResearchSemanticPassages(index, vectors, queryVector, options = {}) {
  const query = normalizedVector(queryVector);
  const limit = Math.max(1, Math.min(200, Number(options.limit) || 60));
  const perSection = Math.max(1, Math.min(8, Number(options.passagesPerSection) || 3));
  const minimum = Number.isFinite(options.minimumSimilarity) ? options.minimumSimilarity : 0;
  const grouped = new Map();
  for (const { passage, vector, inputHash } of alignedPassages(index, vectors)) {
    let similarity = 0;
    for (let position = 0; position < query.length; position += 1) similarity += query[position] * vector[position];
    if (!Number.isFinite(similarity) || similarity <= minimum) continue;
    const hit = { ...passage, similarity, score: similarity, semanticInputHash: inputHash,
      exactReference: false, matchedTerms: [], retrievalMethod: "semantic_passage" };
    if (!grouped.has(passage.sectionID)) grouped.set(passage.sectionID, []);
    grouped.get(passage.sectionID).push(hit);
  }
  return [...grouped.values()].map(hits => {
    hits.sort((left, right) => right.similarity - left.similarity || left.id.localeCompare(right.id));
    const passages = [];
    const seen = new Set();
    for (const hit of hits) {
      const key = `${hit.blockID}:${hit.sourceOffsets?.start}:${hit.sourceOffsets?.end}`;
      if (seen.has(key)) continue;
      seen.add(key); passages.push(hit);
      if (passages.length >= perSection) break;
    }
    return { ...hits[0], passages };
  }).sort((left, right) => right.similarity - left.similarity || left.id.localeCompare(right.id)).slice(0, limit);
}

/** Explicitly gated embeddings request; caller owns paid-request accounting. */
export async function requestResearchEmbeddings(inputs, {
  enabled = false, apiKey, fetchImpl = globalThis.fetch, timeoutMS = 8000,
  beforeRequest, afterRequest
} = {}) {
  if (enabled !== true || !apiKey) throw Object.assign(new Error("Semantic provider is disabled or has no key"), { code: "SEMANTIC_PROVIDER_DISABLED" });
  if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 128 || inputs.some(input => typeof input !== "string" || !input.trim() || input.length > researchSemanticEmbeddingMaximumCharacters || Buffer.byteLength(input, "utf8") > 8192)) {
    throw Object.assign(new Error("Invalid embedding inputs"), { code: "SEMANTIC_INPUT_INVALID" });
  }
  const body = { model: researchSemanticEmbeddingModel, dimensions: researchSemanticEmbeddingDimensions, input: inputs, encoding_format: "float" };
  await beforeRequest?.({ body, reservedUSD: researchSemanticEmbeddingReservation(inputs) });
  let delivered = false;
  try {
    const response = await fetchImpl(embeddingEndpoint, {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body), signal: AbortSignal.timeout(Math.max(1, Math.min(60000, Number(timeoutMS) || 8000)))
    });
    const payload = await response.json();
    const costUSD = researchSemanticEmbeddingCost(payload.usage);
    const accounting = { status: costUSD != null ? "settled" : response.ok ? "unknown" : "rejected", costUSD: costUSD ?? (response.ok ? null : 0),
      usage: payload.usage || null, responseStatus: response.status, requestID: response.headers?.get?.("x-request-id") || null };
    await afterRequest?.(accounting);
    delivered = true;
    if (!response.ok) throw Object.assign(new Error("Embedding provider rejected request"), { code: "SEMANTIC_PROVIDER_REJECTED", accounting });
    if (accounting.status === "unknown" || payload.model !== researchSemanticEmbeddingModel || !Array.isArray(payload.data) || payload.data.length !== inputs.length) {
      throw Object.assign(new Error("Invalid embedding provider response"), { code: "SEMANTIC_RESPONSE_INVALID", accounting });
    }
    const vectors = new Array(inputs.length);
    for (const item of payload.data) {
      if (!Number.isSafeInteger(item.index) || item.index < 0 || item.index >= inputs.length || vectors[item.index]) {
        throw Object.assign(new Error("Invalid embedding response index"), { code: "SEMANTIC_RESPONSE_INVALID", accounting });
      }
      normalizedVector(item.embedding);
      vectors[item.index] = item.embedding;
    }
    if (vectors.some(vector => !vector)) throw Object.assign(new Error("Incomplete embedding response"), { code: "SEMANTIC_RESPONSE_INVALID", accounting });
    return { vectors, usage: payload.usage, costUSD, requestID: accounting.requestID };
  } catch (error) {
    if (!delivered) await afterRequest?.({ status: "unknown", costUSD: null, usage: null, error: error.code || error.name });
    throw error;
  }
}

/** Bounded query-vector cache; failures leave lexical search usable. */
export function createResearchSemanticSearch({
  vectors, enabled = false, apiKey, fetchImpl = globalThis.fetch, timeoutMS = 8000,
  cacheLimit = 128, beforeRequest, afterRequest
} = {}) {
  const cache = new Map();
  const maximum = Math.max(1, Math.min(2048, Number(cacheLimit) || 128));
  let providerQueue = Promise.resolve();
  return {
    get cacheSize() { return cache.size; },
    async search(index, question, options = {}) {
      const started = performance.now();
      const metadata = { version: researchSemanticPassagesVersion, enabled: enabled === true, model: researchSemanticEmbeddingModel, dimensions: researchSemanticEmbeddingDimensions,
        queryCached: false, fallbackReason: null, elapsedMS: 0, costUSD: 0 };
      const fallback = reason => ({ hits: [], metadata: { ...metadata, fallbackReason: reason, elapsedMS: Math.round(performance.now() - started) } });
      if (enabled !== true) return fallback("semantic_search_disabled");
      if (!apiKey) return fallback("semantic_key_missing");
      if (!vectors) return fallback("semantic_vectors_missing");
      const queryText = boundedEmbeddingText(compact(question));
      if (!queryText) return fallback("semantic_query_empty");
      try {
        const aligned = alignedPassages(index, vectors);
        metadata.coveredPassages = aligned.length;
        metadata.totalPassages = index.passages.length;
        if (!aligned.length) return fallback("semantic_vectors_outdated_or_out_of_scope");
        const hash = researchSemanticInputHash(queryText);
        const cached = cache.get(hash);
        let queryVector;
        if (cached) {
          cache.delete(hash); cache.set(hash, cached);
          metadata.queryCached = true;
          queryVector = await cached;
        } else {
          // Serialize provider queries even when callers arrive concurrently.
          // Evaluation-ledger hooks can block spending on an unknown outcome.
          const task = providerQueue.catch(() => {}).then(async () => {
            const result = await requestResearchEmbeddings([queryText], { enabled, apiKey, fetchImpl, timeoutMS, beforeRequest, afterRequest });
            metadata.costUSD = result.costUSD;
            metadata.usage = result.usage;
            return result.vectors[0];
          });
          providerQueue = task;
          cache.set(hash, task);
          while (cache.size > maximum) cache.delete(cache.keys().next().value);
          try { queryVector = await task; } catch (error) { if (cache.get(hash) === task) cache.delete(hash); throw error; }
        }
        const hits = searchResearchSemanticPassages(index, vectors, queryVector, options);
        return { hits, metadata: { ...metadata, elapsedMS: Math.round(performance.now() - started) } };
      } catch (error) {
        return fallback(["TimeoutError", "AbortError"].includes(error.name) ? "semantic_provider_timeout" : error.code || "semantic_provider_error");
      }
    }
  };
}
