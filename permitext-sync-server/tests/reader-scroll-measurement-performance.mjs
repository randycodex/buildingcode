import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const actual = name => {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
};

// A source near the end of a long chapter must not measure every earlier
// section or paragraph. Compare exact anchors against the ordered source data.
let reads = 0, scrollTop = 0;
const viewportTop = 70, blockCount = 1238, sectionCount = 128;
const offsets = [30];
for (let i = 0; i < blockCount; i++) offsets.push(offsets.at(-1) + 20 + i % 7);
const sectionHeight = offsets.at(-1) + 15;
const bounds = (top, height) => {
  reads++;
  return {top: viewportTop + top - scrollTop, bottom: viewportTop + top + height - scrollTop, height};
};
const sections = Array.from({length: sectionCount}, (_, s) => {
  const blocks = Array.from({length: blockCount}, (_, b) => ({
    dataset: {blockId: `b${b}`},
    getBoundingClientRect: () => bounds(s * sectionHeight + offsets[b], offsets[b + 1] - offsets[b])
  }));
  return {dataset: {sectionId: `s${s}`},
    getBoundingClientRect: () => bounds(s * sectionHeight, sectionHeight),
    querySelectorAll: () => blocks};
});
const content = {classList: {contains: () => false}, querySelectorAll: () => sections,
  getBoundingClientRect: () => ({top: viewportTop})};
const panel = {dataset: {paneId: 'reader:long', readerContentKey: 'edition/chapter'},
  classList: {contains: () => false}, querySelector: () => content};
const context = vm.createContext({track: {querySelectorAll: () => [panel]}, Map});
vm.runInContext(actual('captureReaderScrollPositions'), context);
let maximumReads = 0;
for (const [s, b, inside] of [[0, 0, 0], [37, 620, 7], [127, 1237, 3], [90, 1, 0]]) {
  scrollTop = s * sectionHeight + offsets[b] + inside;
  reads = 0;
  const position = context.captureReaderScrollPositions().get('reader:long');
  assert.equal(position.sectionID, `s${s}`);
  assert.equal(position.blockID, `b${b}`);
  assert.equal(position.anchorOffset, inside ? -inside : 0);
  assert.equal(position.sectionOffset, -offsets[b] - inside);
  assert.ok(reads <= 24, `Anchor capture measured ${reads} nodes instead of a bounded binary search`);
  maximumReads = Math.max(maximumReads, reads);
}
// At a shared boundary, the previous node has ended and must not be selected.
scrollTop = sectionHeight;
assert.equal(context.captureReaderScrollPositions().get('reader:long').sectionID, 's1');
scrollTop = sectionCount * sectionHeight;
assert.equal(context.captureReaderScrollPositions().size, 0);

// An intrinsic-height correction during lookup must recheck the selected
// boundary, rather than restoring an anchor from the previous estimated layout.
let shiftingReads = 0;
const shiftingBlocks = Array.from({length: 32}, (_, index) => ({dataset: {blockId: `b${index}`},
  getBoundingClientRect() {
    const height = ++shiftingReads >= 6 ? 50 : 100;
    return {top: index * height - 805, bottom: (index + 1) * height - 805};
  }}));
const shiftingSection = {dataset: {sectionId: 'shifting'}, querySelectorAll: () => shiftingBlocks,
  getBoundingClientRect: () => ({top: -805, bottom: 10000})};
const shiftingContent = {classList: {contains: () => false}, querySelectorAll: () => [shiftingSection],
  getBoundingClientRect: () => ({top: 0})};
const shiftingPanel = {...panel, querySelector: () => shiftingContent};
const shiftingContext = vm.createContext({track: {querySelectorAll: () => [shiftingPanel]}, Map});
vm.runInContext(actual('captureReaderScrollPositions'), shiftingContext);
const shifted = shiftingContext.captureReaderScrollPositions().get('reader:long');
assert.equal(shifted.blockID, 'b16');
assert.equal(shifted.anchorOffset, -5);
assert.ok(shiftingReads <= 20, 'Layout corrections remain bounded');

// Restoring one pane measures only five neighboring sections and restores each
// original inline containment setting, including explicitly configured values.
const changes = [];
const restoredSections = Array.from({length: 128}, (_, index) => {
  let visibility = index === 61 ? 'auto' : '';
  return {dataset: {sectionId: `s${index}`}, style: {
    get contentVisibility() { return visibility; },
    set contentVisibility(value) { changes.push(index); visibility = value; }
  }, querySelector: () => null, getBoundingClientRect: () => ({top: 25, height: 200})};
});
const restoredContent = {dataset: {chapterFullyLoaded: 'true'}, scrollTop: 400, scrollHeight: 5000, clientHeight: 600,
  querySelector: () => restoredSections[63], querySelectorAll: () => restoredSections,
  getBoundingClientRect: () => ({top: 0})};
const restoring = vm.createContext({CSS: {escape: value => value}, updateReaderScrollIndicator() {}, cancelReaderScrollRestore() {}});
vm.runInContext(actual('applyReaderScrollPosition'), restoring);
restoring.applyReaderScrollPosition({isConnected: true, classList: {contains: () => false},
  dataset: {readerContentKey: 'same'}, querySelector: () => restoredContent},
  {contentKey: 'same', sectionID: 's63', sectionOffset: 5});
assert.equal(restoredContent.scrollTop, 420);
assert.deepEqual([...new Set(changes)], [61, 62, 63, 64, 65]);
assert.equal(changes.length, 10, 'Each temporary override is restored');
restoredSections.forEach((section, index) => assert.equal(section.style.contentVisibility, index === 61 ? 'auto' : ''));
// A retained Reader already at the requested passage avoids all temporary
// containment writes; a genuinely shifted anchor above still takes the full path.
changes.length=0;
restoring.applyReaderScrollPosition({isConnected:true,classList:{contains:()=>false},
 dataset:{readerContentKey:'same'},querySelector:()=>restoredContent},
 {contentKey:'same',sectionID:'s63',sectionOffset:25});
assert.equal(changes.length,0,'An aligned retained passage must not relayout its five neighboring sections.');
assert.equal(restoredContent.scrollTop,420,'An aligned retained passage keeps its native scroll position.');
console.log(`Reader anchor performance passed: exact deep/boundary anchors with at most ${maximumReads} geometry reads across 128 sections and 1,238 passages; restoration contains its five-section measurement window.`);
