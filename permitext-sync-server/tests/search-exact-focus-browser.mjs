// Run against a disposable populated-workspace-performance-fixture.mjs server.
import assert from "node:assert/strict";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const fixtureURL = new URL(process.env.PERMITEXT_UX_FIXTURE_URL);
assert.equal(fixtureURL.hostname, "127.0.0.1");
assert.equal(fixtureURL.pathname, "/fixture/start");
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
});
const errors = [];

async function openSearch(viewport, hasTouch = false) {
  const page = await browser.newPage({ viewport, hasTouch, reducedMotion: "reduce" });
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(fixtureURL.href, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Synthetic Project 1", exact: true }).click();
  await page.getByRole("button", { name: "Search", exact: true }).click();
  return page;
}

async function runQuery(page, query) {
  const input = page.locator(".search-input:visible");
  await input.fill(query);
  await input.press("Enter");
}

async function verifyKeyboardReturn(page, trigger, title, returnTarget = trigger) {
  await trigger.focus();
  await page.keyboard.press("Enter");
  const passage = page.locator(".reader-content [data-search-reader-focus]:focus");
  await passage.waitFor();
  assert.match(await passage.innerText(), title);
  const close = page.locator(".reader-panel:visible .reader-close");
  await close.focus();
  await page.keyboard.press("Enter");
  await close.waitFor({ state: "detached" });
  await returnTarget.and(page.locator(":focus")).waitFor();
}

try {
  const desktop = await openSearch({ width: 1440, height: 900 });
  await runQuery(desktop, "1004.5");
  const firstVisible = desktop.locator(".result-row-main:visible").first();
  await firstVisible.waitFor();
  assert.match(await firstVisible.innerText(), /1004\.5 Multiple occupancies\./);
  const bounds = await firstVisible.boundingBox();
  assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 900);
  const chapter = desktop.locator(".search-chapter-group[open]").filter({ has: firstVisible });
  const summary = chapter.locator("summary");
  await summary.click();
  await firstVisible.waitFor({ state: "hidden" });
  await desktop.waitForFunction(() => Object.keys(sessionStorage).filter(key => key.includes(":search-queries:"))
    .some(key => Object.values(JSON.parse(sessionStorage.getItem(key)).queries).some(instance =>
      instance.query === "1004.5" && Object.values(instance.searchPosition?.chapterExpansion || {}).includes(false))));
  await desktop.reload({ waitUntil: "domcontentloaded" });
  const exactChapter = desktop.locator(".search-chapter-summary").filter({ hasText: "Chapter 10: Means of Egress" }).first();
  await exactChapter.waitFor();
  assert.equal(await exactChapter.evaluate(node => node.parentElement.open), false,
    "An explicit chapter collapse survives reload");
  await exactChapter.click();
  const result = desktop.locator(".result-row-main:visible").filter({ hasText: "1004.5 Multiple occupancies." }).first();
  await verifyKeyboardReturn(desktop, result, /1004\.5 Multiple occupancies\./);

  const openNew = result.locator("..").getByRole("button", { name: "Open in new Reader", exact: true });
  await verifyKeyboardReturn(desktop, openNew, /1004\.5 Multiple occupancies\./);

  await runQuery(desktop, "PC 403.1");
  await firstVisible.filter({ hasText: "Minimum number of fixtures" }).waitFor();
  assert.equal(await firstVisible.evaluate(node => node.closest(".search-result-group").dataset.codePrefix), "PC");

  const chapterRequest = /\/code\/chapters\/\d+(?:\?|$)/;
  let releaseChapter;
  const chapterCanLoad = new Promise(resolve => { releaseChapter = resolve; });
  await desktop.route(chapterRequest, async route => {
    await chapterCanLoad;
    await route.continue();
  });
  const chapterStarted = desktop.waitForRequest(chapterRequest);
  await firstVisible.press("Enter");
  await chapterStarted;
  const searchField = desktop.locator(".search-input:visible");
  await searchField.focus();
  releaseChapter();
  await desktop.locator(".reader-content .is-source-target").first().waitFor();
  assert.equal(await searchField.evaluate(node => node === document.activeElement), true,
    "An in-flight Reader must respect focus moved by the user");
  await desktop.close();

  const tablet = await openSearch({ width: 768, height: 1024 }, true);
  await runQuery(tablet, "1004.5");
  const tabletResult = tablet.locator(".result-row-main").filter({ hasText: "1004.5 Multiple occupancies." }).first();
  await tabletResult.waitFor();
  await verifyKeyboardReturn(tablet, tabletResult, /1004\.5 Multiple occupancies\./);
  assert.deepEqual(errors, []);
  console.log("Exact matches are visible by default, manual collapse survives reload, and Search Reader keyboard focus returns on desktop and tablet.");
} finally {
  await browser.close();
}
