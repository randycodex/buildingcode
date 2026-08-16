import { readFile } from "node:fs/promises";
import {
  allSectionCatalogByID,
  candidateSectionIDs,
  createRetryableLazyLoader,
  createSingleFlightInitializer,
  setBoundedLRUCacheValue,
  startupChapterSummary,
  syncBatchIncludesProjectMutation
} from "../app.mjs";
import { createPostgresSyncRepository } from "../postgres-sync-repository.mjs";
import {
  intersectCandidateIDsWithPosting,
  normalizedSortedPostingList
} from "../search-postings.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fakeSQL(strings, ...values) {
  return {
    text: strings.join("?"),
    values
  };
}

const transactions = [];
fakeSQL.transaction = async (queries, options) => {
  transactions.push({ queries, options });
  return queries.map((query) => {
    if (/INSERT INTO permitext_user_content_records/.test(query.text)) {
      return [{ record_id: "performance-user:saved:1" }];
    }
    if (/MAX\(event_id\)/.test(query.text)) {
      return [{ latest_event_id: 17 }];
    }
    if (/SELECT entitlement FROM permitext_entitlements/.test(query.text)) {
      return [{ entitlement: { plan: "pro" } }];
    }
    if (/SELECT\s+EXISTS/.test(query.text)) {
      return [{}];
    }
    return [];
  });
};

const repository = createPostgresSyncRepository(fakeSQL);
const pushResult = await repository.push("performance-user", [{
  savedItem: {
    id: "performance-user:saved:1",
    userID: "performance-user",
    codeVersion: "nyc-construction-codes-2022",
    sectionID: 11909,
    updatedAt: "2026-07-31T12:00:00.000Z"
  }
}]);

assert(
  transactions.length === 2,
  "A standard PostgreSQL push should use one write transaction and one final state read."
);
assert(
  transactions[0].queries.length === 4 &&
    transactions[0].queries.every((query) => !/MAX\(event_id\)|SELECT entitlement FROM permitext_entitlements/.test(query.text)),
  "The PostgreSQL write transaction still performs duplicate event-cursor or entitlement reads."
);
assert(
  transactions[1].queries.length === 2 &&
    transactions[1].queries.some((query) => /MAX\(event_id\)/.test(query.text)) &&
    transactions[1].queries.some((query) => /SELECT entitlement FROM permitext_entitlements/.test(query.text)),
  "The PostgreSQL push must read its final cursor and entitlement after all mutations finish."
);
assert(
  transactions[0].options?.isolationLevel === "Serializable" &&
    transactions[1].options?.isolationLevel === "RepeatableRead",
  "PostgreSQL transactions are not using the Neon isolationLevel option."
);
assert(
  pushResult.latestEventID === 17 && pushResult.entitlement?.plan === "pro",
  "The optimized PostgreSQL push lost its final sync state."
);

const firstCatalog = await allSectionCatalogByID();
const secondCatalog = await allSectionCatalogByID();
assert(firstCatalog === secondCatalog, "The immutable combined section catalog was rebuilt instead of reused.");
assert(firstCatalog.size > 10_000, "The combined section catalog omitted published code sections.");
assert(firstCatalog.get("11909")?.sectionNumber === "403.1", "The cached catalog lost canonical section lookup.");

const startupChapter = startupChapterSummary({
  id: "chapter-1",
  codePrefix: "BC",
  codeSectionID: "building-code",
  chapterNumber: "1",
  displayTitle: "Chapter 1",
  fullTitle: "Chapter 1: Administration",
  title: "Administration",
  sections: [{ id: "section-1", blocks: [{ plainText: "Large enacted body" }] }],
  groups: [{ id: "group-1" }]
});
assert(
  JSON.stringify(Object.keys(startupChapter).sort()) === JSON.stringify([
    "chapterNumber",
    "codePrefix",
    "codeSectionID",
    "displayTitle",
    "fullTitle",
    "id",
    "title"
  ]),
  "The startup chapter projection includes navigation bodies or omits required identity fields."
);
assert(
  !JSON.stringify(startupChapter).includes("Large enacted body"),
  "The startup chapter projection still transfers enacted section bodies."
);

