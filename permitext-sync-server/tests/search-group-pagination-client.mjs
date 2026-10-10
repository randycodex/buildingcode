import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const actual = name => {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert(start >= 0);
  return source.slice(start, source.indexOf("\n}", start) + 2);
};
let focused = null;
class Element {
  constructor() { this.children = []; this.dataset = {}; this.listeners = {}; this.className = ""; this.classList = { remove() {} }; }
  setAttribute(key, value) { this[key] = value; }
  addEventListener(key, callback) { this.listeners[key] = callback; }
  append(...children) { for (const child of children) { child.remove(); child.parent = this; this.children.push(child); } }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
  querySelectorAll(selector) {
    const [_, name, sourceKey] = selector.match(/^\.([\w-]+)(?:\[data-source-key="([^"]+)"\])?$/) || [];
    return this.children.flatMap(child => [...(child.className.split(" ").includes(name) &&
      (!sourceKey || child.dataset.sourceKey === sourceKey) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  contains(element) { return element === this || this.children.some(child => child.contains(element)); }
  focus() { focused = this; }
}
const make = () => {
  const results = new Element(); results.dataset.restoringSearch = "false";
  results.searchGroupPages = new Map();
  const instance = { query: "concrete", codeFilters: [], searchEdition: "all" };
  const requests = [], saves = [], statuses = [];
  let current = true, responder = async () => { throw new Error("Offline"); };
  const c = vm.createContext({ document: { createElement: () => new Element(), get activeElement() { return focused; } },
    encodeURIComponent, searchResultPageSize: 25, normalizeSearchCodeFilters: value => value,
    codeDisplayLabel: (prefix, version) => `${prefix} (${version})`, researchCodeEdition: source => source.codeVersion,
    searchResultMatchesExactQuery: () => true,
    appendSearchResultGroups(_results, rows) { for (const result of rows) {
      const page = results.searchGroupPages.get(`${result.codePrefix}|${result.codeVersion}`);
      const row = new Element(); row.className = "result-row";
      const main = new Element(); main.className = "result-row-main"; main.dataset.searchResultKey = c.searchResultPositionKey(result);
      row.append(main); page.group.querySelector(".search-result-group-body").append(row);
    } },
    updateSearchDock: (_panel, _instance, count, state) => statuses.push({ count, ...state }), refreshSearchGroupCounts() {},
    saveWorkspaceState: () => saves.push(JSON.stringify(instance)),
    api: async (path, options) => { requests.push({ url: new URL(path, "http://local"), signal: options.signal }); return responder(); }
  });
  vm.runInContext(["searchResultPositionKey", "searchPositionState", "appendSearchGroupLoadMore"].map(actual).join("\n"), c);
  c.searchPositionState(instance).groupPages = {};
  const options = { query: "concrete", searchInstance: instance, panel: {}, sourceScope: { querySuffix: "&sourceScope=enabled-only" },
    controller: new AbortController(), isCurrent: () => current };
  const add = (prefix, version, cursorKind = "candidate") => {
    const group = new Element(); group.className = "search-result-group";
    const body = new Element(); body.className = "search-result-group-body"; group.append(body); results.append(group);
    const page = { codePrefix: prefix, codeVersion: version, key: `${prefix}|${version}`, group,
      nextOffset: 5, candidateOffset: 8, loadedPages: 1, cursorKind, hasMore: true };
    results.searchGroupPages.set(page.key, page); c.appendSearchGroupLoadMore(results, page, options);
    return page;
  };
  return { c, results, instance, requests, saves, statuses, options, add,
    respond(callback) { responder = callback; }, stale() { current = false; } };
};
{
  const f = make(), current = f.add("BC", "2022"), historical = f.add("BC", "2014");
  const originalHistoricalFooter = historical.group.querySelector(".search-load-more");
  assert.equal(await current.loadMore(), false);
  assert.equal(current.nextOffset, 5); assert.equal(current.loadedPages, 1); assert.equal(f.saves.length, 0);
  assert.equal(current.group.querySelector(".search-load-more-button").textContent, "Try again");
  f.respond(async () => ({ results: [{ id: 6, codePrefix: "BC", codeVersion: "2022" }], hasMore: true,
    nextOffset: 6, nextCandidateOffset: 10, cursorKind: "candidate" }));
  await current.loadMore();
  assert.equal(current.nextOffset, 6); assert.equal(current.loadedPages, 2);
  assert.equal(historical.nextOffset, 5); assert.equal(historical.loadedPages, 1);
  assert.equal(historical.group.querySelector(".search-load-more"), originalHistoricalFooter);
  assert.equal(historical.group.querySelectorAll(".result-row").length, 0);
  const params = f.requests.at(-1).url.searchParams;
  assert.deepEqual(JSON.parse(params.get("resultSource")), { codePrefix: "BC", codeVersion: "2022" });
  assert.equal(params.get("code"), "BC"); assert.equal(params.get("sourceScope"), "enabled-only");
  assert.equal(params.get("offset"), "5"); assert.equal(params.get("candidateOffset"), "8");
  assert.equal(f.requests.at(-1).signal, f.options.controller.signal);
  assert.equal(f.instance.searchPosition.groupPages["BC|2022"], 2);
  f.respond(async () => ({ results: [{ id: 90, codePrefix: "BC", codeVersion: "2014" }], hasMore: false }));
  assert.equal(await current.loadMore(), false, "A mixed-edition response cannot mutate the selected group.");
  assert.equal(current.nextOffset, 6); assert.equal(current.loadedPages, 2);
  assert.equal(historical.group.querySelectorAll(".result-row").length, 0);
}
{
  const f = make(), page = f.add("BC", "2022", "offset");
  let resolve;
  f.respond(() => new Promise(done => { resolve = done; }));
  const pending = page.loadMore();
  const requests = f.requests.length;
  assert.equal(await page.loadMore(), false, "A double activation cannot start a concurrent page for the same group.");
  assert.equal(f.requests.length, requests);
  assert.equal(f.requests[0].url.searchParams.has("candidateOffset"), false, "An offline cursor is not sent into a different candidate index.");
  f.stale(); resolve({ results: [{ id: 6, codePrefix: "BC", codeVersion: "2022" }], nextOffset: 6, hasMore: false });
  assert.equal(await pending, false); assert.equal(page.nextOffset, 5); assert.equal(page.loadedPages, 1);
  assert.equal(page.group.querySelectorAll(".result-row").length, 0); assert.equal(f.saves.length, 0);
}
{
  const f = make();
  const panel = { isConnected: true, querySelector: () => f.results };
  const position = f.c.searchPositionState(f.instance);
  position.groupScope = "&sourceScope=enabled-only";
  position.groupPages = { "BC|2022": 3, "BC|2014": 2 };
  position.scrollTop = 420;
  Object.assign(f.c, { defaultSyncCodeVersion: "2022", AbortController, CSS: { escape: value => value },
    crypto: { randomUUID: () => "current" }, activeWorkspaceID: "workspace", captureAccountRequest: () => "account",
    isCurrentAccountRequest: () => true, isCurrentActiveCodeSourceContext: () => true, normalizeSearchInstance: value => value,
    prepareActiveCodeSearchScope: async () => ({ token: {}, querySuffix: "&sourceScope=enabled-only", enabledSourceCount: 2 }),
    clear: element => { element.children = []; }, requestAnimationFrame: callback => callback(),
    renderSearchPlaceholder() {} });
  f.c.appendSearchResultGroups = (_results, rows) => {
    for (const result of rows) {
      const sourceKey = `${result.codePrefix}|${result.codeVersion}`;
      let group = f.results.querySelector(`.search-result-group[data-source-key="${sourceKey}"]`);
      if (!group) {
        group = new Element(); group.className = "search-result-group"; group.dataset.sourceKey = sourceKey;
        const body = new Element(); body.className = "search-result-group-body"; group.append(body); f.results.append(group);
      }
      const row = new Element(); row.className = "result-row";
      const main = new Element(); main.className = "result-row-main"; main.dataset.searchResultKey = f.c.searchResultPositionKey(result);
      row.append(main); group.querySelector(".search-result-group-body").append(row);
    }
  };
  f.respond(async () => {
    const params = f.requests.at(-1).url.searchParams;
    if (params.get("grouped") === "true") return {
      results: ["2022", "2014"].flatMap(codeVersion => Array.from({ length: 5 }, (_, n) => ({ id: n + 1, codePrefix: "BC", codeVersion }))),
      groups: ["2022", "2014"].map(codeVersion => ({ codePrefix: "BC", codeVersion, nextOffset: 5, nextCandidateOffset: 8,
        cursorKind: "candidate", hasMore: true })), hasMore: true
    };
    const { codeVersion } = JSON.parse(params.get("resultSource"));
    const id = Number(params.get("offset")) + 1;
    return { results: [{ id, codePrefix: "BC", codeVersion }], nextOffset: id, nextCandidateOffset: id + 3,
      cursorKind: "candidate", hasMore: codeVersion === "2022" && id < 7 };
  });
  vm.runInContext(["normalizeSearchResultSources", "applyInitialSearchGroupExpansion", "cancelSearchPanelRequest", "renderSearchResults"].map(actual).join("\n"), f.c);
  await f.c.renderSearchResults(panel, f.instance);
  assert.equal(f.requests.length, 4, "Reload restores each group's own number of pages, rather than global batches.");
  assert.equal(position.groupPages["BC|2022"], 3); assert.equal(position.groupPages["BC|2014"], 2);
  assert.equal(f.results.scrollTop, 420); assert.equal(f.results.dataset.restoringSearch, "false");
  assert.equal(f.results.querySelector('.search-result-group[data-source-key="BC|2022"]').querySelectorAll(".result-row").length, 7);
  assert.equal(f.results.querySelector('.search-result-group[data-source-key="BC|2014"]').querySelectorAll(".result-row").length, 6);
  const before = f.requests.length;
  f.c.prepareActiveCodeSearchScope = async () => ({ token: {}, querySuffix: "&sourceScope=changed", enabledSourceCount: 2 });
  await f.c.renderSearchResults(panel, f.instance);
  assert.equal(f.requests.length, before + 1, "Changing enabled sources invalidates remembered group cursors.");
  assert.equal(position.groupPages["BC|2022"], 1); assert.equal(position.groupPages["BC|2014"], 1);
}
console.log("Scoped Search client passed: independent code/edition state, request scope, retry cursor, source rejection, double-click guard, offline cursor handoff and late-response isolation.");
