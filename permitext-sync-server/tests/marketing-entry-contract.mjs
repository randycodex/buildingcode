import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import { parse } from "parse5";

const source = await readFile(new URL("../public/marketing/home.js", import.meta.url), "utf8");
function entry(search = "", hash = "", standalone = false) {
  const redirects = [];
  vm.runInNewContext(source, {
    URLSearchParams,
    location: { search, hash, replace: value => redirects.push(value) },
    matchMedia: () => ({ matches: standalone }),
    navigator: {}, window: {},
    document: { querySelector: () => null },
    addEventListener() {}
  });
  return redirects;
}
assert.deepEqual(entry(), []);
assert.deepEqual(entry("?utm_source=example", "#explore"), []);
assert.deepEqual(entry("", "#ios-details"), []);
assert.deepEqual(entry("", "", true), ["/workspace"]);
for (const parameter of ["checkout", "session_id", "package", "appleSignIn", "clerk_return", "organizationInvite", "detachedWorkboard", "enableCodeQuestionWorkspace"]) {
  assert.deepEqual(entry(`?${parameter}=example`, "#cq/example"), [`/workspace?${parameter}=example#cq/example`]);
}
assert.deepEqual(entry("", "#cq/example"), ["/workspace#cq/example"]);

const temp = await mkdtemp(join(tmpdir(), "permitext-marketing-test-"));
process.env.PERMITEXT_SYNC_DATA_PATH = join(temp, "store.json");
const { handleRequest } = await import("../app.mjs");
const server = createServer(handleRequest);
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
async function request(path, status = 200) {
  const response = await fetch(`${base}${path}`, { redirect: "manual" });
  assert.equal(response.status, status, `${path} status`);
  return response;
}
try {
  const home = await (await request("/")).text();
  const workspace = await (await request("/workspace")).text();
  const columns = await (await request("/homepage-columns")).text();
  const columnsThree = await (await request("/homepage-columns-three")).text();
  assert.match(columns, /id="story-title"/);
  assert.match(columnsThree, /id="intro-title"/);
  assert.match(columns, /name="robots" content="noindex, nofollow"/);
  assert.match(columnsThree, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(columns, /id="panel-track"/);
  await request("/marketing/columns.css?v=1");
  await request("/marketing/columns.js?v=1");
  assert.match(home, /id="hero-title"/);
  assert.doesNotMatch(home, /id="panel-track"|src="\/web\/app\.js/);
  assert.match(workspace, /id="panel-track"/);
  assert.doesNotMatch(workspace, /marketing\/home/);
  for (const path of ["/web", "/web/", "/workspace/"]) {
    assert.equal((await request(`${path}?clerk_return=1&checkout=cancel`, 308)).headers.get("location"), "/workspace?clerk_return=1&checkout=cancel");
  }
  assert.equal(await (await request("/open/section/1026")).text(), workspace);
  const elements = [];
  function walk(node) { if (node.tagName) elements.push(node); for (const child of node.childNodes || []) walk(child); }
  walk(parse(home));
  const attrs = element => Object.fromEntries(element.attrs.map(({ name, value }) => [name, value]));
  const ids = elements.map(attrs).map(a => a.id).filter(Boolean);
  assert.equal(ids.length, new Set(ids).size, "No duplicate IDs");
  for (const element of elements) {
    const a = attrs(element);
    if (a.href?.startsWith("#")) assert(ids.includes(a.href.slice(1)), `Missing anchor ${a.href}`);
    if (a.src?.startsWith("/")) await request(a.src);
    if (element.tagName === "link" && a.href?.startsWith("/")) await request(a.href);
  }
  for (const path of ["/privacy", "/terms", "/refunds", "/support", "/web/styles.css", "/web/app.js", "/service-worker.js", "/web/manifest.webmanifest"]) await request(path);
  const manifest = await (await request("/web/manifest.webmanifest")).json();
  assert.equal(manifest.start_url, "/workspace");
  assert.equal(manifest.id, "/");
  assert.equal(elements.filter(e => e.tagName === "h1").length, 1);
  assert.equal(elements.filter(e => e.tagName === "a" && attrs(e).href === "#explore").length, 4);
  assert.doesNotMatch(home, /apps\.apple\.com|mailto:|Book a demo|Start free trial/);
  console.log("Permitext marketing entry passed: live HTTP routes, assets, anchors, legacy callbacks, and installed-app entry.");
} finally {
  await new Promise(resolve => server.close(resolve));
  await rm(temp, { recursive: true, force: true });
}
