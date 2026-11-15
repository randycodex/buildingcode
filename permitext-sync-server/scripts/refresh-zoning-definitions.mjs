import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { extractDefinitionEntries } from "../reader-definition-index.mjs";
import { bindZoningApplicability } from "./definition-sources/bind-zoning-applicability.mjs";
import { compileDefinitionRegistry } from "./build-reader-definition-registry.mjs";

// Refresh this source only; preserve the independently reviewed bindings for
// other codes. The applicability guards require explicit source review first.
const root = new URL("../../NYC CC APP/permitext/Resources/CodeContent/", import.meta.url);
const sourceFile = "2026-zoning-resolution/chapters/I-2.html";
const source = await readFile(new URL(`authored/new-york-city/${sourceFile}`, root), "utf8");
const application = await readFile(new URL("authored/new-york-city/2026-zoning-resolution/chapters/II-3.html", root), "utf8");
const target = new URL("../public/reader-definition-registry.json", import.meta.url);
const registry = JSON.parse(await readFile(target, "utf8"));
const index = registry.books.findIndex(book => book.bundle === "2026-zoning-resolution" && book.codeSectionID === 1);
assert(index >= 0);
const previous = registry.books[index];
const book = { ...previous, chapter: previous.definitionChapter,
  sourceSHA256: createHash("sha256").update(source).digest("hex"),
  terms: extractDefinitionEntries(source, { definitionChapter: true }).map(term => ({ ...term,
    bundle: previous.bundle, code: previous.code, codeSectionID: 1, scope: previous.scope,
    applicability: "review-required", chapterID: previous.chapterID,
    chapter: previous.definitionChapter, sourceFile, resolution: "direct" })) };
book.terms = bindZoningApplicability(book, source, application);
const updated = compileDefinitionRegistry({ books: [book] }).books[0];
assert.equal(updated.entries.length, previous.entries.length, "Definition inventory changed; review additions/removals before publishing");
registry.books[index] = updated;
const serialized = JSON.stringify(registry) + "\n";
await writeFile(target, serialized);
await writeFile(new URL("reader-definition-registry.json", root), serialized);
console.info(`Refreshed ${updated.entries.length} Zoning definitions for web and iPhone.`);
