import { searchSpellingSuggestions } from "./search-relevance.js?v=20261025-workspace-chrome-v1366";
import { createPublicContentCache } from "./public-content-cache.js?v=1";
import {
  searchWords,
  searchWordForms,
  intersect,
  documentRecord,
  prepareLocalSearch,
  matchLocalSearch,
  localSearchPermits,
  finishLocalSearch,
  offlineSectionMetadata,
} from "./downloaded-library-core.js?v=13";
import {
  offlineAssetNamesForChapter,
  resolveOfflineSectionMetadata,
} from "./offline-code-metadata.js?v=1";
import { searchReaderTextSections } from "./reader-search-match.js?v=20261015-reader-search-preview-v3";
import {
  defaultSyncCodeVersion,
  historicalConstructionSyncCodeVersion,
} from "./sync-identity.js?v=20261021-identity-fast-path-v8";

const databaseName = "permitext-downloaded-library-v1";
const storeNames = [
  "metadata",
  "chapters",
  "sections",
  "documents",
  "postings",
  "reader-index",
];
const downloadLock = "permitext-library-download-v1",
  activeLock = "permitext-library-active-v1";
const jobs = new Map();
// Reuse matching/ranking across Load more pages, within a fixed small budget.
// Only result metadata/snippets are retained; full source documents are not.
const completedSearches = createPublicContentCache({
  maxBytes: 3 * 1024 * 1024,
  maxEntries: 4,
});
const request = (r) =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
const complete = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onabort = tx.onerror = () =>
      reject(tx.error || Error("Library write interrupted."));
  });
let connection, connectionFlight, connectionTimer;
async function openConnection() {
  const r = indexedDB.open(databaseName, 3);
  r.onupgradeneeded = () => {
    for (const name of storeNames) {
      const store = r.result.objectStoreNames.contains(name)
        ? r.transaction.objectStore(name)
        : r.result.createObjectStore(name);
      if (name === "documents" && !store.indexNames.contains("source"))
        store.createIndex("source", "source");
      if (name !== "metadata" && !store.indexNames.contains("generation"))
        store.createIndex("generation", "generation");
      if (name === "sections" && !store.indexNames.contains("reference"))
        store.createIndex("reference", "reference");
    }
  };
  const db = await request(r);
  const handle = { db, leases: 0 };
  db.onversionchange = () => {
    db.close();
    if (connection === handle) connection = null;
  };
  connection = handle;
  return handle;
}
async function database() {
  clearTimeout(connectionTimer);
  if (!connection && !connectionFlight)
    connectionFlight = openConnection().finally(() => {
      connectionFlight = null;
    });
  const handle = connection || (await connectionFlight);
  clearTimeout(connectionTimer);
  handle.leases++;
  let released = false;
  // A short lease avoids reopening IndexedDB for every 64-document batch.
  // It retains no decoded passages and closes after the operation settles.
  return {
    transaction: (...args) => handle.db.transaction(...args),
    close() {
      if (released) return;
      released = true;
      handle.leases--;
      if (!handle.leases)
        connectionTimer = setTimeout(() => {
          if (!handle.leases && connection === handle) {
            handle.db.close();
            connection = null;
          }
        }, 1000);
    },
  };
}
async function get(name, key) {
  const db = await database();
  try {
    return await request(db.transaction(name).objectStore(name).get(key));
  } finally {
    db.close();
  }
}
async function put(name, values) {
  const db = await database();
  try {
    const tx = db.transaction(name, "readwrite"),
      done = complete(tx),
      store = tx.objectStore(name);
    for (const [key, value] of values) store.put(value, key);
    await done;
  } finally {
    db.close();
  }
}
const active = () => get("metadata", "active");
const key = (generation, id) => [generation, id];
const assetCache = (revision) =>
  `permitext-pro-code-assets-revision-${revision}`;
