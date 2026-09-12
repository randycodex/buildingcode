import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const extract = (name, next) => source.slice(source.indexOf(`function ${name}(`), source.indexOf(`function ${next}(`));
const context = vm.createContext({
  state: { paneWeights: {}, readers: [] },
  paneIDs: [],
  activePaneIDs() { return context.paneIDs; },
  defaultPaneWidthForID: () => 600,
  migrateLegacyPaneWidth: (_id, width) => width,
  isFixedWidthPaneID: id => id.startsWith('utility:'),
  detachedProjectWindow: false,
  isProjectWorkboardPaneID: () => false,
  isProAccount() { throw new Error('Reader layout must not depend on subscription'); }
});
vm.runInContext(extract('isFlexibleReaderPaneID', 'linkedReaderPaneIDForSearch') + extract('applyPaneWeight', 'setUtilityButtonStates'), context);
function layout(id, ids, storedWidth = 600, linked = false) {
  context.paneIDs = ids;
  context.state.paneWeights = { [id]: storedWidth };
  context.state.readers = [{id:id.replace('reader:', ''), savedSourcePaneID:linked ? 'saved:fixture' : ''}];
  const style = { setProperty(key, value) { this[key] = value; } };
  context.applyPaneWeight({dataset:{}, style}, id);
  return style;
}
for (const storedWidth of [600, 1000]) {
  for (const linked of [false, true]) {
    assert.equal(layout('reader:a', ['reader:a'], storedWidth, linked).flex, '1 1 600px', 'A sole Reader must fill the viewport, including restored/source-linked Readers');
  }
}
for (const ids of [['reader:a','reader:b'], ['reader:a','reader:b','reader:c'], ['reader:a','utility:search']]) {
  const style = layout('reader:a', ids);
  assert.equal(style.flex, '1 1 600px');
  assert.equal(style['--pane-default-min-width'], '600px', 'Readers stop shrinking at 600px even with fewer than four columns');
}
assert.equal(layout('reader:a', ['reader:a','reader:b'], 900).flex, '0 0 900px', 'Multi-column manual divider widths remain respected');
assert.equal(layout('utility:search', ['utility:search','reader:a']).flex, '0 0 600px', 'Utility sizing stays unchanged');
const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
assert.match(css, /\.reader-content > \*\s*\{[^}]*max-width: 800px;[^}]*margin-right: auto;[^}]*margin-left: auto;/, 'Panel expansion must retain the existing centered text measure');
console.log('Reader width contract passed: sole/restored/linked Readers, sharing, minimums, manual resizing, and text measure.');
