import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const inertDocument = {};
const template = { content: { firstElementChild: {
  ownerDocument: inertDocument,
  cloneNode() { return {ownerDocument: inertDocument}; }
} } };
const document = {
  importNode(node, deep) {
    assert.equal(node.ownerDocument, inertDocument);
    assert.equal(deep, true);
    return {ownerDocument: document};
  }
};
const context = vm.createContext({document, readerTemplate: template, searchTemplate: template,
  pendingGroupReaderPositions: new Map(), normalizeSearchInstance: value => value,
  normalizeSearchCodeFilters: () => [], paneIDForUtilityInstance: () => 'search', saveWorkspaceState() {}});

// Execute each real column constructor through its first panel creation. The
// first observer must see the live document even while the pane is unpublished.
for (const [name, args] of [['renderReader', [{id: 'reader'}]], ['renderSearch', [{}]]]) {
  const start = source.indexOf(`async function ${name}(`);
  const end = source.indexOf('  panel.__workspaceAccessGate', start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(source.slice(start, end) + 'return panel;\n}', context);
  const panel = await context[name](...args);
  assert.equal(panel.ownerDocument, document, `${name} imports before observer registration`);
}
const start = source.indexOf('function renderTemplate(');
const end = source.indexOf('\n}', start) + 2;
vm.runInContext(source.slice(start, end), context);
assert.equal(context.renderTemplate(template).ownerDocument, document);

for (const name of ['replaceActiveAccount', 'renderWorkspaceLoadError']) {
  // Every direct track-clear path must also dispose Readers, not just Search.
  assert.ok(source.includes(`function ${name}(`));
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\n}', start);
  const body = source.slice(start, end);
  if (body.includes('clear(track)')) assert.match(body, /forEach\(cancelReaderPanelRequests\)/);
}
console.log('Workspace template ownership: Reader, Search and utility panes belong to the live document before observers are wired; track teardown disposes Readers.');
