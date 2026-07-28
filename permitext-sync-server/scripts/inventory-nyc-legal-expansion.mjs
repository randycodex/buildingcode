#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const ADMIN_ARCHIVE_URL =
  "https://files.amlegal.com/pdffiles/NewYorkCity/Admin/XML.zip";
const RULES_ARCHIVE_URL =
  "https://files.amlegal.com/pdffiles/NewYorkCity/Rules/XML.zip";
const CODE_LIBRARY_URL =
  "https://codelibrary.amlegal.com/codes/newyorkcity/latest/overview";

const ADMIN_COLLECTIONS = [
  {
    id: "nyc-admin-title-24",
    itemNumbers: [14, 15],
    name: "Administrative Code Title 24 — Environmental Protection and Utilities",
    nodeID: 42985,
    nextNodeID: 45639,
    sourceURL:
      "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-42985",
  },
  {
    id: "nyc-admin-title-25",
    itemNumbers: [13, 16],
    name: "Administrative Code Title 25 — Land Use",
    nodeID: 45639,
    nextNodeID: 46907,
    sourceURL:
      "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-45639",
  },
  {
    id: "nyc-admin-title-26",
    itemNumbers: [17],
    name: "Administrative Code Title 26 — Housing and Buildings",
    nodeID: 46907,
    nextNodeID: 48176,
    sourceURL:
      "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-46907",
  },
  {
    id: "nyc-admin-title-27",
    itemNumbers: [12, 18],
    name: "Administrative Code Title 27 — Construction and Maintenance",
    nodeID: 48176,
    nextNodeID: 207300,
    sourceURL:
      "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-48176",
  },
  {
    id: "nyc-admin-title-28",
    itemNumbers: [19, 35],
    name: "Administrative Code Title 28 — New York City Construction Codes",
    nodeID: 207300,
    nextNodeID: 230271,
    sourceURL:
      "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-207300",
    importMode: "reconcile-with-existing",
  },
  {
    id: "nyc-admin-title-29",
    itemNumbers: [8, 20],
    name: "Administrative Code Title 29 — New York City Fire Code",
    nodeID: 230271,
    nextNodeID: 111265,
    sourceURL:
      "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-230271",
  },
  {
    id: "nyc-admin-appendix-a",
    itemNumbers: [31, 32, 33, 34],
    name: "Administrative Code Appendix A — Unconsolidated Local Laws",
    nodeID: 115120,
    nextNodeID: null,
    sourceURL:
      "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-115120",
  },
];

const RULE_COLLECTIONS = [
  {
    id: "nyc-rcny-title-1",
    itemNumbers: [21],
    name: "Title 1 RCNY — Department of Buildings",
    nodeID: 5,
    nextNodeID: 6178,
    sourceURL:
      "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-5",
  },
  {
    id: "nyc-rcny-title-2",
    itemNumbers: [22],
    name: "Title 2 RCNY — Board of Standards and Appeals",
    nodeID: 6178,
    nextNodeID: 155659,
    sourceURL:
      "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-6178",
  },
  {
    id: "nyc-rcny-title-3",
    itemNumbers: [23],
    name: "Title 3 RCNY — Fire Department",
    nodeID: 155659,
    nextNodeID: 143983,
    sourceURL:
      "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-155659",
  },
  {
    id: "nyc-rcny-title-15",
    itemNumbers: [24],
    name: "Title 15 RCNY — Department of Environmental Protection",
    nodeID: 23189,
    nextNodeID: 30861,
    sourceURL:
      "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-23189",
  },
  {
    id: "nyc-rcny-title-28",
    itemNumbers: [25],
    name: "Title 28 RCNY — Housing Preservation and Development",
    nodeID: 53382,
    nextNodeID: 59441,
    sourceURL:
      "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-53382",
  },
  {
    id: "nyc-rcny-title-29",
    itemNumbers: [26],
    name: "Title 29 RCNY — Loft Board",
    nodeID: 59441,
    nextNodeID: 60849,
    sourceURL:
      "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-59441",
  },
  {
    id: "nyc-rcny-title-34",
    itemNumbers: [27],
    name: "Title 34 RCNY — Department of Transportation",
    nodeID: 61009,
    nextNodeID: 64985,
    sourceURL:
      "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-61009",
  },
  {
    id: "nyc-rcny-title-62",
    itemNumbers: [28],
    name: "Title 62 RCNY — City Planning",
    nodeID: 89143,
    nextNodeID: 89924,
    sourceURL:
      "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-89143",
  },
  {
    id: "nyc-rcny-title-63",
    itemNumbers: [29],
    name: "Title 63 RCNY — Landmarks Preservation Commission",
    nodeID: 89924,
    nextNodeID: 91253,
    sourceURL:
      "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-89924",
  },
];

