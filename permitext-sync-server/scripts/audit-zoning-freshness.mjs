import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateZoningFreshness } from "../zoning-freshness.mjs";
import { zoningResolutionContract } from "../zoning-resolution.mjs";

function sourceFileArgument(argv) {
  const index = argv.indexOf("--source-file");
  if (index === -1) return null;
  if (!argv[index + 1]) throw new Error("--source-file requires a path.");
  return resolve(process.cwd(), argv[index + 1]);
}

async function officialHomepageHTML(sourceFile) {
  if (sourceFile) return readFile(sourceFile, "utf8");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(zoningResolutionContract.sourceHomepageURL, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "Permitext zoning freshness audit/1.0 (official-source read only)"
      },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

const sourceFile = sourceFileArgument(process.argv.slice(2));
const result = evaluateZoningFreshness({
  homepageHTML: await officialHomepageHTML(sourceFile)
});

console.info(JSON.stringify(result, null, 2));
if (!result.corpusFresh) process.exitCode = 1;

// Preserve an executable-file contract while allowing direct module inspection.
export const auditScriptPath = fileURLToPath(import.meta.url);
