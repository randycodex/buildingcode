import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// Execute the production initial-hydration catch and its status helper. A
// deferred failure lets account changes/disposal happen while loading.
const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const start = source.indexOf("async function renderProjectReportDraft(");
const end = source.indexOf("\nfunction closeProjectDetailForProject(", start);
assert.ok(start >= 0 && end > start);
const renderer = source.slice(start, end);
const helper = renderer.match(/  const showStatusError = \(message\) => \{[\s\S]*?\n  \};/);
const catchStart = renderer.lastIndexOf("  } catch (error) {");
const catchEnd = renderer.lastIndexOf("\n  return panel;");
assert.ok(helper && catchStart > 0 && catchEnd > catchStart);
const catchClause = renderer.slice(catchStart, catchEnd);

async function check({ stale = false, disposed = false, pro = false } = {}) {
  let reject;
  const pending = new Promise((_resolve, failure) => { reject = failure; });
  const status = { hidden: true, textContent: "" };
  const panel = {};
  const context = vm.createContext({
    status, panel, pending, disposed: false, requestIdentity: 1, generation: 1,
    isCurrentAccountRequest(identity) { return identity === context.generation; }
  });
  vm.runInContext(helper[0], context);
  const result = vm.runInContext(`(async () => {
    try { await pending;
    ${catchClause}
    return panel;
  })()`, context);
  if (stale) context.generation += 1;
  context.disposed = disposed;
  reject(Object.assign(new Error("Synthetic request failed"),
    pro ? { payload: { code: "PRO_REQUIRED_EXPORTS" } } : {}));
  assert.equal(await result, panel, "Failure preserves the mounted shell");
  if (stale || disposed) {
    assert.deepEqual(status, { hidden: true, textContent: "" }, "Stale/disposed hydration cannot mutate its status");
  } else {
    assert.equal(status.hidden, false, "A current failure must be visible");
    assert.equal(status.textContent, pro
      ? "Professional Project Reports are included with Permitext Pro."
      : "Report unavailable: Synthetic request failed");
  }
}
await check();
await check({ pro: true });
await check({ stale: true });
await check({ disposed: true });
await check({ stale: true, disposed: true, pro: true });
console.log("Report hydration failures passed: visible network/access errors; stale and disposed completions suppressed.");