const OTHER_REQUESTED_ITEMS = [
  {
    itemNumber: 6,
    id: "nyc-energy-conservation-code",
    name: "2025 NYC Energy Conservation Code",
    permitextStatus: "missing",
    sourceType: "official-nyc-dob",
    sourceURL:
      "https://www.nyc.gov/site/buildings/codes/2025-energy-conservation-code.page",
    effectiveDate: "2026-03-30",
  },
  {
    itemNumber: 7,
    id: "nyc-electrical-code",
    name: "NYC Electrical Code",
    permitextStatus: "missing",
    sourceType: "official-nyc-dob",
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
    itemNumber: 10,
    id: "nyc-prior-construction-codes",
    name: "Historical NYC construction codes",
    permitextStatus: "missing-partially-available-in-title-27",
    sourceType: "official-nyc-dob",
    sourceURL: "https://www.nyc.gov/site/buildings/codes/prior-codes.page",
    notes:
      "The Bulk XML Title 27 collection supplies the 1968 Building Code. Use DOB's Past Codes collection for the 1938, 2008, and 2014 editions.",
  },
  {
    itemNumber: 30,
    id: "nyc-construction-local-laws",
    name: "Construction-related NYC Local Laws",
    permitextStatus: "missing-index",
    sourceType: "official-nyc-dob-and-nyc-council",
    sourceURL: "https://www.nyc.gov/site/buildings/codes/local-laws.page",
  },
];

const EXISTING_ITEMS = [
  {
    itemNumber: 1,
    name: "General Administrative Provisions",
    permitextStatus: "present",
  },
  { itemNumber: 2, name: "NYC Building Code", permitextStatus: "present" },
  { itemNumber: 3, name: "NYC Plumbing Code", permitextStatus: "present" },
  { itemNumber: 4, name: "NYC Mechanical Code", permitextStatus: "present" },
  { itemNumber: 5, name: "NYC Fuel Gas Code", permitextStatus: "present" },
  { itemNumber: 11, name: "NYC Zoning Resolution", permitextStatus: "present" },
];

function usage() {
  return [
    "Usage:",
    "  node scripts/inventory-nyc-legal-expansion.mjs \\",
    "    --admin-dir /path/to/Admin/XML --rules-dir /path/to/Rules/XML \\",
    "    [--admin-zip /path/to/Admin/XML.zip] [--rules-zip /path/to/Rules/XML.zip] \\",
    "    [--write /path/to/catalog.json]",
    "",
    "The script inventories only metadata, hierarchy counts, and hashes. It does not",
    "copy American Legal text into Permitext content packages.",
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
      filePath,
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

async function inventoryCollection(collection, directory, index, sourceKind) {
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
    sourceType: sourceKind,
    sourceURL: collection.sourceURL,
    sourceNodeID: collection.nodeID,
    importMode: collection.importMode ?? "new-library",
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
  if (!args["admin-dir"] || !args["rules-dir"]) {
    throw new Error(`--admin-dir and --rules-dir are required.\n\n${usage()}`);
  }

  const adminDirectory = resolve(args["admin-dir"]);
  const rulesDirectory = resolve(args["rules-dir"]);
  const [adminIndex, rulesIndex] = await Promise.all([
    buildFileIndex(adminDirectory),
    buildFileIndex(rulesDirectory),
  ]);
  const [adminRoot, rulesRoot] = await Promise.all([
    readFile(join(adminDirectory, "0-0-0-1.xml"), "utf8"),
    readFile(join(rulesDirectory, "0-0-0-1.xml"), "utf8"),
  ]);
  const [adminCollections, ruleCollections] = await Promise.all([
    Promise.all(
      ADMIN_COLLECTIONS.map((collection) =>
        inventoryCollection(
          collection,
          adminDirectory,
          adminIndex,
          "nyc-law-department-contracted-code-library",
        ),
      ),
    ),
    Promise.all(
      RULE_COLLECTIONS.map((collection) =>
        inventoryCollection(
          collection,
          rulesDirectory,
          rulesIndex,
          "nyc-law-department-contracted-code-library",
        ),
      ),
    ),
  ]);

  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    purpose:
      "Inventory requested NYC construction-related enacted law and binding rules not already bundled in Permitext.",
    sourcePolicy: {
      codeLibraryRole:
        "Discovery, hierarchy extraction, currency tracking, and verification. Do not publish American Legal editorial material, styling, or annotations.",
      enactedTextPublicationGate:
        "Before publishing text derived from an American Legal bulk archive, confirm reuse rights or replace it with an official agency or enacted-law source.",
    },
    snapshots: {
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
      rules: {
        overviewURL: CODE_LIBRARY_URL,
        archiveURL: RULES_ARCHIVE_URL,
        archiveFileName: args["rules-zip"]
          ? basename(args["rules-zip"])
          : null,
        archiveSHA256: await sha256File(args["rules-zip"]),
        statedCurrency: statedCurrency(rulesRoot),
        xmlDocumentCount: rulesIndex.length,
      },
    },
    alreadyPresentInPermitext: EXISTING_ITEMS,
    missingCollections: [
      ...adminCollections,
      ...ruleCollections,
      ...OTHER_REQUESTED_ITEMS,
    ],
  };
  const coveredItemNumbers = new Set([
    ...EXISTING_ITEMS.map((item) => item.itemNumber),
    ...output.missingCollections.flatMap((item) =>
      item.itemNumbers ? item.itemNumbers : [item.itemNumber],
    ),
  ]);
  const uncoveredItemNumbers = Array.from({ length: 35 }, (_, index) => index + 1)
    .filter((itemNumber) => !coveredItemNumbers.has(itemNumber));
  if (uncoveredItemNumbers.length > 0) {
    throw new Error(
      `Requested expansion items are not accounted for: ${uncoveredItemNumbers.join(", ")}`,
    );
  }
  output.requestedItemCoverage = {
    requestedRange: "1-35",
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
