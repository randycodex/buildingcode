#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const ADMIN_ARCHIVE_URL =
  "https://files.amlegal.com/pdffiles/NewYorkCity/Admin/XML.zip";
const CODE_LIBRARY_URL =
  "https://codelibrary.amlegal.com/codes/newyorkcity/latest/overview";

const ADMIN_COLLECTIONS = [
  {
    id: "nyc-admin-title-24",
    itemNumbers: [13, 15],
    name: "Administrative Code Title 24 — Environmental Protection and Utilities",
    nodeID: 42985,
    nextNodeID: 45639,
    sourceURL:
      "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-42985",
    scopeNotes:
      "Includes the enacted Noise Control Code and other construction-related Title 24 provisions.",
  },
  {
    id: "nyc-admin-title-25",
    itemNumbers: [14, 15],
    name: "Administrative Code Title 25 — Land Use",
    nodeID: 45639,
    nextNodeID: 46907,
    sourceURL:
      "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-45639",
    scopeNotes:
      "Includes the enacted Landmarks Preservation Law and other construction-related Title 25 provisions.",
  },
  {
    id: "nyc-admin-title-26",
    itemNumbers: [15],
    name: "Administrative Code Title 26 — Housing and Buildings",
    nodeID: 46907,
    nextNodeID: 48176,
    sourceURL:
      "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-46907",
  },
  {
    id: "nyc-admin-title-27",
    itemNumbers: [11, 12, 15],
    name: "Administrative Code Title 27 — Construction and Maintenance",
    nodeID: 48176,
    nextNodeID: 207300,
    sourceURL:
      "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-48176",
    scopeNotes:
      "Includes the historical 1968 Building Code, Housing Maintenance Code, and remaining enacted Title 27 construction provisions.",
  },
  {
    id: "nyc-admin-title-28",
    itemNumbers: [2, 15],
    name: "Administrative Code Title 28 — New York City Construction Codes",
    nodeID: 207300,
    nextNodeID: 230271,
    sourceURL:
      "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-207300",
    importMode: "reconcile-with-existing",
    scopeNotes:
      "Reconcile enacted amendments with Permitext's existing General Administrative Provisions; do not create a duplicate code library.",
  },
  {
    id: "nyc-admin-title-29",
    itemNumbers: [10],
    name: "Administrative Code Title 29 — New York City Fire Code",
    nodeID: 230271,
    nextNodeID: 111265,
    sourceURL:
      "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-230271",
  },
  {
    id: "nyc-admin-appendix-a",
    itemNumbers: [16, 17],
    name: "Administrative Code Appendix A — Unconsolidated Local Laws",
    nodeID: 115120,
    nextNodeID: null,
    sourceURL:
      "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-115120",
    scopeNotes:
      "Filter to enacted construction-related amendments, supplements, transition clauses, applicability provisions, and effective-date provisions.",
  },
];

const SEPARATELY_PUBLISHED_ENACTED_TEXT = [
  {
    itemNumber: 7,
    id: "nyc-energy-conservation-code",
    name: "2025 NYC Energy Conservation Code",
    permitextStatus: "missing",
    sourceType: "official-nyc-dob-enacted-code",
    sourceURL:
      "https://www.nyc.gov/site/buildings/codes/2025-energy-conservation-code.page",
    effectiveDate: "2026-03-30",
  },
  {
    itemNumber: 8,
    id: "nyc-electrical-code",
    name: "NYC Electrical Code",
    permitextStatus: "missing",
    sourceType: "official-nyc-dob-enacted-code",
    sourceURL: "https://www.nyc.gov/site/buildings/codes/electrical-code.page",
  },
  {
    itemNumber: 9,
    id: "nyc-existing-building-code",
    name: "NYC Existing Building Code",
    permitextStatus: "missing-future-effective",
    sourceType: "enacted-local-law-and-official-nyc-dob",
    sourceURL:
      "https://www.nyc.gov/site/buildings/codes/existing-building-code.page",
    enactedDate: "2026-01-17",
    effectiveDate: "2027-07-17",
  },
  {
    itemNumber: 16,
    id: "nyc-construction-local-laws",
    name: "NYC Local Laws that amend or supplement the enacted codes",
    permitextStatus: "missing-index",
    sourceType: "official-nyc-dob-and-nyc-council-enactments",
    sourceURL: "https://www.nyc.gov/site/buildings/codes/local-laws.page",
  },
];

