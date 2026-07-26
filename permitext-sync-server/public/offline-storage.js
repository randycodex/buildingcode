const databaseName = "permitext-offline";
const databaseVersion = 2;
const metadataStoreName = "metadata";
const chaptersStoreName = "chapters";
const sectionsStoreName = "sections";
const syncSnapshotsStoreName = "sync-snapshots";
const activeLibraryKey = "active-library";
const shellCacheName = "permitext-pro-shell-v36";
const shellAssetVersion = "20260726-web-reliability-v26";
const offlineAssetVersion = "20260725-visual-inventory-v13";
const defaultCodeVersion = "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1";
const shellURLs = [
  "/",
  "/web/manifest.webmanifest?v=20260725-visual-inventory-v13",
  "/web/icons/permitext-192.png",
  "/web/icons/permitext-512.png",
  "/web/styles.css?v=20260726-web-reliability-v26",
  "/web/workboard-assets/workboard.css?v=20260722-workboard-zoom-v57",
  "/web/app.js?v=20260726-web-reliability-v26",
  "/web/offline-storage.js?v=20260726-web-reliability-v26",
  "/web/code-references.js?v=20260720-code-reference-links-v18",
  "/web/sync-identity.js?v=20260724-zoning-library-v3",
  "/web/sync-state.js?v=20260721-causal-clear-v4"
];

let cachedSearchInstallID = "";
let cachedSearchSections = null;

function requestResult(request, fallbackMessage) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error(fallbackMessage));
  });
}

function transactionComplete(transaction, fallbackMessage) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error(fallbackMessage));
    transaction.onabort = () => reject(transaction.error || new Error(fallbackMessage));
  });
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(metadataStoreName)) {
        database.createObjectStore(metadataStoreName, { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains(chaptersStoreName)) {
        const chapters = database.createObjectStore(chaptersStoreName, { keyPath: "key" });
        chapters.createIndex("installID", "installID");
      }
      if (!database.objectStoreNames.contains(sectionsStoreName)) {
        const sections = database.createObjectStore(sectionsStoreName, { keyPath: "key" });
        sections.createIndex("installID", "installID");
        sections.createIndex("identities", "identities", { multiEntry: true });
      }
      if (!database.objectStoreNames.contains(syncSnapshotsStoreName)) {
        database.createObjectStore(syncSnapshotsStoreName, { keyPath: "userID" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open offline code storage."));
  });
}

async function metadataRecord() {
  if (typeof indexedDB === "undefined") return null;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(metadataStoreName, "readonly");
    return await requestResult(
      transaction.objectStore(metadataStoreName).get(activeLibraryKey),
      "Could not read offline code status."
    ) || null;
  } finally {
    database.close();
  }
}

function sectionIdentityValues(installID, section) {
  return Array.from(new Set([
    section?.id,
    section?.sectionID,
    section?.webSectionID
  ].map((value) => String(value || "").trim()).filter(Boolean)))
    .map((value) => `${installID}:${value}`);
}

function chapterSectionRecord(installID, chapter, section) {
  const blocks = Array.isArray(section.blocks) ? section.blocks : [];
  const plainText = blocks.map((block) => block.plainText || "").join("\n\n").trim();
  return {
    key: `${installID}:${section.id}`,
    installID,
    identities: sectionIdentityValues(installID, section),
    id: section.id,
    sectionID: Number(section.id),
    webSectionID: section.webSectionID || null,
    chapterID: chapter.id,
    codePrefix: chapter.codePrefix || "BC",
    codeSectionID: chapter.codeSectionID || null,
    chapterNumber: chapter.chapterNumber || "",
    sectionNumber: section.sectionNumber || "",
    title: section.title || "Section",
    headerLine: section.headerLine || "",
    headingLine: section.headingLine || "",
    blocks,
    plainText,
    searchText: [
      section.sectionNumber,
      section.title,
      section.headerLine,
      section.headingLine,
      plainText
    ].filter(Boolean).join(" ").toLowerCase()
  };
}

async function writeDownloadedChapter(installID, chapter) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction([chaptersStoreName, sectionsStoreName], "readwrite");
    transaction.objectStore(chaptersStoreName).put({
      key: `${installID}:${chapter.id}`,
      installID,
      chapter
    });
    const sectionStore = transaction.objectStore(sectionsStoreName);
    (chapter.sections || []).forEach((section) => {
      sectionStore.put(chapterSectionRecord(installID, chapter, section));
    });
    await transactionComplete(transaction, "Could not store an offline code chapter.");
  } finally {
    database.close();
  }
}

