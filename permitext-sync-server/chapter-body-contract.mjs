import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { codeAssetRevision } from "./code-asset-manifest.mjs";

// Literal URL reads let the deployment file tracer include every revision manifest.
// Keep injected roots available for isolated contract tests.
const bundledAuthoredRoot = fileURLToPath(new URL("../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/", import.meta.url));
const bundledRevisionLoaders = {
  "2022-construction-codes": () => readFile(new URL("../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2022-construction-codes/prepared/searchTextManifest.json", import.meta.url), "utf8"),
  "2014-construction-codes": () => readFile(new URL("../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2014-construction-codes/prepared/searchTextManifest.json", import.meta.url), "utf8"),
  "2026-zoning-resolution": () => readFile(new URL("../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-zoning-resolution/prepared/searchTextManifest.json", import.meta.url), "utf8"),
  "2026-existing-building-code": () => readFile(new URL("../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-existing-building-code/prepared/searchTextManifest.json", import.meta.url), "utf8"),
  "2026-enacted-administrative-code": () => readFile(new URL("../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/prepared/searchTextManifest.json", import.meta.url), "utf8"),
  "2025-specialty-codes": () => readFile(new URL("../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2025-specialty-codes/prepared/searchTextManifest.json", import.meta.url), "utf8"),
};

// Generated sourceRevision hashes the bundle, all prepared JSON, and both HTML
// source trees. It therefore changes for rich-body edits, not just search text.
const sourceRevisions = new Map();
let publicRevisionPromise;

// All bundled source families participate, including changes outside a user's
// current edition. Version the response contract when its projection changes.
export function publicCodeCorpusRevision() {
  if (!publicRevisionPromise) {
    publicRevisionPromise = Promise.all(Object.keys(bundledRevisionLoaders).sort().map(async family => [
      family, await sourceRevision(bundledAuthoredRoot, `CodeContent/authored/new-york-city/${family}/bundle.json#1`)
    ])).then(async sources => createHash("sha256").update(JSON.stringify({ publicResponseContract: 1, sources, assetRevision: await codeAssetRevision() })).digest("hex"))
      .catch(error => { publicRevisionPromise = null; throw error; });
  }
  return publicRevisionPromise;
}

async function sourceRevision(authoredRoot, codeVersion) {
  const match = /^CodeContent\/authored\/new-york-city\/([a-z0-9-]+)\/bundle\.json#\d+$/.exec(codeVersion);
  if (!match) throw new Error("Invalid chapter edition identity");
  const path = join(authoredRoot, match[1], "prepared", "searchTextManifest.json");
  if (!sourceRevisions.has(path)) {
    const bundledLoader = resolve(authoredRoot) === resolve(bundledAuthoredRoot)
      ? bundledRevisionLoaders[match[1]]
      : null;
    const pending = (bundledLoader ? bundledLoader() : readFile(path, "utf8")).then((text) => {
      const revision = JSON.parse(text).sourceRevision;
      if (!/^[a-f0-9]{64}$/.test(revision || "")) throw new Error("Missing chapter source revision");
      return revision;
    }).catch((error) => { sourceRevisions.delete(path); throw error; });
    sourceRevisions.set(path, pending);
  }
  return sourceRevisions.get(path);
}

export async function chapterBodyContractResponse(chapter, { enabled, compactWindow = false, defaultCodeVersion, authoredRoot }) {
  if (!enabled) return chapter;
  const codeVersion = chapter.codeVersion || defaultCodeVersion;
  const source = await sourceRevision(authoredRoot, codeVersion);
  // The ordered section manifest is part of the identity: navigation projection,
  // aliases, or canonical-ID changes must invalidate previously indexed windows.
  const { bodyRange, sections = [], ...metadata } = chapter;
  const summaries = sections.map(({ blocks, ...section }) => section);
  const corpusRevision = createHash("sha256").update(JSON.stringify({
    contract: 2, source, metadata, sections: summaries
  })).digest("hex");
  const identity = { bodyContract: 2, id: chapter.id, codePrefix: chapter.codePrefix, codeVersion, corpusRevision };
  if (!bodyRange || !compactWindow) return { ...chapter, ...identity };
  return {
    ...identity,
    bodyRange,
    sections: sections.slice(bodyRange.start, bodyRange.end).map((section) => ({
      id: section.id,
      blocks: section.blocks || []
    }))
  };
}
