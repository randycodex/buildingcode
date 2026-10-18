import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { activeCodeSourceCatalog } from '../active-code-source-catalog.mjs';
import { constructionChapterHTMLSource } from '../construction-html-content.mjs';

// Audit actual bundled bodies as well as the official HTML fallback used by
// current construction chapters. No chapter or code prefix is exempted.
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
function actual(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
const renderer = vm.createContext({
  rewriteCodeHTML: html => html,
  decorateCodeHTML() {},
  document: { createElement: () => ({
    dataset: {}, attributes: {}, listeners: [],
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(type, callback, options) { this.listeners.push({type, callback, options}); }
  }) }
});
vm.runInContext(['bindHorizontalWheelScroll', 'renderCodeBlock'].map(actual).join('\n'), renderer);
let checkedBlocks = 0;
function check(block, identity) {
  if (block.kind !== 'table' && !/<table\b/i.test(block.html || '')) return 0;
  const node = renderer.renderCodeBlock(block);
  assert.equal(node.className, 'code-table', `${identity}: table must use the shared scroll container`);
  assert.equal(node.innerHTML, block.html || '', `${identity}: preserve all authored table markup`);
  assert.equal(node.tabIndex, 0, `${identity}: keyboard access`);
  assert.equal(node.attributes.role, 'region');
  assert.equal(node.attributes['aria-label'], 'Code table');
  assert.equal(node.dataset.horizontalWheelBound, 'true', `${identity}: local horizontal gestures`);
  assert.equal(node.listeners.length, 1);
  assert.equal(node.listeners[0].type, 'wheel');
  assert.equal(node.listeners[0].options.passive, false);
  checkedBlocks++;
  return (block.html?.match(/<table\b/gi) || []).length;
}

const catalog = await activeCodeSourceCatalog();
const root = fileURLToPath(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/', import.meta.url));
const families = [...new Set(catalog.map(item => item.canonicalEdition.match(/new-york-city\/([^/]+)\//)[1]))].sort();
const reports = [];
for (const family of families) {
  const directory = join(root, family);
  const bundle = JSON.parse(await readFile(join(directory, 'bundle.json'), 'utf8'));
  const edition = catalog.filter(item => item.canonicalEdition.includes(`/${family}/`));
  const chapterIDs = new Set(bundle.chapters.map(chapter => String(chapter.id)));
  const chapterFiles = new Set(await readdir(join(directory, 'prepared', 'chapters')));
  for (const chapter of bundle.chapters) {
    assert.ok(chapterFiles.has(`${chapter.id}.json`), `${family}: missing chapter ${chapter.id}`);
    assert.ok(edition.some(item => item.categoryID === chapter.codeSectionID), `${family}: chapter source must be catalogued`);
  }
  const report = {family, codebooks: edition.length, chapters: bundle.chapters.length, sections: 0, legacyChapterBodies: 0, tableBlocks: 0, tableElements: 0};
  const files = (await readdir(join(directory, 'prepared', 'sections'))).filter(name => name.endsWith('.json'));
  for (let index = 0; index < files.length; index += 16) {
    await Promise.all(files.slice(index, index + 16).map(async name => {
      const body = JSON.parse(await readFile(join(directory, 'prepared', 'sections', name), 'utf8'));
      // Compatibility bodies retain older chapter IDs. Audit those too.
      if (!chapterIDs.has(String(body.chapterID))) report.legacyChapterBodies++;
      report.sections++;
      for (const block of body.blocks || []) {
        const before = checkedBlocks;
        report.tableElements += check(block, `${family}/${name}/${block.id}`);
        report.tableBlocks += checkedBlocks - before;
      }
    }));
  }
  reports.push(report);
}

const currentConstruction = JSON.parse(await readFile(join(root, '2022-construction-codes', 'bundle.json'), 'utf8'));
const prefixes = new Map(catalog.filter(item => item.canonicalEdition.includes('/2022-construction-codes/'))
  .map(item => [item.categoryID, item.codePrefix]));
const officialPaths = new Set();
let officialTableElements = 0;
for (const chapter of currentConstruction.chapters) {
  const official = await constructionChapterHTMLSource(prefixes.get(chapter.codeSectionID), chapter.chapterNumber);
  if (!official || officialPaths.has(official.path)) continue;
  officialPaths.add(official.path);
  officialTableElements += check({kind: 'html', html: official.html}, official.path);
}
assert.ok(checkedBlocks > 0, 'The audit must exercise actual source tables');
const totals = reports.reduce((sum, report) => {
  for (const key of ['codebooks', 'chapters', 'sections', 'tableBlocks', 'tableElements']) sum[key] = (sum[key] || 0) + report[key];
  return sum;
}, {});
console.log(JSON.stringify({totals, officialHTMLFiles: officialPaths.size, officialTableElements, checkedBlocks, reports}));
console.log('All bundled table blocks and official construction HTML tables use the shared accessible horizontal scroller.');
