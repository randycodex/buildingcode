import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildWorkspaceEntry } from "../scripts/build-workspace-entry.mjs";

const root = await mkdtemp(join(tmpdir(), "permitext-workspace-bundle-"));
try {
  // Query-versioned nested modules must still run exactly once; optional
  // browser editors must remain dynamic, external and versioned.
  await writeFile(join(root, "state.js"), 'export const values = ["shared"];');
  await writeFile(join(root, "feature.js"), 'import {values} from "./state.js?v=1"; values.push("feature"); export {values};');
  const source = 'import {values} from "./feature.js?v=2"; import {values as same} from "./state.js?v=1"; import {values as differentVersion} from "./state.js?v=2"; export const result = {same: values === same, distinctVersion: values !== differentVersion, values, otherValues: differentVersion}; export const loadEditor = () => import("/web/notebook-assets/notebook.js?v=fixture-1"); export const loadVersionedEditor = version => import(`/web/account-verification-assets/account-verification.js?v=${version}`);';
  await writeFile(join(root, "app.js"), source);
  const output = join(root, "output");
  const report = await buildWorkspaceEntry(root, output);
  const built = await import(pathToFileURL(join(output, "app.js")).href);
  assert.deepEqual(built.result, {same: true, distinctVersion: true, values: ["shared", "feature"], otherValues: ["shared"]});
  assert.equal(await readFile(join(root, "app.js"), "utf8"), source, "Authored source is never overwritten");
  const code = await readFile(join(output, "app.js"), "utf8");
  assert.match(code, /import\("\/web\/notebook-assets\/notebook\.js\?v=fixture-1"\)/);
  assert.match(built.loadVersionedEditor.toString(), /import\(/, "Template-versioned editors must stay lazy");
  assert.match(built.loadVersionedEditor.toString(), /\/web\/account-verification-assets\/account-verification\.js\?v=/);
  assert.equal(report.eagerRequests, 1);
  assert.ok(report.bundledModules >= 4);
  await writeFile(join(root, "style.css"), ".example { color: red; }");
  await writeFile(join(root, "app.js"), 'import "./style.css"; export const value = "requires an asset";');
  await assert.rejects(buildWorkspaceEntry(root, output), /emitted additional assets/,
    "New emitted assets must not be silently omitted from deployment or offline preparation");
  console.log("Workspace bundle retains query-versioned module identity, lazy literal/template editor imports, and rejects undeployed additional assets.");
} finally { await rm(root, {recursive:true, force:true}); }