const EXISTING_ITEMS = [
  { itemNumber: 1, name: "NYC Zoning Resolution", permitextStatus: "present" },
  {
    itemNumber: 2,
    name: "NYC General Administrative Provisions",
    permitextStatus: "present-reconcile-current-amendments",
  },
  { itemNumber: 3, name: "NYC Building Code", permitextStatus: "present" },
  { itemNumber: 4, name: "NYC Plumbing Code", permitextStatus: "present" },
  { itemNumber: 5, name: "NYC Mechanical Code", permitextStatus: "present" },
  { itemNumber: 6, name: "NYC Fuel Gas Code", permitextStatus: "present" },
];

const EXCLUDED_MATERIAL = [
  "Rules of the City of New York and all RCNY agency rules",
  "DOB, FDNY, and other agency guidance, bulletins, manuals, interpretations, and FAQs",
  "New York State laws and regulations unless enacted into the NYC text itself",
  "Federal laws and regulations unless enacted into the NYC text itself",
  "Referenced model codes, technical standards, and private standards not enacted into the NYC text itself",
  "Publisher annotations, highlighters, front matter, styling, and editorial material",
];

function usage() {
  return [
    "Usage:",
    "  node scripts/inventory-nyc-legal-expansion.mjs \\",
    "    --admin-dir /path/to/Admin/XML \\",
    "    [--admin-zip /path/to/Admin/XML.zip] \\",
    "    [--write /path/to/catalog.json]",
    "",
    "The script inventories NYC-enacted text only. It does not inventory RCNY",
    "rules or copy American Legal text into Permitext content packages.",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === "--help" || key === "-h") {
      args.help = true;
      continue;
    }
    if (!key.startsWith("--")) {
      throw new Error(`Unexpected argument: ${key}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${key}`);
    }
    args[key.slice(2)] = value;
    index += 1;
  }
  return args;
}

function firstRecordNumber(xml) {
  const match = xml.match(/<RECORD\b[^>]*\bnumber="(\d+)"/);
  return match ? Number(match[1]) : null;
}