async function deleteRecordsForInstall(store, installID) {
  const index = store.index("installID");
  const request = index.openKeyCursor(IDBKeyRange.only(installID));
  await new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      store.delete(cursor.primaryKey);
      cursor.continue();
    };
    request.onerror = () => reject(request.error || new Error("Could not remove an offline code version."));
  });
}

async function deleteInstall(installID) {
  if (!installID || typeof indexedDB === "undefined") return;
  const database = await openDatabase();
  try {
    const transaction = database.transaction([chaptersStoreName, sectionsStoreName], "readwrite");
    const completion = transactionComplete(transaction, "Could not remove an incomplete offline download.");
    await Promise.all([
      deleteRecordsForInstall(transaction.objectStore(chaptersStoreName), installID),
      deleteRecordsForInstall(transaction.objectStore(sectionsStoreName), installID)
    ]);
    await completion;
  } finally {
    database.close();
  }
}

async function activateInstall(record) {
  const previous = await metadataRecord();
  const database = await openDatabase();
  try {
    const transaction = database.transaction(metadataStoreName, "readwrite");
    transaction.objectStore(metadataStoreName).put({ key: activeLibraryKey, ...record });
    await transactionComplete(transaction, "Could not activate the offline code library.");
  } finally {
    database.close();
  }
  cachedSearchInstallID = "";
  cachedSearchSections = null;
  if (previous?.installID && previous.installID !== record.installID) {
    await deleteInstall(previous.installID);
  }
}