const boundedCache = new Map();
setBoundedLRUCacheValue(boundedCache, "oldest", 1, 2);
setBoundedLRUCacheValue(boundedCache, "newer", 2, 2);
setBoundedLRUCacheValue(boundedCache, "oldest", 1, 2);
setBoundedLRUCacheValue(boundedCache, "newest", 3, 2);
assert(
  boundedCache.has("oldest") && boundedCache.has("newest") && !boundedCache.has("newer"),
  "The section-text cache does not evict the least recently used entry."
);

let schemaInitializationAttempts = 0;
let releaseSchemaInitialization;
const ensureSchemaOnce = createSingleFlightInitializer(() => {
  schemaInitializationAttempts += 1;
  return new Promise((resolve) => {
    releaseSchemaInitialization = resolve;
  });
});
const concurrentSchemaInitializations = [ensureSchemaOnce(), ensureSchemaOnce(), ensureSchemaOnce()];
await Promise.resolve();
assert(
  schemaInitializationAttempts === 1,
  "Concurrent cold requests can execute schema initialization more than once."
);
releaseSchemaInitialization();
await Promise.all(concurrentSchemaInitializations);
await ensureSchemaOnce();
assert(
  schemaInitializationAttempts === 1,
  "Successful schema initialization is not retained."
);

let retryableSchemaAttempts = 0;
const ensureRetryableSchema = createSingleFlightInitializer(async () => {
  retryableSchemaAttempts += 1;
  if (retryableSchemaAttempts === 1) throw new Error("temporary schema failure");
});
const failedSchemaInitializations = await Promise.allSettled([
  ensureRetryableSchema(),
  ensureRetryableSchema()
]);
assert(
  retryableSchemaAttempts === 1 &&
    failedSchemaInitializations.every(({ status }) => status === "rejected"),
  "A failed schema initialization was not shared by concurrent callers."
);
await ensureRetryableSchema();
await ensureRetryableSchema();
assert(
  retryableSchemaAttempts === 2,
  "Schema initialization does not retry once after a transient failure."
);

let lazyLoadAttempts = 0;
const retryableLazyLoader = createRetryableLazyLoader(async () => {
  lazyLoadAttempts += 1;
  if (lazyLoadAttempts === 1) throw new Error("temporary module failure");
  return { renderReportPDF: () => "ready" };
});
const failedLazyLoads = await Promise.allSettled([
  retryableLazyLoader(),
  retryableLazyLoader()
]);
assert(
  lazyLoadAttempts === 1 && failedLazyLoads.every(({ status }) => status === "rejected"),
  "Concurrent lazy module loads do not share their first attempt."
);
const loadedModule = await retryableLazyLoader();
assert(
  lazyLoadAttempts === 2 &&
    loadedModule.renderReportPDF() === "ready" &&
    (await retryableLazyLoader()) === loadedModule,
  "The lazy module loader did not reset after failure and cache the successful retry."
);

const arrayPostingIndex = new Map([
  ["fire", [1, 2, 3, 4]],
  ["rated", [2, 4]],
  ["403.1", [5]],
  ["403.10", [6, 7]]
]);
assert(
  JSON.stringify([...candidateSectionIDs(arrayPostingIndex, ["fire", "rated"], "fire rated", "fire rated")]) ===
    JSON.stringify([2, 4]),
  "Array-backed posting-list intersection changed multi-token search results."
);
assert(
  JSON.stringify([...candidateSectionIDs(arrayPostingIndex, ["missing"], "403.", "403.")]) ===
    JSON.stringify([5, 6, 7]),
  "Array-backed posting lists changed numeric or prefixed section lookup behavior."
);

const normalizedPosting = normalizedSortedPostingList([8, 2, 6, 4]);
assert(
  JSON.stringify(normalizedPosting) === JSON.stringify([2, 4, 6, 8]),
  "Posting-list normalization did not preserve numeric search ordering."
);
const largePosting = Array.from({ length: 100_000 }, (_, index) => index * 2);
let largePostingElementReads = 0;
const trackedLargePosting = new Proxy(largePosting, {
  get(target, property, receiver) {
    if (typeof property === "string" && /^\d+$/u.test(property)) {
      largePostingElementReads += 1;
    }
    return Reflect.get(target, property, receiver);
  }
});
assert(
  JSON.stringify([
    ...intersectCandidateIDsWithPosting(new Set([2, 99_999, 199_998]), trackedLargePosting)
  ]) === JSON.stringify([2, 199_998]),
  "Binary posting-list intersection changed candidate parity."
);
assert(
  largePostingElementReads < 100,
  `Posting-list intersection scanned the larger posting (${largePostingElementReads} reads).`
);