function normalizeText(value) {
  return value
    .replace(/<LINEBRK\s*\/>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#160;|&nbsp;/g, " ")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function statedCurrency(xml) {
  const match = xml.match(/Current through[\s\S]*?<\/CHARFORMAT>/i);
  return match ? normalizeText(match[0]) : null;
}

async function sha256File(filePath) {
  if (!filePath) return null;
  const data = await readFile(resolve(filePath));
  return createHash("sha256").update(data).digest("hex");
}

async function buildFileIndex(directory) {
  const absoluteDirectory = resolve(directory);
  const names = (await readdir(absoluteDirectory))
    .filter((name) => name.toLowerCase().endsWith(".xml"))
    .sort((left, right) => left.localeCompare(right));
  const entries = [];

  for (const name of names) {
    const filePath = join(absoluteDirectory, name);
    const xml = await readFile(filePath, "utf8");
    const recordNumber = firstRecordNumber(xml);
    if (!Number.isFinite(recordNumber)) continue;
    entries.push({
      fileName: name,
      recordNumber,
      bytes: Buffer.byteLength(xml),
      recordCount: (xml.match(/<RECORD\b/g) ?? []).length,
      sectionCount: (
        xml.match(/<LEVEL\b[^>]*\bstyle-name="Section"/g) ?? []
      ).length,
      contentHash: createHash("sha256").update(xml).digest("hex"),
    });
  }

  return entries;
}

async function rootRecordNumber(directory, nodeID) {
  const filePath = join(resolve(directory), `0-0-0-${nodeID}.xml`);
  const xml = await readFile(filePath, "utf8");
  const value = firstRecordNumber(xml);
  if (!Number.isFinite(value)) {
    throw new Error(`Missing first record number in ${filePath}`);
  }
  return value;
}

async function inventoryCollection(collection, directory, index) {
  const startRecordNumber = await rootRecordNumber(directory, collection.nodeID);
  const endRecordNumber =
    collection.nextNodeID == null
      ? Number.POSITIVE_INFINITY
      : await rootRecordNumber(directory, collection.nextNodeID);
  const files = index.filter(
    (entry) =>
      entry.recordNumber >= startRecordNumber &&
      entry.recordNumber < endRecordNumber,
  );
  if (files.length === 0) {
    throw new Error(`No XML documents found for ${collection.name}`);
  }

  const digest = createHash("sha256");
  for (const file of files) {
    digest.update(file.fileName);
    digest.update("\0");
    digest.update(file.contentHash);
    digest.update("\n");
  }

  return {
    id: collection.id,
    itemNumbers: collection.itemNumbers,
    name: collection.name,
    permitextStatus:
      collection.importMode === "reconcile-with-existing"
        ? "missing-current-consolidation"
        : "missing",
    sourceType: "nyc-law-department-contracted-administrative-code-library",
    sourceURL: collection.sourceURL,
    sourceNodeID: collection.nodeID,
    importMode: collection.importMode ?? "new-library",
    scopeNotes: collection.scopeNotes ?? null,
    startRecordNumber,
    endRecordNumber:
      endRecordNumber === Number.POSITIVE_INFINITY ? null : endRecordNumber,
    documentCount: files.length,
    recordCount: files.reduce((sum, file) => sum + file.recordCount, 0),
    sectionCount: files.reduce((sum, file) => sum + file.sectionCount, 0),
    sourceBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    sourceSetHash: digest.digest("hex"),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (!args["admin-dir"]) {
    throw new Error(`--admin-dir is required.\n\n${usage()}`);
  }

  const adminDirectory = resolve(args["admin-dir"]);
  const adminIndex = await buildFileIndex(adminDirectory);
  const adminRoot = await readFile(
    join(adminDirectory, "0-0-0-1.xml"),
    "utf8",
  );
  const adminCollections = await Promise.all(
    ADMIN_COLLECTIONS.map((collection) =>
      inventoryCollection(collection, adminDirectory, adminIndex),
    ),
  );

  const output = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    purpose:
      "Inventory the 17 authorized NYC-enacted construction-related text categories without duplicating Permitext's existing libraries.",
    enactedTextScope: {
      inclusionRule:
        "Include only text enacted by New York City as a code, Administrative Code provision, Local Law, or unconsolidated enactment.",
      excludedMaterial: EXCLUDED_MATERIAL,
    },
    sourcePolicy: {
      codeLibraryRole:
        "Discovery, hierarchy extraction, currency tracking, and verification. Do not publish American Legal editorial material, styling, or annotations.",
      enactedTextPublicationGate:
        "Before publishing text derived from an American Legal bulk archive, confirm reuse rights or replace it with the corresponding enacted law or first-party NYC publication.",
    },
    snapshot: {
      administrativeCode: {
        overviewURL: CODE_LIBRARY_URL,
        archiveURL: ADMIN_ARCHIVE_URL,
        archiveFileName: args["admin-zip"]
          ? basename(args["admin-zip"])
          : null,
        archiveSHA256: await sha256File(args["admin-zip"]),
        statedCurrency: statedCurrency(adminRoot),
        xmlDocumentCount: adminIndex.length,
      },
    },
    alreadyPresentInPermitext: EXISTING_ITEMS,
    missingEnactedText: [
      ...adminCollections,
      ...SEPARATELY_PUBLISHED_ENACTED_TEXT,
    ],
  };

  const coveredItemNumbers = new Set([
    ...EXISTING_ITEMS.map((item) => item.itemNumber),
    ...output.missingEnactedText.flatMap((item) =>
      item.itemNumbers ? item.itemNumbers : [item.itemNumber],
    ),
  ]);
  const uncoveredItemNumbers = Array.from({ length: 17 }, (_, index) => index + 1)
    .filter((itemNumber) => !coveredItemNumbers.has(itemNumber));
  if (uncoveredItemNumbers.length > 0) {
    throw new Error(
      `Authorized enacted-text items are not accounted for: ${uncoveredItemNumbers.join(", ")}`,
    );
  }
  output.requestedItemCoverage = {
    requestedRange: "1-17",
    coveredItemCount: coveredItemNumbers.size,
    uncoveredItemNumbers,
  };

  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  if (args.write) {
    await writeFile(resolve(args.write), serialized);
    process.stdout.write(`Wrote ${resolve(args.write)}\n`);
  } else {
    process.stdout.write(serialized);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
