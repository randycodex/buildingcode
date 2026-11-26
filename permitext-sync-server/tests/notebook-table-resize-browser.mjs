// Run against a disposable populated-workspace-performance-fixture.mjs server.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const fixtureURL = new URL(process.env.PERMITEXT_UX_FIXTURE_URL);
assert.equal(fixtureURL.hostname, '127.0.0.1');
assert.equal(fixtureURL.pathname, '/fixture/start');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
});
try {
  const page = await browser.newPage({ viewport: { width: 1675, height: 1074 }, colorScheme: 'dark', reducedMotion: 'reduce' });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const noteTitle = `Table resize ${randomUUID().slice(0, 8)}`;
  const projectID = 'performance-project-1';
  const columnIndex = 5;
  const marker = 'Wide table resize fixture';
  const note = page.locator('.notebook-panel:visible');
  const table = note.locator('.bn-editor table').filter({ hasText: marker });
  const row = table.locator('tbody tr').first();
  const column = row.locator('td, th').nth(columnIndex);
  const list = page.locator('.notebook-index-panel:visible');

  await page.goto(fixtureURL.href);
  await page.locator('#toggle-notebook').waitFor();
  const seeded = await page.evaluate(async ({ noteTitle, projectID, marker }) => {
    const { userID, sessionToken } = JSON.parse(localStorage.getItem('permitext:webAccount:v1'));
    const document = {
      schema: 'permitext-notebook-card', schemaVersion: 2, format: 'blocknote-json',
      document: [
        { id: 'intro', type: 'paragraph', content: [{ type: 'text', text: 'A note above the table', styles: {} }] },
        { id: 'table', type: 'table', content: {
          type: 'tableContent', columnWidths: Array(23).fill(null),
          rows: Array.from({ length: 16 }, (_, rowIndex) => ({
            cells: Array.from({ length: 23 }, (_, index) => rowIndex === 0 && index === 0
              ? [{ type: 'text', text: marker, styles: {} }] : [])
          }))
        } }
      ]
    };
    const response = await fetch('/notebook/cards/save', {
      method: 'POST', headers: { authorization: `Bearer ${sessionToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ auth: { accountUserID: userID }, projectID, expectedVersion: 0,
        clientMutationID: crypto.randomUUID(), cardType: 'finding', title: noteTitle, document })
    });
    return response.status;
  }, { noteTitle, projectID, marker });
  assert.equal(seeded, 201);
  await page.reload();

  async function openTable() {
    const toggle = page.locator('#toggle-notebook:visible');
    await table.or(list).or(toggle).first().waitFor();
    if (await table.isVisible()) return;
    if (!(await list.isVisible())) {
      await toggle.click();
      const project = page.getByRole('menuitemradio', { name: 'Synthetic Project 1', exact: true });
      await project.or(list).first().waitFor();
      if (await project.isVisible()) await project.click();
    }
    const noteTile = list.getByRole('button', { name: noteTitle, exact: true });
    await table.or(noteTile).first().waitFor();
    if (!(await table.isVisible())) await noteTile.click();
    await table.waitFor();
  }
  await openTable();

  const metrics = () => column.evaluate(cell => {
    const table = cell.closest('table');
    const panel = table.closest('.notebook-panel');
    const track = panel.closest('.panel-track');
    const wrapper = table.closest('.tableWrapper-inner');
    const bounds = node => node.getBoundingClientRect();
    return {
      titleX: bounds(panel.querySelector('.notebook-title-control')).x,
      toolbarX: bounds(panel.querySelector('.notebook-format-toolbar')).x,
      tableX: bounds(table).x, cellX: bounds(cell).x, width: bounds(cell).width,
      adjacentWidth: bounds(cell.nextElementSibling).width,
      rowHeight: bounds(cell.parentElement).height,
      trackScroll: track.scrollLeft, wrapperWidth: wrapper.clientWidth, tableScrollWidth: wrapper.scrollWidth
    };
  });
  const near = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1, `${actual} should be near ${expected}`);
  const unchanged = (before, after) => {
    for (const key of ['titleX', 'toolbarX', 'tableX', 'cellX', 'adjacentWidth', 'trackScroll']) near(after[key], before[key]);
  };
  const nextSave = () => page.waitForResponse(response =>
    new URL(response.url()).pathname === '/notebook/cards/save' && response.ok());
  const savedTable = async (promise) => {
    const response = await promise;
    return (await response.json()).card.document.document.find(block => block.type === 'table').content;
  };
  async function dragColumn(delta) {
    const before = await metrics();
    const box = await column.boundingBox();
    const x = box.x + box.width - 1;
    const y = box.y + 12;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + delta, y, { steps: 8 });
    const preview = await metrics();
    const save = nextSave();
    await page.mouse.up();
    const saved = await savedTable(save);
    unchanged(before, preview);
    near(preview.width, before.width + delta);
    const after = await metrics();
    unchanged(before, after);
    near(after.width, saved.columnWidths[columnIndex]);
    near(after.width, preview.width);
    return after;
  }

  const before = await metrics();
  assert.equal(before.wrapperWidth, before.tableScrollWidth);
  const grown = await dragColumn(120);
  assert.ok(grown.tableScrollWidth > grown.wrapperWidth + 100);
  const scroller = table.locator('xpath=..');
  const scrollBounds = await scroller.boundingBox();
  await page.mouse.move(scrollBounds.x + 40, scrollBounds.y + 20);
  await page.mouse.wheel(90, 0);
  await page.waitForFunction(element => element.scrollLeft > 0, await scroller.elementHandle());
  const scrolled = await metrics();
  near(scrolled.titleX, grown.titleX);
  near(scrolled.trackScroll, grown.trackScroll);
  await scroller.evaluate(element => { element.scrollLeft = 0; });
  const shrunk = await dragColumn(-70);
  assert.ok(shrunk.width < grown.width - 65);

  await column.click({ position: { x: 16, y: 12 } });
  const handle = note.getByRole('button', { name: 'Resize row', exact: true });
  await handle.waitFor();
  const bounds = await handle.boundingBox();
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 55, { steps: 6 });
  const save = nextSave();
  await page.mouse.up();
  const saved = await savedTable(save);
  const afterRow = await metrics();
  assert.ok(afterRow.rowHeight > shrunk.rowHeight + 50);
  near(afterRow.rowHeight, saved.rows[0].height);
  near(afterRow.width, shrunk.width);

  await page.reload();
  await openTable();
  const reopened = await metrics();
  near(reopened.width, saved.columnWidths[columnIndex]);
  near(reopened.rowHeight, saved.rows[0].height);
  assert.deepEqual(errors, []);
  console.log('Web Notes table resizing passed: stable note and divider, column growth and shrink, local table overflow, row resize, save, and reload.');
} finally {
  await browser.close();
}