const appSource = await readFile(new URL("../app.mjs", import.meta.url), "utf8");
const webAppSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const postgresAdapterSource = appSource.slice(
  appSource.indexOf("async function createPostgresStoreAdapter()"),
  appSource.indexOf("async function storeAdapter()")
);
assert(
  !/^import\s+.*["']\.\/report-pdf\.mjs["'];?$/mu.test(appSource),
  "The main request module eagerly imports the PDF engine."
);
assert(
  (appSource.match(/import\("\.\/report-pdf\.mjs"\)/gu) || []).length === 1 &&
    appSource.includes(
      'const loadReportPDFModule = createRetryableLazyLoader(() => import("./report-pdf.mjs"));'
    ) &&
    (appSource.match(/await renderReportPDFOnDemand\(/gu) || []).length === 2,
  "PDF generation is not routed through one cached on-demand loader."
);
assert(
  postgresAdapterSource.includes("const ensureSchema = createSingleFlightInitializer(async () => {") &&
    postgresAdapterSource.includes(
      "const migrateLegacyStateIfNeeded = createSingleFlightInitializer(async () => {"
    ) &&
    !postgresAdapterSource.includes("let initialized = false;") &&
    !postgresAdapterSource.includes("let migrated = false;"),
  "PostgreSQL schema or legacy migration initialization is not protected by retryable single-flight."
);
assert(
  !appSource.includes(
    "return rateLimitRepository.consume(input);\n      return rateLimitRepository.consume(input);"
  ),
  "The PostgreSQL rate-limit adapter contains an unreachable duplicate consume call."
);
assert(
  appSource.includes("let cachedStoreAdapterPromise = null;") &&
    appSource.includes("return cachedStoreAdapterPromise;"),
  "Concurrent first requests can initialize duplicate store adapters."
);
assert(
  appSource.includes("listStoredFoundationArtifacts(userID, { ids: [normalizedCardID] })"),
  "Opening one Notebook Note still scans every foundation artifact."
);
assert(
  !webAppSource.includes("Promise.allSettled(cards.map(async (card) =>") &&
    webAppSource.includes(".slice(0, notebookIdlePrefetchLimit)"),
  "Notebook open still downloads every full Note instead of bounded idle snapshots."
);
assert(
  syncBatchIncludesProjectMutation([{ project: { id: "project-1" } }]) &&
    !syncBatchIncludesProjectMutation([{ savedItem: { id: "saved-1" } }]) &&
    !syncBatchIncludesProjectMutation([]),
  "The sync push optimization does not distinguish project activity from ordinary mutations."
);
assert(
  appSource.includes("const includesProjectMutation = syncBatchIncludesProjectMutation(incoming);") &&
    appSource.includes("const previousMutations = includesProjectMutation\n      ? (await readStore())") &&
    appSource.includes("if (includesProjectMutation) {\n      await recordMeaningfulSyncActivity("),
  "Ordinary PostgreSQL sync pushes still materialize the full store for project activity logging."
);

for (const sourceName of [
  "app.mjs",
  "postgres-account-repository.mjs",
  "postgres-organization-repository.mjs",
  "postgres-sync-repository.mjs"
]) {
  const source = await readFile(new URL(`../${sourceName}`, import.meta.url), "utf8");
  assert(!source.includes("isolationMode"), `${sourceName} still uses Neon's ignored isolationMode option.`);
}

for (const sourceName of [
  "app.mjs",
  "enacted-code-content.mjs",
  "existing-building-content.mjs",
  "zoning-content.mjs"
]) {
  const source = await readFile(new URL(`../${sourceName}`, import.meta.url), "utf8");
  assert(
    !source.includes("[token, new Set(ids)]") && !source.includes("[token, new Set(sectionIDs)]"),
    `${sourceName} expands every persisted posting list into a Set.`
  );
}

console.log("Permitext backend performance contract passed.");
