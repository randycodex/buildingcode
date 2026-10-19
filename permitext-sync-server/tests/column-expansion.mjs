import assert from 'node:assert/strict';
import { adjacentColumnWidths } from '../public/column-expansion.js';
for (const delta of [-10000, -300, 0, 200, 10000]) {
  const [left, right] = adjacentColumnWidths(800, 700, delta, 600, 400, Infinity, 900);
  assert.equal(left + right, 1500, 'resizing must preserve the pair total');
  assert.ok(left >= 600 && right >= 400 && right <= 900);
}
assert.deepEqual(adjacentColumnWidths(800, 700, 200, 600, 400), [1000, 500]);
assert.deepEqual(adjacentColumnWidths(800, 700, 10000, 600, 400), [1100, 400]);
console.log('Adjacent resize keeps total width and respects both column limits.');

assert.deepEqual(adjacentColumnWidths(730, 600, 1200, 600, 600, Infinity, Infinity,
  { expandLeft: true, expandRight: true }), [1930, 600], 'A Reader keeps growing beside a neighbor already at its minimum');
assert.deepEqual(adjacentColumnWidths(600, 730, -1200, 600, 600, Infinity, Infinity,
  { expandLeft: true, expandRight: true }), [600, 1930], 'A Reader can also keep growing from the left divider');
assert.deepEqual(adjacentColumnWidths(800, 700, 1000, 600, 400, 900, Infinity,
  { expandLeft: true }), [900, 600], 'Expansion still respects a finite maximum');
assert.deepEqual(adjacentColumnWidths(600, 730, 1200, 600, 600, 900, Infinity,
  { expandRight: true }), [730, 600], 'Reader expansion does not make the bounded neighboring column unlimited');
console.log('Reader expansion continues beyond the neighboring minimum while preserving bounded column limits.');

const { captureWorkspaceLayout, applyWorkspaceLayout } = await import('../public/workspace-state.js');
const saved = captureWorkspaceLayout({ workflowPaneWeights: {
  research: { 'reader:one': 640, invalid: -5 }, notebook: { 'reader:one': 880 }, report: { 'reader:one': 700 }
}, researchColumnWidthsManual: true });
const restored = {};
applyWorkspaceLayout(restored, saved);
assert.equal(restored.workflowPaneWeights.research['reader:one'], 640);
assert.equal(restored.workflowPaneWeights.notebook['reader:one'], 880);
assert.equal(restored.workflowPaneWeights.report['reader:one'], 700);
assert.equal(restored.workflowPaneWeights.research.invalid, undefined);
assert.equal(restored.researchColumnWidthsManual, true, 'Manual Research widths survive a persisted workspace round trip');
assert.equal(captureWorkspaceLayout({}).researchColumnWidthsManual, false, 'New workspaces still share the available space automatically');
console.log('Independent view widths survive workspace capture/restore; invalid widths are discarded.');
