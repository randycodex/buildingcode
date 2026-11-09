// Start a fresh disposable populated-workspace-performance-fixture.mjs server for each run.
// Set PERMITEXT_UX_FIXTURE_URL to its POPULATED_FIXTURE_READY URL.
import assert from 'node:assert/strict';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const fixtureURL = new URL(process.env.PERMITEXT_UX_FIXTURE_URL);
assert.equal(fixtureURL.hostname, '127.0.0.1');
assert.equal(fixtureURL.pathname, '/fixture/start');
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
});
const errors = [];
async function openWorkspace() {
  const page = await browser.newPage({viewport: {width: 1365, height: 900}, reducedMotion: 'reduce'});
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(fixtureURL.href);
  await page.getByRole('button', {name: 'Choose workspace', exact: true}).waitFor();
  return page;
}
async function chooseFor(page, view, project = 'Synthetic Project 1') {
  await page.getByRole('button', {name: view, exact: true}).click();
  const picker = page.getByRole('menu', {name: `Choose a workspace for ${view}`});
  await picker.getByRole('menuitemradio', {name: project, exact: true}).click();
}
async function chooseProject(page, project) {
  await page.locator('#workspace-actions').click();
  await page.getByRole('menuitemradio', {name: project, exact: true}).click();
}
try {
  const notes = await openWorkspace();
  await chooseFor(notes, 'Notebook');
  const landing = notes.getByRole('region', {name: 'Project notes'});
  await landing.getByRole('button', {name: 'Synthetic Note 1', exact: true}).waitFor();
  assert.equal(await landing.locator('li').count(), 4);
  await landing.getByRole('button', {name: 'Synthetic Note 1', exact: true}).click();
  const editor = notes.locator('.bn-editor:visible');
  await editor.waitFor();
  const retainedEditor = await editor.elementHandle();
  assert.equal(await notes.locator('.notebook-landing').count(), 0);
  await notes.getByRole('button', {name: 'Research', exact: true}).click();
  await notes.getByRole('button', {name: 'Notebook', exact: true}).click();
  await editor.waitFor();
  assert.equal(await editor.evaluate((node, retained) => node === retained, retainedEditor), true);
  await chooseProject(notes, 'Synthetic Project 2');
  await notes.getByRole('button', {name: 'Notebook', exact: true}).click();
  await landing.getByText('No notes yet', {exact: true}).waitFor();
  assert.equal(await landing.getByRole('button', {name: /Synthetic Note/}).count(), 0);
  await notes.setViewportSize({width: 390, height: 844});
  const bounds = await landing.boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391, 'The note list fits a narrow screen.');
  await landing.getByRole('button', {name: 'New note', exact: true}).click();
  await editor.waitFor();
  console.log('Notebook passed: saved notes on entry, open/return preserves editor, project isolation, narrow layout and new-note action.');

  const search = await openWorkspace();
  await search.getByRole('button', {name: 'Choose workspace', exact: true}).click();
  await search.getByRole('menuitemradio', {name: 'Synthetic Project 1', exact: true}).click();
  await search.getByRole('button', {name: 'Search', exact: true}).click();
  const input = search.locator('input[type=search]:visible');
  await input.fill('corridor');
  await input.press('Enter');
  const fire = search.locator('.search-result-group[data-code-prefix=FC]');
  await fire.waitFor();
  const preview = search.locator('.search-result-group').first();
  assert.match(await preview.getAttribute('data-source-version'), /2022-construction-codes/);
  assert.equal(await preview.locator('.search-result-group-toggle').getAttribute('aria-expanded'), 'true');
  assert.ok(await preview.locator('.result-row-main:visible').count() > 0, 'A broad query immediately shows matching passages.');
  const firstMatchBounds = await preview.locator('.result-row-main:visible').first().boundingBox();
  assert.ok(firstMatchBounds.y >= 0 && firstMatchBounds.y < 900 && firstMatchBounds.x < 1365, 'The first passage appears in the initial desktop viewport.');
  const sourceKey = await preview.getAttribute('data-source-key');
  await preview.locator('.search-result-group-toggle').click();
  await search.reload();
  await search.locator('.search-result-group').first().waitFor();
  const collapsed = search.locator(`.search-result-group[data-source-key="${sourceKey}"]`);
  assert.equal(await collapsed.locator('.search-result-group-toggle').getAttribute('aria-expanded'), 'false', 'An explicit collapse survives reload.');
  assert.equal(await fire.locator('.search-group-label-text').innerText(), '2022');
  const historical = search.locator('.search-result-group[data-code-prefix=BC][data-source-version*="2014-construction-codes"]');
  await historical.locator('.search-result-group-toggle').click();
  await historical.locator('.result-row-main:visible').first().click();
  const detail = search.locator('.section-detail-panel:visible');
  await detail.locator('.section-detail-body[data-research-code-version*="2014-construction-codes"]').waitFor({timeout: 45000});
  assert.ok((await detail.locator('.section-detail-body').innerText()).trim().length > 0);
  console.log('Broad Search passed: visible preferred-edition passages, retained collapse after reload and historical result opening.');

  const reader = await openWorkspace();
  await reader.getByRole('button', {name: 'Choose workspace', exact: true}).click();
  await reader.getByRole('menuitemradio', {name: 'Synthetic Project 1', exact: true}).click();
  await reader.getByRole('button', {name: 'Reader', exact: true}).click();
  await reader.getByRole('button', {name: 'Fire Code (2022)', exact: true}).click();
  await reader.locator('.reader-panel:visible').waitFor();
  assert.equal(await reader.locator('.reader-panel:visible .code-select option:checked').textContent(), 'Fire Code (2022)');
  console.log('Fire Code passed: Search and the opened Reader show the same 2022 edition.');

  const report = await openWorkspace();
  await chooseFor(report, 'Report');
  await report.locator('.report-workspace-view:not([hidden]) .report-draft-panel').waitFor();
  await report.getByText('Synthetic populated report', {exact: true}).first().waitFor();
  console.log('Workspace continuation passed: Notebook and Report open immediately after choosing a workspace.');

  const cancelled = await openWorkspace();
  await cancelled.getByRole('button', {name: 'Report', exact: true}).click();
  await cancelled.getByRole('menu', {name: 'Choose a workspace for Report'}).waitFor();
  await cancelled.keyboard.press('Escape');
  assert.equal(await cancelled.getByRole('menu').count(), 0);
  await cancelled.getByRole('button', {name: 'Choose workspace', exact: true}).click();
  await cancelled.getByRole('menuitemradio', {name: 'Synthetic Project 1', exact: true}).click();
  await cancelled.getByRole('button', {name: 'Research', exact: true, pressed: true}).waitFor();
  assert.equal(await cancelled.locator('.report-workspace-view:not([hidden])').count(), 0);
  console.log('Cancellation passed: choosing a workspace later does not resume a dismissed Report action.');

  const failed = await openWorkspace();
  await failed.route('**/notebook/cards/list', route => route.fulfill({status: 503, json: {error: 'Synthetic note-list outage'}}));
  await chooseFor(failed, 'Notebook');
  const failedList = failed.getByRole('region', {name: 'Project notes'});
  await failedList.getByText('Notes could not be loaded.', {exact: true}).waitFor();
  await failed.unroute('**/notebook/cards/list');
  await failedList.getByRole('button', {name: 'Retry', exact: true}).click();
  await failedList.getByRole('button', {name: 'Synthetic Note 1', exact: true}).waitFor();
  console.log('Note-list recovery passed: a failed load has Retry and never claims there are no notes.');
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
