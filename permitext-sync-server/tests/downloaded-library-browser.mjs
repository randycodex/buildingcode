// Real worker, IndexedDB, CacheStorage and Web Locks in an isolated Chrome
// profile. Only synthetic public text is installed; no live account is used.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import {
  defaultSyncCodeVersion,
  historicalConstructionSyncCodeVersion,
} from "../public/sync-identity.js";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const root = new URL("../public/", import.meta.url);
let revision = "a",
  badPart = false,
  failFigure = false,
  hold = false,
  finalDrift = false;
const counts = new Map(),
  asset = Buffer.from("synthetic figure");
const sources = [
  defaultSyncCodeVersion,
  historicalConstructionSyncCodeVersion,
].map((canonicalEdition, i) => ({
  canonicalEdition,
  jurisdictionID: 1,
  codeID: 1,
  categoryID: 1,
  codePrefix: "BC",
  categoryLabel: "Building Code",
  editionLabel: i ? "2014" : "2022",
}));
const libraries = {
  codeSources: sources,
  libraries: [
    {
      id: "nyc-2022-construction-codes",
      syncCodeVersion: defaultSyncCodeVersion,
    },
    {
      id: "nyc-2014-construction-codes",
      syncCodeVersion: historicalConstructionSyncCodeVersion,
    },
  ],
};
function chapters() {
  return [1, 2].map((id, index) => ({
    id,
    codePrefix: "BC",
    codeVersion: sources[index].canonicalEdition,
    codeSectionID: 1,
    chapterNumber: "1",
    bodyContract: 2,
    corpusRevision: revision.repeat(64),
    assetRevision: revision.repeat(64),
    sections: Array.from({ length: index ? 1 : 30 }, (_, n) => ({
      id: index ? 41000001 : n + 1,
      sectionNumber: `101.${n + 1}`,
      title: "Water supply",
      blocks: [
        {
          id: `block-${n}`,
          plainText: `${revision} Water supply rules ${n}`,
          ...(n === 0
            ? { imageID: "fixture.png", assetRevision: revision.repeat(64) }
            : {}),
        },
      ],
    })),
  }));
}
function packageData() {
  const documents = chapters().flatMap((chapter) =>
    chapter.sections.map(({ blocks, ...s }) => ({
      ...s,
      chapterID: chapter.id,
      chapterNumber: chapter.chapterNumber,
      codePrefix: "BC",
      codeVersion: chapter.codeVersion,
      codeSectionID: 1,
      plainText: blocks.map((b) => b.plainText).join("\n"),
    })),
  );
  const postings = ["water", "supply", "rules"].map((word) => [
    word,
    documents.map((s) => s.id).sort((a, b) => a - b),
  ]);
  const parts = [
    ["documents", documents],
    ["postings", postings],
  ].map(([kind, value]) => {
    const bytes = Buffer.from(JSON.stringify(value)),
      sha256 = hash(bytes);
    return {
      kind,
      value,
      bytes,
      descriptor: {
        kind,
        path: `/web/downloaded-library/${kind}-${sha256}.json`,
        sha256,
        bytes: bytes.length,
        count: value.length,
      },
    };
  });
  for (const chapter of chapters()) {
    const bytes = gzipSync(
      JSON.stringify({
        schemaVersion: 1,
        chapterID: chapter.id,
        codeVersion: chapter.codeVersion,
        corpusRevision: chapter.corpusRevision,
        sections: chapter.sections.map((s) => ({
          ...s,
          displayTitle: s.sectionNumber + " " + s.title,
          blocks: s.blocks.map((b) => ({ blockID: b.id, text: b.plainText })),
        })),
      }),
    );
    const sha256 = hash(bytes);
    parts.push({
      bytes,
      descriptor: {
        kind: "reader-index",
        chapterID: String(chapter.id),
        corpusRevision: chapter.corpusRevision,
        path: `/web/downloaded-library/reader-index-${sha256}.gz`,
        sha256,
        bytes: bytes.length,
        count: chapter.sections.length,
      },
    });
  }
  const manifest = {
    schemaVersion: 1,
    searchContract: 2,
    corpusRevision: revision.repeat(64),
    assetRevision: revision.repeat(64),
    parts: parts.map((p) => p.descriptor),
    estimatedStorageBytes: 1024,
  };
  manifest.indexRevision = hash(Buffer.from(JSON.stringify(manifest)));
  return { manifest, parts };
}
async function browserRun() {
  const library = await import("/web/downloaded-library.js?v=6");
  const check = (yes, label) => {
    if (!yes) throw Error(label);
  };
  const api = (path, options) =>
    library.readDownloadedLibrary(path, { force: true, ...options });
  const control = async (value) =>
    (
      await fetch("/control", { method: "POST", body: JSON.stringify(value) })
    ).json();
  const checkRead = async (letter) => {
    const response = await api("/code/sections/1");
    if (!response) {
      const w = new Worker("/web/downloaded-library-worker.js?v=6", {
        type: "module",
      });
      const diagnostic = await new Promise((resolve) => {
        w.onmessage = ({ data }) => resolve(data);
        w.postMessage({
          id: 88,
          action: "read",
          path: "/code/sections/1",
          offline: true,
        });
      });
      w.terminate();
      throw Error("Direct reader diagnostic: " + JSON.stringify(diagnostic));
    }
    check(
      response.payload.section.blocks[0].plainText.startsWith(letter),
      `complete ${letter} source`,
    );
  };
  const results = [];
  const stage = sessionStorage.getItem("stage");
  if (!stage) {
    await library.downloadLocalLibrary({
      onProgress(p) {
        if (p.phase === "Downloading codes" && p.completed === 1) {
          sessionStorage.setItem("stage", "resume");
          location.reload();
        }
      },
    });
    return;
  }
  const beforeResume = await control({});
  const interrupted = await library.downloadedLibraryStatus();
  check(
    interrupted.pending?.completed === 1,
    "checkpoint survives reload: " + JSON.stringify(interrupted),
  );
  await library.downloadLocalLibrary();
  const afterResume = await control({});
  check(
    afterResume.counts["a:1:manifest"] === beforeResume.counts["a:1:manifest"],
    "completed chapter not downloaded again",
  );
  results.push(
    "reload interruption resumes without redownloading completed chapters",
  );
  await checkRead("a");
  const original = await library.downloadedLibraryStatus();
  check(
    original.available && !original.pending,
    "only complete install is active",
  );
  check(
    library.usesDownloadedLibrary(),
    "download enables optional local transport",
  );
  library.useDownloadedLibrary(false);
  check(
    (await library.readDownloadedLibrary("/code/sections/1")) === null,
    "online preference opt-out",
  );
  await checkRead("a");
  library.useDownloadedLibrary(true);
  const cancel = new AbortController();
  cancel.abort();
  let aborted = false;
  try {
    await library.readDownloadedLibrary("/code/search?q=water", {
      signal: cancel.signal,
    });
  } catch {
    aborted = true;
  }
  check(aborted, "aborted requests do not deliver stale results");
  const chapter = (
    await api("/code/chapters/1?include=body&bodyLimit=25&bodyStart=25")
  ).payload.chapter;
  check(
    chapter.sections.length === 5 && chapter.bodyRange.start === 25,
    "bounded chapter window",
  );
  const historical = (
    await api(
      "/code/chapters?" +
        new URLSearchParams({
          version:
            "CodeContent/authored/new-york-city/2014-construction-codes/bundle.json#1",
        }),
    )
  ).payload.chapters;
  check(
    historical.length === 1 && historical[0].id === 2,
    "historical edition chooser isolation",
  );
  const search = (
    await api(
      "/code/search?q=water+supply&version=all&match=words&grouped=true",
    )
  ).payload;
  check(
    search.totalResults === 31 && search.groups.length === 2,
    "canonical indexed grouped search",
  );
  const completePage = (
    await api("/code/search?q=water+supply&version=all&match=words&limit=250")
  ).payload;
  const cachedPage = (
    await api(
      "/code/search?q=water+supply&version=all&match=words&limit=2&offset=2",
    )
  ).payload;
  check(
    JSON.stringify(cachedPage.results.map((r) => r.id)) ===
      JSON.stringify(completePage.results.slice(2, 4).map((r) => r.id)),
    "cached matching preserves independent page offsets",
  );
  const defaultResults = (await api("/code/search?q=water+supply&match=words"))
    .payload;
  check(
    defaultResults.totalResults === 30,
    "default search excludes historical Construction",
  );
  const emptyScope = encodeURIComponent(
    JSON.stringify({ version: 1, enabledSources: [] }),
  );
  check(
    (await api("/code/search?q=water&sourceScope=" + emptyScope)).payload
      .results.length === 0,
    "all sources disabled",
  );
  const historicalResults = (
    await api(
      "/code/search?" +
        new URLSearchParams({
          q: "water",
          match: "words",
          version:
            "CodeContent/authored/new-york-city/2014-construction-codes/bundle.json#1",
        }),
    )
  ).payload;
  check(
    historicalResults.results.length === 1 &&
      historicalResults.results[0].id === 41000001,
    "restricted edition reads only its indexed sources",
  );
  const find = (await api("/code/chapters/1?readerSearch=water")).payload
    .readerSearch;
  check(
    find.total === 30 && find.results[0].blockID === "block-0",
    "Reader Find works across complete stored text",
  );
  results.push(
    "indexed search, reader windows, historical editions, Find, cancellation and opt-out",
  );
  await control({ revision: "b", badPart: true });
  check(
    (await library.checkDownloadedLibraryUpdate()).updateAvailable,
    "updates detected",
  );
  let failed = false;
  try {
    await library.downloadLocalLibrary();
  } catch {
    failed = true;
  }
  check(failed, "corrupt index rejected");
  await checkRead("a");
  check(
    (await library.downloadedLibraryStatus()).generation ===
      original.generation,
    "failed update retains active generation",
  );
  check(
    (await library.readDownloadedLibrary(
      "/code/sections/1?expectedPublicCorpusRevision=" + "b".repeat(64),
    )) === null,
    "old download cannot impersonate server revision",
  );
  results.push(
    "hash failure preserves complete prior library and rejects revision mismatch",
  );
  const checkpoint = await control({ badPart: false, failFigure: true });
  failed = false;
  try {
    await library.downloadLocalLibrary();
  } catch {
    failed = true;
  }
  check(failed, "figure failure blocks activation");
  await checkRead("a");
  await control({ failFigure: false });
  await library.downloadLocalLibrary();
  await checkRead("b");
  const afterUpdate = await control({});
  check(
    afterUpdate.counts["b:1:manifest"] === checkpoint.counts["b:1:manifest"],
    "update resumes completed chapters",
  );
  check(
    !(await library.downloadedLibraryStatus()).pending,
    "successful update clears checkpoint",
  );
  check(
    await (
      await caches.open("permitext-pro-code-assets-revision-" + "a".repeat(64))
    ).match("/code/assets/fixture.png?assetRevision=" + "a".repeat(64)),
    "old figure remains available",
  );
  results.push(
    "figure failure preserves prior library; resumed update activates atomically",
  );
  await control({ revision: "c", finalDrift: true });
  failed = false;
  try {
    await library.downloadLocalLibrary();
  } catch {
    failed = true;
  }
  check(failed, "deployment changed before activation");
  await checkRead("b");
  await control({ finalDrift: false });
  await library.downloadLocalLibrary();
  await checkRead("c");
  const figureCaches = (await caches.keys()).filter((n) =>
    n.startsWith("permitext-pro-code-assets-revision-"),
  );
  check(
    figureCaches.length === 2,
    "old figure revisions are bounded to current and previous",
  );
  const openLibrary = indexedDB.open("permitext-downloaded-library-v1");
  const libraryDB = await new Promise(
    (resolve) => (openLibrary.onsuccess = () => resolve(openLibrary.result)),
  );
  for (const name of [
    "chapters",
    "sections",
    "documents",
    "postings",
    "reader-index",
  ]) {
    const generations = new Set(),
      cursor = libraryDB
        .transaction(name)
        .objectStore(name)
        .index("generation")
        .openKeyCursor(null, "nextunique");
    await new Promise((resolve, reject) => {
      cursor.onerror = () => reject(cursor.error);
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (!c) return resolve();
        generations.add(c.key);
        c.continue();
      };
    });
    check(generations.size === 1, "retired generation collected: " + name);
  }
  libraryDB.close();
  results.push(
    "deployment drift blocks activation; retired generations and figure revisions stay bounded",
  );
  await control({ revision: "d", hold: true });
  const pause = new AbortController();
  const installing = library
    .downloadLocalLibrary({ signal: pause.signal })
    .catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 250));
  const other = new Worker("/web/downloaded-library-worker.js?v=6", {
    type: "module",
  });
  const busy = await new Promise((resolve) => {
    other.onmessage = ({ data }) => {
      if (data.error) resolve(data.error);
    };
    other.postMessage({ id: 1, action: "install" });
  });
  check(busy.includes("another tab"), "concurrent writers excluded");
  other.terminate();
  pause.abort();
  await installing;
  await control({ hold: false });
  await new Promise((resolve) => setTimeout(resolve, 100));
  await checkRead("c");
  results.push(
    "concurrent worker exclusion and paused update preserve active readers",
  );
  await control({ revision: "e" });
  const quotaWorker = new Worker("/quota-worker.js", { type: "module" });
  const quotaError = await new Promise((resolve) => {
    quotaWorker.onmessage = ({ data }) => {
      if (data.ready) quotaWorker.postMessage({ id: 77, action: "install" });
      if (data.error) resolve(data.error);
    };
  });
  quotaWorker.terminate();
  check(
    quotaError.includes("Not enough browser storage"),
    "quota preflight preserves existing library",
  );
  await checkRead("c");
  results.push("insufficient storage leaves the complete library available");
  // Public removal never touches the separate database holding private drafts.
  const open = indexedDB.open("permitext-offline", 6);
  open.onupgradeneeded = () => open.result.createObjectStore("private-canary");
  const db = await new Promise((resolve, reject) => {
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  const tx = db.transaction("private-canary", "readwrite");
  tx.objectStore("private-canary").put("private draft", "keep");
  await new Promise((resolve) => (tx.oncomplete = resolve));
  await library.removeDownloadedLibrary();
  const canary = db
    .transaction("private-canary")
    .objectStore("private-canary")
    .get("keep");
  check(
    (await new Promise(
      (resolve) => (canary.onsuccess = () => resolve(canary.result)),
    )) === "private draft",
    "private data preserved",
  );
  db.close();
  check(
    !(await library.downloadedLibraryStatus()).available,
    "public removal complete",
  );
  results.push("removal preserves private drafts");
  return { passed: true, checks: results };
}
let finish;
const result = new Promise((resolve) => (finish = resolve));
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://fixture");
  const send = (value, status = 200) =>
    res
      .writeHead(status, {
        "content-type": "application/json",
        "cache-control": "no-store",
      })
      .end(JSON.stringify(value));
  try {
    if (url.pathname === "/result") {
      let body = "";
      for await (const c of req) body += c;
      finish(JSON.parse(body));
      return send({ ok: true });
    }
    if (url.pathname === "/control") {
      let body = "";
      for await (const c of req) body += c;
      const value = JSON.parse(body);
      if (value.revision) revision = value.revision;
      if ("badPart" in value) badPart = value.badPart;
      if ("failFigure" in value) failFigure = value.failFigure;
      if ("hold" in value) hold = value.hold;
      if ("finalDrift" in value) finalDrift = value.finalDrift;
      return send({ counts: Object.fromEntries(counts) });
    }
    if (url.pathname === "/") {
      res.setHeader("content-type", "text/html");
      return res.end(
        '<title>Downloaded library recovery checks</title><script type="module" src="/runner.js"></script>',
      );
    }
    if (url.pathname === "/quota-worker.js") {
      res.setHeader("content-type", "text/javascript");
      return res.end(
        'navigator.storage.estimate=async()=>({quota:1,usage:1});await import("/web/downloaded-library-worker.js?v=6");postMessage({ready:true});',
      );
    }
    if (url.pathname === "/runner.js") {
      res.setHeader("content-type", "text/javascript");
      return res.end(
        `(${browserRun.toString()})().then(r=>r&&fetch('/result',{method:'POST',body:JSON.stringify(r)})).catch(e=>fetch('/result',{method:'POST',body:JSON.stringify({passed:false,error:e.stack})}));`,
      );
    }
    const packageValue = packageData();
    if (url.pathname === "/web/downloaded-library/manifest.json")
      return send(packageValue.manifest);
    const part = packageValue.parts.find(
      (p) => p.descriptor.path === url.pathname,
    );
    if (part)
      return res
        .writeHead(200)
        .end(badPart ? Buffer.from("corrupt") : part.bytes);
    if (url.pathname === "/code/revision")
      return send({
        cacheContract: 1,
        corpusRevision:
          finalDrift && url.searchParams.has("expectedPublicCorpusRevision")
            ? "f".repeat(64)
            : revision.repeat(64),
        assetRevision: revision.repeat(64),
      });
    if (url.pathname === "/code/libraries") return send(libraries);
    if (url.pathname === "/code/chapters")
      return send({
        chapters: chapters()
          .filter((c) => (c.id === 2) === url.searchParams.has("version"))
          .map(({ sections, ...c }) => ({
            ...c,
            sectionCount: sections.length,
          })),
      });
    const match = url.pathname.match(/^\/code\/chapters\/(\d+)$/);
    if (match) {
      const chapter = chapters().find((c) => c.id === Number(match[1]));
      const countKey = `${revision}:${match[1]}:${url.searchParams.has("include") ? "body" : "manifest"}`;
      counts.set(countKey, (counts.get(countKey) || 0) + 1);
      if (revision === "a" && chapter.id === 2)
        await new Promise((resolve) => setTimeout(resolve, 600));
      while (hold) await new Promise((resolve) => setTimeout(resolve, 20));
      if (!url.searchParams.has("include"))
        return send({
          chapter: {
            ...chapter,
            sections: chapter.sections.map(({ blocks, ...s }) => s),
          },
        });
      const start = Number(url.searchParams.get("bodyStart")),
        end = Math.min(chapter.sections.length, start + 25);
      return send({
        chapter: {
          ...chapter,
          sections: chapter.sections.slice(start, end),
          bodyRange: { start, end, total: chapter.sections.length },
        },
      });
    }
    if (url.pathname === "/code/assets/fixture.png") {
      if (failFigure) return send({ error: "Controlled figure failure" }, 503);
      return res
        .writeHead(200, {
          "x-permitext-asset-revision": revision.repeat(64),
          "content-type": "image/png",
        })
        .end(asset);
    }
    if (/^\/web\/[a-z0-9-]+\.js$/.test(url.pathname)) {
      res.setHeader("content-type", "text/javascript");
      return res.end(await readFile(new URL(url.pathname.slice(5), root)));
    }
    send({ error: "Not found" }, 404);
  } catch (error) {
    send({ error: error.stack }, 500);
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const profile = await mkdtemp(
  join(tmpdir(), "permitext-downloaded-library-test-"),
);
const chrome = spawn(
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  [
    "--headless=new",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--disable-background-networking",
    `http://127.0.0.1:${server.address().port}`,
  ],
  { stdio: "ignore" },
);
let timer;
try {
  const output = await Promise.race([
    result,
    new Promise(
      (_, reject) =>
        (timer = setTimeout(
          () => reject(Error("Library browser checks timed out")),
          60000,
        )),
    ),
  ]);
  assert.equal(output.passed, true, output.error);
  console.log(JSON.stringify(output, null, 2));
} finally {
  clearTimeout(timer);
  hold = false;
  chrome.kill();
  await new Promise((resolve) =>
    chrome.exitCode !== null ? resolve() : chrome.once("exit", resolve),
  );
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(profile, { recursive: true, force: true });
}
