import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [appSource, searchViewSource] = await Promise.all([
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../../NYC CC APP/permitext/Views/SearchView.swift", import.meta.url), "utf8")
]);

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist.`);
  const parametersStart = source.indexOf("(", start);
  let parameterDepth = 0;
  let parametersEnd = -1;
  for (let index = parametersStart; index < source.length; index += 1) {
    if (source[index] === "(") parameterDepth += 1;
    if (source[index] === ")") parameterDepth -= 1;
    if (parameterDepth === 0) {
      parametersEnd = index;
      break;
    }
  }
  const bodyStart = source.indexOf("{", parametersEnd);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not parse ${name}.`);
}

const searchProgressLabel = new Function(
  `${functionSource(appSource, "searchProgressLabel")}; return searchProgressLabel;`
)();
const searchGroupCountText = new Function(
  `${functionSource(appSource, "searchGroupCountText")}; return searchGroupCountText;`
)();

assert.equal(searchProgressLabel(null, { status: "searching" }), "Searching…");
assert.equal(searchProgressLabel(0, { status: "searching" }), "Searching…");
assert.equal(searchProgressLabel(null, { status: "typing" }), "Keep typing");
assert.equal(searchProgressLabel(null, { status: "unavailable" }), "Search unavailable");
assert.equal(searchProgressLabel(25, { hasMore: true }), "25 loaded · more available");
assert.equal(searchProgressLabel(25, { hasMore: true, totalResults: 140 }), "25 loaded · 140 matches");
assert.equal(searchProgressLabel(25, { hasMore: true, failed: true }), "25 loaded · more could not be loaded");
assert.equal(searchProgressLabel(0, { hasMore: false }), "No matches");
assert.equal(searchProgressLabel(1, { hasMore: false }), "1 Match");
assert.equal(searchProgressLabel(25, { hasMore: false }), "25 Matches");
assert.equal(searchGroupCountText(12, true), "12 loaded");
assert.equal(searchGroupCountText(12, false), "12");

assert.match(searchViewSource, /"Searching…"/);
assert.match(searchViewSource, /found · searching more editions/);
assert.match(searchViewSource, /No results · some editions unavailable/);
assert.match(searchViewSource, /isSearchRequestPending \|\| library\.isSearchInProgress \{\s*return library\.isInitialContentLoaded \? "Searching" : "Loading codes"/);
assert.match(searchViewSource, /return library\.isSearchInProgress \|\| isSearchRequestPending \? "\\\(count\) loaded" : "\\\(count\)"/);
assert.match(appSource, /filteredResults\.length === 0 && !payload\.hasMore/);
assert.match(appSource, /status: "unavailable"/);
