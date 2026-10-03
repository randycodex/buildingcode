import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { inlineCodeReferencePhrases } from "../public/code-references.js";

const source = await readFile(new URL("../app.mjs", import.meta.url), "utf8");
const start = source.indexOf("export function researchAssemblyCrossReferences(");
const end = source.indexOf("async function resolveResearchAssemblySection(", start);
assert(start >= 0 && end > start);
const actualCallback = vm.runInNewContext(
  `(${source.slice(start, end).replace(/^export /, "").trim()})`,
  { inlineCodeReferencePhrases }
);
const resolve = (evidence, catalog) => JSON.parse(JSON.stringify(actualCallback(evidence, catalog)));
const range = "FC 906.9.1 through 906.9.3";
assert.equal(inlineCodeReferencePhrases(range).length, 0,
  "Research grammar must not change the browser's supported link destinations.");
const explicit = inlineCodeReferencePhrases(range, { includeFireCode: true });
assert.equal(explicit[0].codePrefix, "FC");
assert.deepEqual(explicit[0].references.map(item => item.sectionNumber), ["906.9.1", "906.9.3"]);
assert.equal(inlineCodeReferencePhrases("FGC 404.11.4", { includeFireCode: true })[0].codePrefix, "FGC");
assert.equal(inlineCodeReferencePhrases("FC Table 6109.12", { includeFireCode: true })[0].kind, "table");

const evidence = { text: range, codePrefix: "FC", corpusID: "fire-current", codeVersion: "2022" };
const catalog = [
  { id: "old", codePrefix: "FC", corpusID: "fire-current", codeVersion: "2014", sectionNumber: "906.9.3" },
  { id: "foreign", codePrefix: "FC", corpusID: "foreign-city", codeVersion: "2022", sectionNumber: "906.9.3" },
  { id: "other-family", codePrefix: "BC", corpusID: "fire-current", codeVersion: "2022", sectionNumber: "906.9.3" },
  { id: "first", codePrefix: "FC", corpusID: "fire-current", codeVersion: "2022", sectionNumber: "906.9.1" },
  { id: "last", codePrefix: "FC", corpusID: "fire-current", codeVersion: "2022", sectionNumber: "906.9.3" }
];
assert.deepEqual(resolve(evidence, catalog).map(item => item.sectionID), ["first", "last"]);
assert.deepEqual(resolve({ ...evidence, text: "Sections 906.9.1 through 906.9.3" }, catalog)
  .map(item => item.sectionID), ["first", "last"]);
assert(resolve(evidence, catalog.slice(0, 3)).every(item => item.sectionID === ""),
  "A recognized reference must not substitute a foreign corpus, edition, or code family.");
assert.equal(resolve({ ...evidence, text: "FC Table 6109.12" }, []).at(0).referenceKind, "table");
assert.equal(resolve({ ...evidence, text: "BC 906.9.3" }, catalog).at(0).codePrefix, "BC",
  "An explicit different prefix must not be rewritten to the source's family.");
console.log("Research Fire Code reference scope contract passed");
