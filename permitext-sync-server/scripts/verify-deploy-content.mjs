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
const minimumPublishedBodyFiles = 20_211;

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
  requiredFile(join(canonicalRoot, "prepared", "searchIndex.json"))
]);

const [canonicalBodyFiles, legacyBodyFiles] = await Promise.all([
  jsonFileCount(canonicalSectionRoot),
  jsonFileCount(legacySectionRoot)
]);
const publishedBodyFiles = canonicalBodyFiles + legacyBodyFiles;
if (publishedBodyFiles < minimumPublishedBodyFiles) {
  throw new Error(
    `Deploy content has ${publishedBodyFiles} section body files; expected at least ${minimumPublishedBodyFiles}.`
  );
}

console.log("permitext deploy content passed", {
  canonicalBodyFiles,
  legacyBodyFiles,
  publishedBodyFiles
});
