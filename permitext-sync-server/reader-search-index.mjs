import { readFile } from "node:fs/promises";
import { gunzip } from "node:zlib";
import { promisify } from "node:util";
const decompressIndex = promisify(gunzip);
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { searchReaderTextSections } from "./public/reader-search-match.js";

// Keep the bundled directory literal so deployment tracing can discover indexes.
const bundledRoot = fileURLToPath(new URL("./generated/reader-search/", import.meta.url));
const safeChapterID = /^[A-Za-z0-9_-]+$/;

export class ReaderSearchIndexError extends Error {
  constructor(code, message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = "ReaderSearchIndexError";
    this.code = code;
  }
}

function invalid(message) {
  throw new ReaderSearchIndexError("READER_SEARCH_INDEX_INVALID", message);
}

function validate(index, chapter) {
  if (!index || index.schemaVersion !== 1 || !Array.isArray(index.sections)
      || typeof index.projectionRevision !== "string" || !/^[a-f0-9]{64}$/.test(index.projectionRevision)) {
    invalid("Invalid Reader search index schema");
  }
  if (String(index.chapterID) !== String(chapter.id) || index.codeVersion !== chapter.codeVersion
      || index.corpusRevision !== chapter.corpusRevision) {
    throw new ReaderSearchIndexError("READER_SEARCH_INDEX_STALE", "Reader search index does not match the chapter revision");
  }
  if (index.sections.length !== chapter.sections.length) invalid("Incomplete Reader search index");
  for (let i = 0; i < index.sections.length; i += 1) {
    const section = index.sections[i];
    if (!section || section.id !== chapter.sections[i].id
        || typeof section.sectionNumber !== "string" || typeof section.title !== "string"
        || typeof section.displayTitle !== "string" || !Array.isArray(section.blocks)) {
      invalid("Invalid Reader search section identity or order");
    }
    for (const block of section.blocks) {
      if (!block || typeof block.blockID !== "string" || !block.blockID.trim() || typeof block.text !== "string") {
        invalid("Invalid Reader search paragraph");
      }
    }
  }
}

/** Independent instances allow isolated tests without changing the bundled cache. */
export function createReaderSearchIndex({ maxEntries = 8, maxBytes = 16 * 1024 * 1024, readIndex = readFile } = {}) {
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 0 || !Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new TypeError("Reader search cache limits must be nonnegative integers");
  }
  const cache = new Map();
  const inflight = new Map();
  let bytes = 0;
  function remove(key) {
    const entry = cache.get(key);
    if (entry) bytes -= entry.bytes;
    cache.delete(key);
  }
  async function load(path) {
    const cached = cache.get(path);
    if (cached) {
      cache.delete(path);
      cache.set(path, cached);
      return cached.index;
    }
    if (inflight.has(path)) return inflight.get(path);
    const pending = (async () => {
      let compressed;
      try { compressed = await readIndex(path); }
      catch (error) {
        throw new ReaderSearchIndexError(error.code === "ENOENT" ? "READER_SEARCH_INDEX_MISSING" : "READER_SEARCH_INDEX_UNAVAILABLE", "Reader search index could not be loaded", error);
      }
      let text, index;
      try { text = (await decompressIndex(compressed)).toString("utf8"); index = JSON.parse(text); }
      catch (error) { throw new ReaderSearchIndexError("READER_SEARCH_INDEX_INVALID", "Reader search index is not valid compressed JSON", error); }
      // Account for both UTF-16 strings and object overhead conservatively.
      const estimatedBytes = Buffer.byteLength(text, "utf8") * 4;
      if (maxEntries > 0 && estimatedBytes <= maxBytes) {
        while (cache.size >= maxEntries || bytes + estimatedBytes > maxBytes) remove(cache.keys().next().value);
        cache.set(path, { index, bytes: estimatedBytes });
        bytes += estimatedBytes;
      }
      return index;
    })();
    inflight.set(path, pending);
    try { return await pending; }
    catch (error) { remove(path); throw error; }
    finally { inflight.delete(path); }
  }
  return {
    async searchIndexedReaderChapter(chapter, query, { root = bundledRoot } = {}) {
      if (!chapter || !["string", "number"].includes(typeof chapter.id) || !safeChapterID.test(String(chapter.id))
          || typeof chapter.codeVersion !== "string" || !chapter.codeVersion
          || typeof chapter.corpusRevision !== "string" || !chapter.corpusRevision
          || !Array.isArray(chapter.sections)) invalid("Invalid current Reader chapter manifest");
      if (typeof query !== "string") invalid("Invalid Reader search query");
      const path = join(resolve(root instanceof URL ? fileURLToPath(root) : root), `${chapter.id}.json.gz`);
      const index = await load(path);
      try { validate(index, chapter); }
      catch (error) { remove(path); throw error; }
      const normalizedQuery = query.trim();
      const results = searchReaderTextSections(index.sections, normalizedQuery);
      return {
        chapterID: chapter.id, codeVersion: chapter.codeVersion,
        corpusRevision: chapter.corpusRevision, query: normalizedQuery,
        total: results.length, results
      };
    },
    cacheStats() { return { entries: cache.size, estimatedBytes: bytes, inflight: inflight.size }; }
  };
}

const bundledIndex = createReaderSearchIndex();
export const searchIndexedReaderChapter = bundledIndex.searchIndexedReaderChapter;
