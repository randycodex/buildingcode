import { access, readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const workspaceRoot = dirname(serverRoot);
const canonicalRoot = join(
  workspaceRoot,
  "NYC CC APP",
  "permitext",
  "Resources",
  "CodeContent",
  "authored",
  "new-york-city",
  "2022-construction-codes"
);
const canonicalSectionRoot = join(canonicalRoot, "prepared", "sections");
const legacySectionRoot = join(
  workspaceRoot,
  "NYC CC APP",
  "NYCCCApp",
  "Resources",
  "CodeContent",
  "authored",
  "new-york-city",
  "2022-construction-codes",
  "prepared",
  "sections"
);
const zoningRoot = join(
  workspaceRoot,
  "NYC CC APP",
  "permitext",
  "Resources",
  "CodeContent",
  "authored",
  "new-york-city",
  "2026-zoning-resolution"
);
const minimumPublishedBodyFiles = 20_211;
const minimumZoningChapterFiles = 117;
const minimumZoningSectionFiles = 4_068;
const minimumZoningAssetFiles = 423;

async function requiredFile(path) {
  await access(path);
  const details = await stat(path);
  if (!details.isFile() || details.size === 0) {
    throw new Error(`Required deploy content is empty: ${path}`);
  }
}

async function jsonFileCount(path) {
  return (await readdir(path)).filter((name) => name.endsWith(".json")).length;
}

await Promise.all([
  requiredFile(join(canonicalRoot, "bundle.json")),
  requiredFile(join(canonicalRoot, "prepared", "manifest.json")),
  requiredFile(join(canonicalRoot, "prepared", "searchIndex.json")),
  requiredFile(join(zoningRoot, "bundle.json")),
  requiredFile(join(zoningRoot, "source-manifest.json")),
  requiredFile(join(zoningRoot, "prepared", "manifest.json")),
  requiredFile(join(zoningRoot, "prepared", "searchIndex.json"))
]);

const [
  canonicalBodyFiles,
  legacyBodyFiles,
  zoningChapterFiles,
  zoningSectionFiles,
  zoningAssetFiles
] = await Promise.all([
  jsonFileCount(canonicalSectionRoot),
  jsonFileCount(legacySectionRoot),
  jsonFileCount(join(zoningRoot, "prepared", "chapters")),
  jsonFileCount(join(zoningRoot, "prepared", "sections")),
  readdir(join(zoningRoot, "assets")).then((files) => files.length)
]);
const publishedBodyFiles = canonicalBodyFiles + legacyBodyFiles;
if (publishedBodyFiles < minimumPublishedBodyFiles) {
  throw new Error(
    `Deploy content has ${publishedBodyFiles} section body files; expected at least ${minimumPublishedBodyFiles}.`
  );
}
if (
  zoningChapterFiles < minimumZoningChapterFiles ||
  zoningSectionFiles < minimumZoningSectionFiles ||
  zoningAssetFiles < minimumZoningAssetFiles
) {
  throw new Error(
    "Deploy content has an incomplete Zoning package: " +
      `${zoningChapterFiles} chapters, ${zoningSectionFiles} sections, ` +
      `${zoningAssetFiles} assets.`
  );
}

console.log("permitext deploy content passed", {
  canonicalBodyFiles,
  legacyBodyFiles,
  publishedBodyFiles,
  zoningChapterFiles,
  zoningSectionFiles,
  zoningAssetFiles
});