async function rows(name, generation, ids) {
  const db = await database();
  try {
    const store = db.transaction(name).objectStore(name);
    return await Promise.all(
      ids.map((id) => request(store.get(key(generation, id)))),
    );
  } finally {
    db.close();
  }
}
async function eraseGeneration(generation) {
  const db = await database();
  try {
    for (const name of storeNames.slice(1)) {
      let count;
      do {
        // Small transactions let new readers/searches proceed during collection.
        const tx = db.transaction(name, "readwrite"),
          done = complete(tx),
          store = tx.objectStore(name);
        const keys = await request(
          store
            .index("generation")
            .getAllKeys(IDBKeyRange.only(generation), 256),
        );
        count = keys.length;
        keys.forEach((key) => store.delete(key));
        await done;
      } while (count === 256);
    }
  } finally {
    db.close();
  }
}
async function collectGenerations(activeGeneration) {
  const db = await database(),
    generations = new Set();
  try {
    for (const name of storeNames.slice(1)) {
      const r = db
        .transaction(name)
        .objectStore(name)
        .index("generation")
        .openKeyCursor(null, "nextunique");
      await new Promise((resolve, reject) => {
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const cursor = r.result;
          if (!cursor) return resolve();
          generations.add(cursor.key);
          cursor.continue();
        };
      });
    }
  } finally {
    db.close();
  }
  for (const generation of generations)
    if (generation !== activeGeneration) await eraseGeneration(generation);
}
async function fetchResponse(path, signal, read) {
  signal?.throwIfAborted();
  const controller = new AbortController(),
    abort = () => controller.abort(signal.reason);
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(
    () =>
      controller.abort(
        Error("Download timed out. Resume when your connection is ready."),
      ),
    30_000,
  );
  try {
    const response = await fetch(path, {
      cache: "no-cache",
      signal: controller.signal,
    });
    if (!response.ok)
      throw Error(`Download failed (${response.status}). Resume to try again.`);
    return await read(response);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
const json = (path, signal) => fetchResponse(path, signal, (r) => r.json());
const digest = async (bytes) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
function validateManifest(m) {
  if (
    m?.schemaVersion !== 1 ||
    m.searchContract !== 2 ||
    !/^[a-f0-9]{64}$/.test(m.indexRevision || "") ||
    !/^[a-f0-9]{64}$/.test(m.corpusRevision || "") ||
    !/^[a-f0-9]{64}$/.test(m.assetRevision || "") ||
    !Array.isArray(m.parts) ||
    !m.parts.length ||
    m.parts.some(
      (p) =>
        !["documents", "postings", "reader-index"].includes(p.kind) ||
        p.path !==
          `/web/downloaded-library/${p.kind}-${p.sha256}.${p.kind === "reader-index" ? "gz" : "json"}` ||
        !/^[a-f0-9]{64}$/.test(p.sha256 || "") ||
        !Number.isSafeInteger(p.bytes) ||
        p.bytes < 1 ||
        p.bytes > 4 * 1024 * 1024,
    )
  ) {
    throw Error(
      "This downloaded-library package is incompatible. Reload the app and try again.",
    );
  }
}
function progress(id, phase, completed, total, unit = "items") {
  postMessage({
    id,
    progress: {
      phase,
      completed,
      total,
      unit,
      percent: total ? (100 * completed) / total : 0,
    },
  });
}
async function chapterDownload(summary, pin, signal, onPage) {
  const route = `/code/chapters/${summary.id}`;
  const { chapter } = await json(`${route}?bodyContract=2&${pin}`, signal);
  if (
    String(chapter?.id) !== String(summary.id) ||
    chapter.bodyContract !== 2 ||
    !chapter.corpusRevision ||
    (summary.codeVersion && chapter.codeVersion !== summary.codeVersion)
  )
    throw Error(
      "The chapter edition changed. Resume to check for a new package.",
    );
  const sections = chapter.sections.map((s) => ({ ...s }));
  for (let start = 0; start < sections.length; start += 25) {
    const { chapter: page } = await json(
      `${route}?bodyContract=2&include=body&bodyStart=${start}&bodyLimit=25&expectedCorpusRevision=${chapter.corpusRevision}&${pin}`,
      signal,
    );
    const end = Math.min(start + 25, sections.length);
    if (
      page?.corpusRevision !== chapter.corpusRevision ||
      page.codeVersion !== chapter.codeVersion ||
      page.bodyRange?.start !== start ||
      page.bodyRange.end !== end ||
      page.bodyRange.total !== sections.length ||
      page.sections?.length !== end - start ||
      page.sections.some(
        (s, i) => s.id !== sections[start + i].id || !Array.isArray(s.blocks),
      )
    )
      throw Error("Incomplete chapter download. Resume to try again.");
    page.sections.forEach((s, i) => {
      sections[start + i].blocks = s.blocks;
    });
    onPage?.(end, sections.length);
  }
  return { ...chapter, sections };
}
async function saveChapter(generation, chapter) {
  const db = await database();
  try {
    const tx = db.transaction(["chapters", "sections"], "readwrite"),
      done = complete(tx);
    const sections = chapter.sections.map(({ blocks, ...s }) => s);
    tx.objectStore("chapters").put(
      { generation, value: { ...chapter, sections } },
      key(generation, String(chapter.id)),
    );
    for (const section of chapter.sections) {
      // Rich text is stored once. Search uses the compact, canonical text index.
      const value = { ...documentRecord(section, chapter) };
      delete value.plainText;
      tx.objectStore("sections").put(
        {
          generation,
          value,
          reference: [
            generation,
            chapter.codePrefix,
            chapter.codeVersion,
            String(section.sectionNumber).toLowerCase(),
          ],
        },
        key(generation, section.id),
      );
    }
    await done;
  } finally {
    db.close();
  }
}
async function status() {
  const [record, pending] = await Promise.all([
    active(),
    get("metadata", "pending"),
  ]);
  const { metadata, catalog, ...summary } = record || {};
  return {
    ...summary,
    available: Boolean(record),
    pending: pending
      ? {
          completed: pending.chaptersDone.length,
          total: pending.catalog.length,
          downloadedAt: pending.downloadedAt,
        }
      : null,
  };
}
async function install(id, signal) {
  return navigator.locks.request(
    downloadLock,
    { ifAvailable: true },
    async (lock) => {
      signal.throwIfAborted();
      if (!lock) throw Error("A library download is running in another tab.");
      progress(id, "Checking library", 0, 1);
      const manifest = await json(
        "/web/downloaded-library/manifest.json",
        signal,
      );
      validateManifest(manifest);
      const { indexRevision, ...unsigned } = manifest;
      if (
        (await digest(new TextEncoder().encode(JSON.stringify(unsigned)))) !==
        indexRevision
      )
        throw Error("Library manifest validation failed.");
      const revision = await json("/code/revision", signal);
      if (
        revision.corpusRevision !== manifest.corpusRevision ||
        revision.assetRevision !== manifest.assetRevision
      )
        throw Error("The library was updated. Reload and resume the download.");
      const pin = `expectedPublicCorpusRevision=${manifest.corpusRevision}`;
      let pending = await get("metadata", "pending");
      if (
        !pending &&
        (await active())?.indexRevision === manifest.indexRevision
      )
        return status();
      if (pending && pending.indexRevision !== manifest.indexRevision) {
        await eraseGeneration(pending.generation);
        pending = null;
        // Its figure cache is content-addressed; leave any revision still used by
        // active readers intact. Unused revisions are collected after activation.
      }
      if (!pending) {
        const libraries = await json(`/code/libraries?${pin}`, signal);
        const indexes = await Promise.all([
          json(`/code/chapters?${pin}`, signal),
          json(
            `/code/chapters?version=${encodeURIComponent(historicalConstructionSyncCodeVersion)}&${pin}`,
            signal,
          ),
        ]);
        const catalog = [
          ...new Map(
            indexes
              .flatMap((p) => p.chapters)
              .map((c) => [
                String(c.id),
                { ...c, codeVersion: c.codeVersion || defaultSyncCodeVersion },
              ]),
          ).values(),
        ];
        if (!catalog.length || !libraries.codeSources?.length)
          throw Error("The library catalog is incomplete.");
        const estimate = await navigator.storage?.estimate?.();
        const needed = manifest.estimatedStorageBytes || 400 * 1024 * 1024;
        if (estimate?.quota && estimate.quota - (estimate.usage || 0) < needed)
          throw Error(
            "Not enough browser storage. Free about 400 MB and try again. The current download is unchanged.",
          );
        pending = {
          generation: crypto.randomUUID(),
          ...revision,
          indexRevision: manifest.indexRevision,
          libraries,
          catalog,
          downloadedAt: new Date().toISOString(),
          chaptersDone: [],
          partsDone: [],
          assets: [],
          figuresDone: [],
          sectionCount: 0,
        };
        await put("metadata", [["pending", pending]]);
      }
      const assets = new Set(pending.assets);
      for (const summary of pending.catalog) {
        signal.throwIfAborted();
        if (pending.chaptersDone.includes(String(summary.id))) continue;
        const chapter = await chapterDownload(
          summary,
          pin,
          signal,
          (done, total) =>
            progress(
              id,
              `Downloading chapter ${summary.chapterNumber || summary.id} · ${done}/${total} sections`,
              pending.chaptersDone.length,
              pending.catalog.length,
              "chapters",
            ),
        );
        offlineAssetNamesForChapter(chapter).forEach((name) =>
          assets.add(name),
        );
        await saveChapter(pending.generation, chapter);
        pending.chaptersDone.push(String(summary.id));
        pending.sectionCount += chapter.sections.length;
        pending.assets = [...assets];
        await put("metadata", [["pending", pending]]);
        progress(
          id,
          "Downloading codes",
          pending.chaptersDone.length,
          pending.catalog.length,
          "chapters",
        );
      }
      for (const part of manifest.parts) {
        signal.throwIfAborted();
        if (pending.partsDone.includes(part.sha256)) continue;
        const bytes = await fetchResponse(part.path, signal, (r) =>
          r.arrayBuffer(),
        );
        if (
          bytes.byteLength !== part.bytes ||
          (await digest(bytes)) !== part.sha256
        )
          throw Error(
            "Search package validation failed. Resume to download this part again.",
          );
        if (part.kind === "reader-index") {
          const chapter = (
            await get("chapters", key(pending.generation, part.chapterID))
          )?.value;
          if (!chapter || chapter.corpusRevision !== part.corpusRevision)
            throw Error("Reader search revision differs from downloaded text.");
          await put("reader-index", [
            [
              key(pending.generation, part.chapterID),
              { generation: pending.generation, value: bytes },
            ],
          ]);
        } else {
          const records = JSON.parse(new TextDecoder().decode(bytes));
          if (!Array.isArray(records) || records.length !== part.count)
            throw Error("Incomplete search package.");
          const values = records.map((record) =>
            part.kind === "documents"
              ? [
                  key(pending.generation, record.id),
                  {
                    generation: pending.generation,
                    value: record,
                    source: [
                      pending.generation,
                      record.codeVersion,
                      record.codePrefix,
                      record.codeSectionID,
                    ],
                  },
                ]
              : [
                  key(pending.generation, record[0]),
                  {
                    generation: pending.generation,
                    value: Uint32Array.from(record[1]),
                  },
                ],
          );
          await put(part.kind, values);
        }
        pending.partsDone.push(part.sha256);
        await put("metadata", [["pending", pending]]);
        progress(
          id,
          "Preparing search",
          pending.partsDone.length,
          manifest.parts.length,
          "parts",
        );
      }
      const cache = await caches.open(assetCache(pending.assetRevision));
      for (const name of pending.assets) {
        signal.throwIfAborted();
        const path = `/code/assets/${encodeURIComponent(name)}?assetRevision=${pending.assetRevision}`;
        const cached = await cache.match(path);
        if (
          !cached ||
          cached.headers.get("x-permitext-asset-revision") !==
            pending.assetRevision
        ) {
          await fetchResponse(path, signal, async (response) => {
            if (
              response.headers.get("x-permitext-asset-revision") !==
              pending.assetRevision
            )
              throw Error("Figure revision changed. Resume to try again.");
            const blob = await response.blob();
            await cache.put(
              path,
              new Response(blob, {
                headers: {
                  "content-type": response.headers.get("content-type"),
                  "x-permitext-asset-revision": pending.assetRevision,
                },
              }),
            );
          });
        }
        if (!pending.figuresDone.includes(name)) pending.figuresDone.push(name);
        if (pending.figuresDone.length % 20 === 0)
          await put("metadata", [["pending", pending]]);
        progress(
          id,
          "Downloading figures",
          pending.figuresDone.length,
          pending.assets.length,
          "figures",
        );
      }
      const finalRevision = await json(`/code/revision?${pin}`, signal);
      const finalManifest = await json(
        "/web/downloaded-library/manifest.json",
        signal,
      );
      if (
        finalRevision.corpusRevision !== pending.corpusRevision ||
        finalRevision.assetRevision !== pending.assetRevision ||
        finalManifest.indexRevision !== pending.indexRevision
      )
        throw Error(
          "The library changed during download. Resume to install its latest complete version.",
        );
      signal.throwIfAborted();
      const record = {
        generation: pending.generation,
        installID: pending.generation,
        corpusRevision: pending.corpusRevision,
        assetRevision: pending.assetRevision,
        indexRevision: pending.indexRevision,
        librarySchemaVersion: 4,
        searchContract: manifest.searchContract,
        assetVersion: "downloaded-library-v1",
        downloadedAt: pending.downloadedAt,
        chapterCount: pending.catalog.length,
        sectionCount: pending.sectionCount,
        libraries: pending.libraries.libraries,
        codeSources: pending.libraries.codeSources,
        codeTrustProfiles: pending.libraries.codeTrustProfiles,
        catalog: pending.catalog,
        metadata: pending.libraries,
      };
      // Reads hold a shared lock for their complete transaction chain. Switch and
      // collection wait for those reads, so a reader never sees deleted bodies.
      await navigator.locks.request(
        activeLock,
        { mode: "exclusive", signal },
        async () => {
          const previous = await active(),
            db = await database();
          record.previousAssetRevision = previous?.assetRevision || "";
          try {
            const tx = db.transaction("metadata", "readwrite"),
              done = complete(tx),
              store = tx.objectStore("metadata");
            store.put(record, "active");
            store.delete("pending");
            await done;
          } finally {
            db.close();
          }
          // Cleanup failure cannot undo or report failure for a successful install.
          // Keep current and previous figures for already-rendered passages, while
          // collecting abandoned revisions so repeated updates cannot grow forever.
          const keep = new Set([
            record.assetRevision,
            record.previousAssetRevision,
          ]);
          await Promise.all(
            (await caches.keys())
              .filter(
                (name) =>
                  name.startsWith("permitext-pro-code-assets-revision-") &&
                  !keep.has(
                    name.slice("permitext-pro-code-assets-revision-".length),
                  ),
              )
              .map((name) => caches.delete(name)),
          ).catch(() => {});
        },
      );
      await collectGenerations(record.generation).catch(() => {});
      progress(id, "Downloaded library is ready", 1, 1);
      return status();
    },
  );
}
async function posting(generation, word, numericPrefix) {
  const values = new Set(),
    db = await database();
  try {
    const range =
      /^\p{L}{3,}$/u.test(word) || numericPrefix
        ? IDBKeyRange.bound(
            key(generation, word),
            key(generation, word + "\uffff"),
          )
        : IDBKeyRange.only(key(generation, word));
    const r = db
      .transaction("postings")
      .objectStore("postings")
      .openCursor(range);
    await new Promise((resolve, reject) => {
      r.onerror = () => reject(r.error);
      r.onsuccess = () => {
        const c = r.result;
        if (!c) return resolve();
        for (const id of c.value.value) values.add(id);
        c.continue();
      };
    });
  } finally {
    db.close();
  }
  for (const form of searchWordForms(word))
    if (form !== word)
      for (const id of (await get("postings", key(generation, form)))?.value ||
        [])
        values.add(id);
  return [...values].sort((a, b) => a - b);
}
async function search(url, m, signal) {
  const context = prepareLocalSearch(url, m.metadata);
  const pageParameters = new Set([
    "offset",
    "limit",
    "candidateOffset",
    "grouped",
    "expectedPublicCorpusRevision",
  ]);
  const cacheKey = JSON.stringify([
    m.generation,
    [...url.searchParams]
      .filter(([name]) => !pageParameters.has(name))
      .sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv)),
  ]);
  if (completedSearches.has(cacheKey)) {
    const matches = await completedSearches.get(cacheKey);
    signal.throwIfAborted();
    return finishLocalSearch(matches, url, context);
  }
  const words = searchWords(context.query).filter((word) => word.length >= 2);
  if (context.query.length < 2 || !words.length)
    return { query: context.query, results: [], totalResults: 0 };
  const permittedSources = m.codeSources.filter((source) =>
    localSearchPermits(
      {
        codeVersion: source.canonicalEdition,
        codePrefix: source.codePrefix,
        codeSectionID: source.categoryID,
      },
      context,
    ),
  );
  if (!permittedSources.length)
    return {
      query: context.query,
      results: [],
      totalResults: 0,
      hasMore: false,
    };
  let permittedIDs = null;
  if (permittedSources.length !== m.codeSources.length) {
    permittedIDs = new Set();
    const db = await database();
    try {
      const index = db
        .transaction("documents")
        .objectStore("documents")
        .index("source");
      for (const keys of await Promise.all(
        permittedSources.map((source) =>
          request(
            index.getAllKeys([
              m.generation,
              source.canonicalEdition,
              source.codePrefix,
              source.categoryID,
            ]),
          ),
        ),
      )) {
        for (const [, id] of keys)
          if (typeof id === "number") permittedIDs.add(id);
      }
    } finally {
      db.close();
    }
  }
  const candidateIDs = intersect(
    await Promise.all(
      words.map((word) =>
        posting(
          m.generation,
          word,
          words.length === 1 && /^[A-Za-z]?\d/.test(context.query),
        ),
      ),
    ),
  );
  const ids = permittedIDs
    ? candidateIDs.filter((id) => permittedIDs.has(id))
    : candidateIDs;
  const matches = [];
  for (let start = 0; start < ids.length; start += 64) {
    signal.throwIfAborted();
    for (const row of await rows(
      "documents",
      m.generation,
      ids.slice(start, start + 64),
    )) {
      if (row) {
        const match = matchLocalSearch(row.value, context, m.metadata);
        if (match) matches.push(match);
      }
    }
  }
  signal.throwIfAborted();
  if (matches.length) completedSearches.set(cacheKey, matches);
  const result = finishLocalSearch(matches, url, context);
  if (!matches.length && !context.scope?.isEmpty) {
    const terms = new Set();
    for (const source of m.codeSources) {
      signal.throwIfAborted();
      const record = (
        await get(
          "documents",
          key(
            m.generation,
            `vocabulary:${source.canonicalEdition}:${source.codePrefix}:${source.categoryID}`,
          ),
        )
      )?.value;
      if (record && localSearchPermits(record, context))
        for (const term of record.terms) terms.add(term);
    }
    result.suggestions = searchSpellingSuggestions(context.query, terms);
  }
  return result;
}
async function readerFind(chapter, url, m, signal) {
  const query = url.searchParams.get("readerSearch");
  const catalog =
    url.searchParams.get("readerScope") === "code"
      ? [
          chapter,
          ...m.catalog.filter(
            (c) =>
              c.codePrefix === chapter.codePrefix &&
              c.codeVersion === chapter.codeVersion &&
              String(c.id) !== String(chapter.id),
          ),
        ]
      : [chapter];
  const chapters = [],
    results = [];
  for (const summary of catalog) {
    signal.throwIfAborted();
    const c =
      summary === chapter
        ? chapter
        : (await get("chapters", key(m.generation, String(summary.id))))?.value;
    if (!c) throw Error("Downloaded chapter is unavailable.");
    const compressed = (
      await get("reader-index", key(m.generation, String(c.id)))
    )?.value;
    if (!compressed)
      throw Error(
        "Downloaded Reader search is incomplete. Update the library.",
      );
    const projection = await new Response(
      new Blob([compressed])
        .stream()
        .pipeThrough(new DecompressionStream("gzip")),
    ).json();
    if (
      String(projection.chapterID) !== String(c.id) ||
      projection.corpusRevision !== c.corpusRevision ||
      projection.codeVersion !== c.codeVersion
    )
      throw Error("Downloaded Reader search changed. Update the library.");
    const matches = searchReaderTextSections(projection.sections, query);
    const identity = {
      chapterID: c.id,
      chapterNumber: c.chapterNumber,
      chapterTitle: c.fullTitle || c.displayTitle,
      corpusRevision: c.corpusRevision,
    };
    chapters.push({ ...identity, total: matches.length });
    results.push(
      ...(url.searchParams.get("readerScope") === "code"
        ? matches.map((r) => ({ ...r, ...identity }))
        : matches),
    );
  }
  return {
    readerSearch: {
      scope:
        url.searchParams.get("readerScope") === "code" ? "code" : "chapter",
      chapterID: chapter.id,
      codePrefix: chapter.codePrefix,
      codeVersion: chapter.codeVersion,
      corpusRevision: chapter.corpusRevision,
      query: query.trim(),
      chapters,
      total: results.length,
      results,
    },
  };
}
async function read(path, offline, signal) {
  return navigator.locks.request(
    activeLock,
    { mode: "shared", signal },
    async () => {
      const m = await active();
      if (!m || m.searchContract !== 2) return null;
      const url = new URL(path, self.location.origin),
        expected = url.searchParams.get("expectedPublicCorpusRevision");
      // When online, an older download must never impersonate the latest server
      // revision. Normal online transport remains the fallback until updated.
      if (!offline && expected && expected !== m.corpusRevision) return null;
      let payload;
      if (url.pathname === "/code/revision")
        payload = {
          corpusRevision: m.corpusRevision,
          assetRevision: m.assetRevision,
          cacheContract: 1,
        };
      else if (url.pathname === "/code/libraries") payload = m.metadata;
      else if (url.pathname === "/code/chapters") {
        const prefix = url.searchParams.get("code"),
          version = url.searchParams.get("version");
        payload = {
          chapters: m.catalog.filter(
            (c) =>
              (!prefix || c.codePrefix === prefix) &&
              (version
                ? version === "all" || c.codeVersion === version
                : c.codeVersion !== historicalConstructionSyncCodeVersion),
          ),
        };
      } else if (/^\/code\/chapters\/[a-zA-Z0-9_-]+$/.test(url.pathname)) {
        const chapter = (
          await get(
            "chapters",
            key(m.generation, url.pathname.split("/").at(-1)),
          )
        )?.value;
        if (!chapter) return null;
        if (
          url.searchParams.has("expectedCorpusRevision") &&
          url.searchParams.get("expectedCorpusRevision") !==
            chapter.corpusRevision
        )
          return null;
        if (url.searchParams.has("readerSearch"))
          payload = await readerFind(chapter, url, m, signal);
        else if (url.searchParams.get("include") === "body") {
          const requestedLimit = Number(url.searchParams.get("bodyLimit"));
          const limit =
            requestedLimit > 0
              ? Math.min(50, requestedLimit)
              : chapter.sections.length;
          const start = Math.min(
              chapter.sections.length,
              Math.max(0, Number(url.searchParams.get("bodyStart")) || 0),
            ),
            end = Math.min(chapter.sections.length, start + limit);
          const records = await rows(
            "sections",
            m.generation,
            chapter.sections.slice(start, end).map((s) => s.id),
          );
          if (records.some((r) => !r)) return null;
          payload = {
            chapter: {
              ...chapter,
              sections: records.map((r) => ({
                id: r.value.id,
                blocks: r.value.blocks,
              })),
              bodyRange: {
                start,
                end,
                total: chapter.sections.length,
                complete: start === 0 && end === chapter.sections.length,
              },
            },
          };
        } else payload = { chapter };
      } else if (url.pathname === "/code/search")
        payload = await search(url, m, signal);
      else if (/^\/code\/sections\/\d+$/.test(url.pathname)) {
        const record = (
          await get(
            "sections",
            key(m.generation, Number(url.pathname.split("/").at(-1))),
          )
        )?.value;
        if (!record) return null;
        payload = {
          section: {
            ...record,
            ...offlineSectionMetadata(
              record,
              m.metadata,
              url.searchParams.getAll("version"),
            ),
            assetRevision: m.assetRevision,
          },
        };
        if (url.searchParams.get("include") === "metadata")
          payload.section = offlineSectionMetadata(
            record,
            m.metadata,
            url.searchParams.getAll("version"),
          );
      } else if (url.pathname === "/code/sections") {
        const ids = (url.searchParams.get("ids") || "")
          .split(",")
          .filter(Boolean)
          .map(Number);
        payload = {
          sections: (await rows("sections", m.generation, ids))
            .filter(Boolean)
            .map((r) => offlineSectionMetadata(r.value, m.metadata)),
        };
      } else if (url.pathname === "/code/sections/resolve") {
        const code = url.searchParams.get("code"),
          version = url.searchParams.get("version"),
          number = url.searchParams.get("sectionNumber");
        if (!code || !version || !number) return null;
        const db = await database();
        let records;
        try {
          records = await request(
            db
              .transaction("sections")
              .objectStore("sections")
              .index("reference")
              .getAll([
                m.generation,
                code.toUpperCase(),
                version,
                number
                  .replace(/^Section\s+/i, "")
                  .replace(/\([^)]+\)/g, "")
                  .trim()
                  .toLowerCase(),
              ]),
          );
        } finally {
          db.close();
        }
        payload = {
          section: resolveOfflineSectionMetadata(
            records.map((r) => r.value),
            m.metadata,
            { code: code.toUpperCase(), version, sectionNumber: number },
          ),
        };
      } else return null;
      return { payload, corpusRevision: m.corpusRevision };
    },
  );
}
async function remove(signal) {
  return navigator.locks.request(
    downloadLock,
    { ifAvailable: true },
    async (lock) => {
      if (!lock)
        throw Error(
          "Pause the library download in its other tab before removing it.",
        );
      await navigator.locks.request(
        activeLock,
        { mode: "exclusive", signal },
        async () => {
          const db = await database();
          try {
            const tx = db.transaction(storeNames, "readwrite"),
              done = complete(tx);
            storeNames.forEach((name) => tx.objectStore(name).clear());
            await done;
          } finally {
            db.close();
          }
        },
      );
      return true;
    },
  );
}
self.onmessage = async ({ data }) => {
  if (data.action === "cancel") {
    jobs.get(data.requestID)?.abort();
    return;
  }
  const controller = new AbortController();
  jobs.set(data.id, controller);
  try {
    let result;
    if (data.action === "status") result = await status();
    else if (data.action === "install")
      result = await install(data.id, controller.signal);
    else if (data.action === "read")
      result = await read(data.path, data.offline, controller.signal);
    else if (data.action === "remove") result = await remove(controller.signal);
    else throw Error("Unknown library action.");
    controller.signal.throwIfAborted();
    postMessage({ id: data.id, result });
  } catch (error) {
    postMessage({
      id: data.id,
      error: error.message || String(error),
      name: error.name,
      code: error.code,
    });
  } finally {
    jobs.delete(data.id);
  }
};
