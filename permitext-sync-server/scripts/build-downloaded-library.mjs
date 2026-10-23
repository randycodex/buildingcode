// Public, content-addressed search packages derived from the same prepared
// catalog/text/postings as online Search. No account or project data is read.
import {
  readFile,
  readdir,
  mkdir,
  writeFile,
  rename,
  rm,
} from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { deserialize } from "node:v8";
import { publicCodeCorpusRevision } from "../chapter-body-contract.mjs";
import { codeAssetRevision } from "../code-asset-manifest.mjs";
import { defaultSyncCodeVersion } from "../public/sync-identity.js";

import { searchVocabulary } from "../public/search-relevance.js";

const source = new URL("../generated/search-catalogs/", import.meta.url);
const output = new URL("../public/downloaded-library/", import.meta.url);
const staging = new URL(
  `../public/.library-build-${process.pid}/`,
  import.meta.url,
);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const parts = [];
await mkdir(staging, { recursive: true });
try {
  const [textIndex, text] = await Promise.all([
    readFile(new URL("search-text.json", source), "utf8").then(JSON.parse),
    readFile(new URL("search-text.utf8", source)),
  ]);
  async function part(kind, records) {
    const bytes = Buffer.from(JSON.stringify(records));
    const sha256 = hash(bytes),
      name = `${kind}-${sha256}.json`;
    await writeFile(new URL(name, staging), bytes);
    parts.push({
      kind,
      path: `/web/downloaded-library/${name}`,
      sha256,
      bytes: bytes.length,
      count: records.length,
    });
  }
  async function chunks(kind, records) {
    let batch = [],
      size = 0;
    for (const record of records) {
      const bytes = Buffer.byteLength(JSON.stringify(record));
      if (size + bytes > 512 * 1024 && batch.length) {
        await part(kind, batch);
        batch = [];
        size = 0;
      }
      batch.push(record);
      size += bytes;
    }
    if (batch.length) await part(kind, batch);
  }
  // Merge aliases/families before partitioning so a term has exactly one record.
  const postings = new Map();
  for (const family of [
    "construction",
    "historical2014",
    "zoning",
    "enacted",
    "existingBuilding",
  ]) {
    const catalog = JSON.parse(
      await readFile(new URL(`${family}.json`, source), "utf8"),
    );
    await chunks(
      "documents",
      catalog.sections.map((section) => {
        const key = `${section.codeVersion || ""}:${section.codePrefix}:${section.webSectionID || section.id}`;
        const range = textIndex.records[key];
        if (!range) throw Error(`Missing exact search text: ${key}`);
        return {
          ...section,
          codeVersion: section.codeVersion || defaultSyncCodeVersion,
          plainText: text
            .subarray(range[0], range[0] + range[1])
            .toString("utf8"),
        };
      }),
    );
    const groups = new Map();
    for (const section of catalog.sections) {
      const codeVersion = section.codeVersion || defaultSyncCodeVersion;
      const id = `vocabulary:${codeVersion}:${section.codePrefix}:${section.codeSectionID}`;
      if (!groups.has(id))
        groups.set(id, {
          id,
          codeVersion,
          codePrefix: section.codePrefix,
          codeSectionID: section.codeSectionID,
          sections: [],
        });
      groups.get(id).sections.push(section);
    }
    await chunks(
      "documents",
      [...groups.values()].map(({ sections, ...metadata }) => ({
        ...metadata,
        terms: [...searchVocabulary(sections)],
      })),
    );
    const runtime = deserialize(
      await readFile(new URL(`${family}.runtime`, source)),
    );
    const bytes = await readFile(new URL(`${family}.postings`, source));
    const words = new Uint32Array(
      bytes.buffer,
      bytes.byteOffset,
      bytes.length / 4,
    );
    let begin = 0;
    for (const [tokens, ends] of [
      [runtime.tokens, runtime.ends],
      [runtime.aliasTokens, runtime.aliasEnds],
    ]) {
      for (let i = 0; i < tokens.length; i++) {
        if (!postings.has(tokens[i])) postings.set(tokens[i], new Set());
        const target = postings.get(tokens[i]);
        for (const id of words.subarray(begin, ends[i])) target.add(id);
        begin = ends[i];
      }
    }
  }
  await chunks(
    "postings",
    [...postings]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([word, ids]) => [word, [...ids].sort((a, b) => a - b)]),
  );
  // Retain the exact Reader projection, including paragraph target IDs. It is
  // compressed on disk and decoded one chapter at a time for Find.
  const readerDirectory = new URL(
    "../generated/reader-search/",
    import.meta.url,
  );
  for (const file of (await readdir(readerDirectory))
    .filter((n) => n.endsWith(".json.gz"))
    .sort()) {
    const bytes = await readFile(new URL(file, readerDirectory));
    const reader = JSON.parse(gunzipSync(bytes));
    if (
      reader.schemaVersion !== 1 ||
      !reader.corpusRevision ||
      !Array.isArray(reader.sections)
    )
      throw Error("Invalid Reader index");
    const sha256 = hash(bytes),
      name = `reader-index-${sha256}.gz`;
    await writeFile(new URL(name, staging), bytes);
    parts.push({
      kind: "reader-index",
      chapterID: String(reader.chapterID),
      corpusRevision: reader.corpusRevision,
      path: `/web/downloaded-library/${name}`,
      sha256,
      bytes: bytes.length,
      count: reader.sections.length,
    });
  }
  const manifest = {
    schemaVersion: 1,
    searchContract: 2,
    corpusRevision: await publicCodeCorpusRevision(),
    assetRevision: await codeAssetRevision(),
    parts,
    searchBytes: parts.reduce((sum, p) => sum + p.bytes, 0),
    // Includes rich bodies, figures, indexes and browser overhead. Updates need
    // another complete generation until the atomic activation succeeds.
    estimatedStorageBytes: 400 * 1024 * 1024,
  };
  manifest.indexRevision = hash(Buffer.from(JSON.stringify(manifest)));
  await writeFile(new URL("manifest.json", staging), JSON.stringify(manifest));
  await rm(output, { recursive: true, force: true });
  await rename(staging, output);
  console.log(
    `Downloaded library: ${parts.length} verified parts, ${manifest.searchBytes} search bytes, ${manifest.indexRevision}`,
  );
} finally {
  await rm(staging, { recursive: true, force: true });
}