async function fetchJSON(path, signal) {
  const response = await fetch(path, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Offline download failed: ${response.status}`);
  return response.json();
}

async function mapWithConcurrency(items, concurrency, worker) {
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

function normalizedOfflineAssetName(value) {
  const source = String(value || "").split(/[?#]/, 1)[0];
  if (!source || source.startsWith("data:")) return null;
  let decoded = source;
  try {
    decoded = decodeURIComponent(source);
  } catch {
    // Use the undecoded source so malformed input is rejected by the allowlist below.
  }
  const name = decoded.split("/").at(-1) || "";
  return /^[a-zA-Z0-9._-]+$/.test(name) ? name : null;
}

export function offlineAssetNamesForChapter(chapter) {
  const names = new Set();
  for (const section of chapter?.sections || []) {
    for (const block of section?.blocks || []) {
      const imageID = normalizedOfflineAssetName(block?.imageID);
      if (imageID) names.add(imageID);
      for (const match of String(block?.html || "").matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
        const name = normalizedOfflineAssetName(match[1]);
        if (name) names.add(name);
      }
    }
  }
  return [...names];
}

function offlineAssetURL(name) {
  return `/code/assets/${encodeURIComponent(name)}?v=${offlineAssetVersion}`;
}

async function cacheOfflineAssets(assetNames, options = {}) {
  if (!assetNames.length) return 0;
  const cache = await caches.open(shellCacheName);
  let completed = 0;
  let downloadedBytes = 0;
  options.onProgress?.({
    completed: 0,
    total: assetNames.length,
    percent: 0,
    phase: "Downloading figures",
    unit: "figures"
  });
  await mapWithConcurrency(assetNames, 4, async (name) => {
    const url = offlineAssetURL(name);
    const response = await fetch(url, { cache: "no-store", signal: options.signal });
    if (!response.ok) throw new Error(`Offline figure download failed: ${response.status}`);
    const size = response.clone().arrayBuffer().then((buffer) => buffer.byteLength);
    await cache.put(url, response);
    downloadedBytes += await size;
    completed += 1;
    options.onProgress?.({
      completed,
      total: assetNames.length,
      percent: Math.round((completed / assetNames.length) * 100),
      phase: "Downloading figures",
      unit: "figures"
    });
  });
  return downloadedBytes;
}

export async function prepareOfflineShell() {
  if (!("serviceWorker" in navigator) || !("caches" in window)) {
    throw new Error("This browser does not support offline installation.");
  }
  const registration = await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const cache = await caches.open(shellCacheName);
  await cache.addAll(shellURLs);
  return registration;
}

export async function downloadOfflineLibrary(options = {}) {
  if (typeof indexedDB === "undefined") {
    throw new Error("This browser does not provide offline code storage.");
  }
  const installID = crypto.randomUUID();
  const downloadedAt = new Date().toISOString();
  const referencedAssetNames = new Set();
  let downloadedBytes = 0;
  let completed = 0;
  try {
    options.onProgress?.({ completed: 0, total: 1, percent: 0, phase: "Preparing offline app" });
    await prepareOfflineShell();
    const indexPayload = await fetchJSON("/code/chapters", options.signal);
    const chapters = indexPayload.chapters || [];
    if (!chapters.length) throw new Error("No code chapters were available for offline download.");
    options.onProgress?.({
      completed: 0,
      total: chapters.length,
      percent: 0,
      phase: "Downloading codes",
      unit: "chapters"
    });
    await mapWithConcurrency(chapters, 4, async (summary) => {
      const payload = await fetchJSON(
        `/code/chapters/${encodeURIComponent(summary.id)}?include=body`,
        options.signal
      );
      const chapter = { ...summary, ...payload.chapter };
      if (!chapter?.id) throw new Error(`Chapter ${summary.id} did not return offline content.`);
      offlineAssetNamesForChapter(chapter).forEach((name) => referencedAssetNames.add(name));
      downloadedBytes += JSON.stringify(payload).length;
      await writeDownloadedChapter(installID, chapter);
      completed += 1;
      options.onProgress?.({
        completed,
        total: chapters.length,
        percent: Math.round((completed / chapters.length) * 100),
        phase: "Downloading codes",
        unit: "chapters"
      });
    });
    downloadedBytes += await cacheOfflineAssets([...referencedAssetNames].sort(), {
      onProgress: options.onProgress,
      signal: options.signal
    });
    const sectionCount = chapters.reduce((count, chapter) => count + Number(chapter.sectionCount || 0), 0);
    await activateInstall({
      installID,
      codeVersion: options.codeVersion || defaultCodeVersion,
      assetVersion: offlineAssetVersion,
      downloadedAt,
      chapterCount: chapters.length,
      sectionCount,
      downloadedBytes
    });
    try {
      await navigator.storage?.persist?.();
    } catch {
      // Persistent storage is a browser preference; the completed library is still usable.
    }
    return offlineLibraryStatus();
  } catch (error) {
    await deleteInstall(installID).catch(() => {});
    throw error;
  }
}

export async function offlineLibraryStatus() {
  const record = await metadataRecord();
  if (!record?.installID) {
    return { available: false, supported: typeof indexedDB !== "undefined" };
  }
  return {
    ...record,
    available: true,
    supported: true
  };
}

export async function saveOfflineSyncSnapshot(userID, content) {
  const normalizedUserID = String(userID || "").trim();
  if (!normalizedUserID || !content || typeof indexedDB === "undefined") return false;
  const library = await metadataRecord();
  if (!library?.installID) return false;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(syncSnapshotsStoreName, "readwrite");
    transaction.objectStore(syncSnapshotsStoreName).put({
      userID: normalizedUserID,
      savedAt: new Date().toISOString(),
      content: {
        userID: normalizedUserID,
        pulledAt: content.pulledAt || null,
        latestEventID: content.latestEventID ?? null,
        contentMapVersion: Number(content.contentMapVersion || 0),
        entitlement: content.entitlement || null,
        mutations: Array.isArray(content.mutations) ? content.mutations : []
      }
    });
    await transactionComplete(transaction, "Could not save the offline account snapshot.");
    return true;
  } finally {
    database.close();
  }
}

export async function loadOfflineSyncSnapshot(userID) {
  const normalizedUserID = String(userID || "").trim();
  if (!normalizedUserID || typeof indexedDB === "undefined") return null;
  const library = await metadataRecord();
  if (!library?.installID) return null;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(syncSnapshotsStoreName, "readonly");
    const record = await requestResult(
      transaction.objectStore(syncSnapshotsStoreName).get(normalizedUserID),
      "Could not read the offline account snapshot."
    );
    return record?.content || null;
  } finally {
    database.close();
  }
}

export async function removeOfflineLibrary() {
  cachedSearchInstallID = "";
  cachedSearchSections = null;
  if (typeof indexedDB !== "undefined") {
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(databaseName);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error("Could not remove offline code storage."));
      request.onblocked = () => reject(new Error("Close other Permitext tabs before removing offline codes."));
    });
  }
  if ("caches" in window) {
    await Promise.all((await caches.keys())
      .filter((name) => name.startsWith("permitext-pro-"))
      .map((name) => caches.delete(name)));
  }
}

export async function disableOfflineFeature() {
  let removalError = null;
  try {
    await removeOfflineLibrary();
  } catch (error) {
    removalError = error;
  }
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations
      .filter((registration) => registration.scope === `${window.location.origin}/`)
      .map((registration) => registration.unregister()));
  }
  if (removalError) throw removalError;
}

export async function reconcileOfflineFeatureAccess(isPro) {
  if (!isPro) {
    await disableOfflineFeature();
    return;
  }
  const status = await offlineLibraryStatus();
  if (status.available) await prepareOfflineShell();
}

async function activeChapterRecords(installID) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(chaptersStoreName, "readonly");
    return await requestResult(
      transaction.objectStore(chaptersStoreName).index("installID").getAll(installID),
      "Could not read offline chapters."
    ) || [];
  } finally {
    database.close();
  }
}

async function activeSectionRecords(installID) {
  if (cachedSearchInstallID === installID && cachedSearchSections) return cachedSearchSections;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(sectionsStoreName, "readonly");
    const records = await requestResult(
      transaction.objectStore(sectionsStoreName).index("installID").getAll(installID),
      "Could not read offline sections."
    ) || [];
    cachedSearchInstallID = installID;
    cachedSearchSections = records;
    return records;
  } finally {
    database.close();
  }
}

async function sectionByIdentity(installID, sectionID) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(sectionsStoreName, "readonly");
    return await requestResult(
      transaction.objectStore(sectionsStoreName).index("identities").get(`${installID}:${sectionID}`),
      "Could not read an offline section."
    ) || null;
  } finally {
    database.close();
  }
}

function sectionSummary(record, requestedID = null) {
  if (!record) return null;
  return {
    id: record.id,
    webSectionID: record.webSectionID,
    chapterID: record.chapterID,
    codePrefix: record.codePrefix,
    codeSectionID: record.codeSectionID,
    chapterNumber: record.chapterNumber,
    sectionNumber: record.sectionNumber,
    title: record.title,
    headerLine: record.headerLine,
    headingLine: record.headingLine,
    ...(requestedID ? { requestedID } : {})
  };
}

function sectionPayload(record) {
  return {
    blocks: record.blocks || [],
    chapterID: record.chapterID,
    chapterNumber: record.chapterNumber,
    codePrefix: record.codePrefix,
    schemaVersion: 1,
    sectionID: Number(record.id),
    sectionNumber: record.sectionNumber,
    title: record.title,
    webSectionID: record.webSectionID
  };
}

function tokenizeSearchText(text) {
  const tokens = [];
  let current = "";
  const flush = () => {
    if (current.length >= 2) tokens.push(current);
    current = "";
  };
  for (const character of String(text || "").toLowerCase()) {
    if (/\s/u.test(character)) {
      flush();
    } else if (/[\p{L}\p{N}]/u.test(character) || character === "." || character === "-") {
      current += character;
    } else {
      flush();
    }
  }
  flush();
  return tokens;
}

function searchSnippet(text, query) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  const index = normalized.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return normalized.slice(0, 220);
  const start = Math.max(0, index - 80);
  const end = Math.min(normalized.length, index + query.length + 150);
  return `${start > 0 ? "..." : ""}${normalized.slice(start, end)}${end < normalized.length ? "..." : ""}`;
}

function compareChapterNumbers(left, right) {
  return String(left || "").localeCompare(String(right || ""), undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

export function compareOfflineChapters(left, right) {
  return String(left?.codePrefix || "").localeCompare(String(right?.codePrefix || "")) ||
    compareChapterNumbers(left?.chapterNumber, right?.chapterNumber) ||
    Number(left?.id) - Number(right?.id);
}

async function offlineSearch(installID, url) {
  const query = url.searchParams.get("q")?.trim() || "";
  if (query.length < 2) return { query, results: [] };
  const tokens = tokenizeSearchText(query);
  if (!tokens.length) return { query, results: [] };
  const codeFilter = new Set(
    (url.searchParams.get("code") || url.searchParams.get("codes") || "")
      .split(",")
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean)
  );
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") || "", 10);
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 500) : 0;
  const normalizedQuery = query.toLowerCase();
  const matches = (await activeSectionRecords(installID))
    .filter((section) =>
      (codeFilter.size === 0 || codeFilter.has(section.codePrefix)) &&
      tokens.every((token) => section.searchText.includes(token))
    )
    .map((section) => {
      const number = String(section.sectionNumber || "").toLowerCase();
      const title = String(section.title || "").toLowerCase();
      const rank = number === normalizedQuery ? 0 : number.startsWith(normalizedQuery) ? 1 : title.includes(normalizedQuery) ? 2 : 3;
      return { section, rank };
    })
    .sort((left, right) =>
      left.rank - right.rank ||
      compareChapterNumbers(left.section.chapterNumber, right.section.chapterNumber) ||
      String(left.section.sectionNumber).localeCompare(String(right.section.sectionNumber), undefined, {
        numeric: true,
        sensitivity: "base"
      }) ||
      Number(left.section.id) - Number(right.section.id)
    );
  const totalResults = matches.length;
  const selected = limit ? matches.slice(0, limit) : matches;
  return {
    query,
    totalResults,
    limited: Boolean(limit && totalResults > selected.length),
    results: selected.map(({ section }) => ({
      id: section.id,
      chapterID: section.chapterID,
      codePrefix: section.codePrefix,
      chapterNumber: section.chapterNumber,
      sectionNumber: section.sectionNumber,
      title: section.title,
      headerLine: section.headerLine,
      headingLine: section.headingLine,
      snippet: searchSnippet(section.plainText || section.title, query)
    }))
  };
}

export async function offlineAPI(path) {
  const metadata = await metadataRecord();
  if (!metadata?.installID) return null;
  const url = new URL(path, window.location.origin);
  if (url.pathname === "/code/chapters") {
    const codePrefix = url.searchParams.get("code")?.trim().toUpperCase();
    const chapters = (await activeChapterRecords(metadata.installID))
      .map((record) => {
        const chapter = record.chapter;
        return {
          id: chapter.id,
          codePrefix: chapter.codePrefix,
          codeSectionID: chapter.codeSectionID,
          chapterNumber: chapter.chapterNumber,
          displayTitle: chapter.displayTitle,
          fullTitle: chapter.fullTitle,
          title: chapter.title,
          groupCount: chapter.groups?.length || 0,
          sectionCount: chapter.sections?.length || 0
        };
      })
      .filter((chapter) => !codePrefix || chapter.codePrefix === codePrefix)
      .sort(compareOfflineChapters);
    return { chapters };
  }
  const chapterMatch = url.pathname.match(/^\/code\/chapters\/([a-zA-Z0-9_-]+)$/);
  if (chapterMatch) {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(chaptersStoreName, "readonly");
      const record = await requestResult(
        transaction.objectStore(chaptersStoreName).get(`${metadata.installID}:${chapterMatch[1]}`),
        "Could not read an offline chapter."
      );
      return record?.chapter ? { chapter: record.chapter } : null;
    } finally {
      database.close();
    }
  }
  if (url.pathname === "/code/sections") {
    const ids = (url.searchParams.get("ids") || "").split(",").map((value) => value.trim()).filter(Boolean);
    const records = await Promise.all(ids.map((id) => sectionByIdentity(metadata.installID, id)));
    return {
      sections: records.map((record, index) => sectionSummary(record, ids[index])).filter(Boolean)
    };
  }
  const sectionMatch = url.pathname.match(/^\/code\/sections\/(\d+)$/);
  if (sectionMatch) {
    const record = await sectionByIdentity(metadata.installID, sectionMatch[1]);
    return record ? { section: sectionPayload(record) } : null;
  }
  if (url.pathname === "/code/search") {
    return offlineSearch(metadata.installID, url);
  }
  return null;
}

export const offlineFeatureMetadata = {
  assetVersion: offlineAssetVersion,
  estimatedDownload: "about 70 MB",
  shellAssetVersion,
  shellCacheName
};
