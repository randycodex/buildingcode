import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// GHSA-cp6q-959q-f8rh: an own JSON __proto__ key must never become
// inherited DOM attributes. Test the dependency, not a copied implementation.
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../package.json", import.meta.url));
const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
const corePackages = Object.entries(lock.packages)
  .filter(([path]) => /(?:^|\/)node_modules\/@tiptap\/core$/.test(path));
assert(corePackages.length > 0, "The Notebook Tiptap dependency must be in the lockfile.");

function assertPatched(version, label) {
  assert.match(version, /^\d+\.\d+\.\d+$/, `${label}: require a stable release.`);
  const [major, minor, patch] = version.split(".").map(Number);
  assert(major > 3 || (major === 3 && (minor > 30 || (minor === 30 && patch >= 4))),
    `${label}: ${version} predates the first patched release, 3.30.4.`);
}

const entryPoints = new Set();
for (const [path, locked] of corePackages) {
  assertPatched(locked.version, path);
  const installed = JSON.parse(readFileSync(resolve(root, path, "package.json"), "utf8"));
  assert.equal(installed.version, locked.version, `${path}: installed dependency differs from lockfile.`);
  entryPoints.add(require.resolve(resolve(root, path)));
  // Vite uses the ESM export; consumers under Node can resolve CommonJS.
  assert(installed.module, `${path}: missing browser ESM entry.`);
  entryPoints.add(resolve(root, path, installed.module));
}
// Include what both actual editor consumers resolve, catching stale nested copies.
for (const consumer of ["@blocknote/core", "@blocknote/react"]) {
  entryPoints.add(createRequire(require.resolve(consumer)).resolve("@tiptap/core"));
}

// Capture the actual ProseMirror serializer's setAttribute calls without a
// browser, network, or event execution. This is not a full browser smoke test.
const document = {
  createElement(tag) {
    return {
      nodeType: 1,
      tagName: tag,
      attributes: Object.create(null),
      setAttribute(name, value) { this.attributes[name] = String(value); },
      appendChild() {}
    };
  }
};

for (const entry of entryPoints) {
  const { mergeAttributes } = await import(pathToFileURL(entry).href);
  const dependencyRequire = createRequire(entry);
  const { DOMSerializer } = dependencyRequire("@tiptap/pm/model");
  const poison = JSON.parse('{"__proto__":{"data-inherited-canary":"present","src":"x-invalid://canary","onerror":"unexpected-handler"}}');
  const inputs = [
    [poison],
    [{ title: "Safe title" }, poison],
    [poison, { title: "Safe title" }],
    [null, poison, undefined]
  ];
  for (const items of inputs) {
    const attrs = mergeAttributes(...items);
    assert.equal(Object.getPrototypeOf(attrs), Object.prototype, `${entry}: changed object prototype.`);
    // The upstream fix preserves this as an own data property rather than
    // invoking the legacy setter. Dropping it in a later patch is safe too.
    const descriptor = Object.getOwnPropertyDescriptor(attrs, "__proto__");
    if (descriptor) {
      assert.equal(descriptor.value, poison.__proto__);
      assert.equal(descriptor.get, undefined);
      assert.equal(descriptor.set, undefined);
    }
    for (const key of ["data-inherited-canary", "src", "onerror"]) {
      assert.equal(key in attrs, false, `${entry}: inherited ${key}.`);
    }
    const { dom } = DOMSerializer.renderSpec(document, ["img", attrs]);
    assert.equal(dom.attributes.onerror, undefined, `${entry}: executable attribute reached serializer.`);
    assert.equal(dom.attributes.src, undefined);
    assert.equal(dom.attributes["data-inherited-canary"], undefined);
    if (items.some(item => item?.title)) assert.equal(dom.attributes.title, "Safe title");
  }
  const ordinary = mergeAttributes(
    { class: "note selected", style: "color: red; font-weight: bold", title: "First" },
    { class: "selected readable", style: "color: blue", title: "Second" }
  );
  assert.equal(ordinary.class, "note selected readable");
  assert.match(ordinary.style, /color:\s*blue/);
  assert.match(ordinary.style, /font-weight:\s*bold/);
  assert.equal(ordinary.title, "Second");
}
assert.equal(Object.prototype["data-inherited-canary"], undefined);
assert.equal(Object.prototype.onerror, undefined);
console.log(`Notebook dependency security passed: ${corePackages.length} locked core package(s), ${entryPoints.size} resolved implementation(s); prototype/DOM-attribute and ordinary-merge regressions.`);
