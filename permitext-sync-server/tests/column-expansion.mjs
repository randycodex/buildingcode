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

const { captureWorkspaceLayout, applyWorkspaceLayout } = await import('../public/workspace-state.js');
const saved = captureWorkspaceLayout({ workflowPaneWeights: {
  research: { 'reader:one': 640, invalid: -5 }, notebook: { 'reader:one': 880 }, report: { 'reader:one': 700 }
} });
const restored = {};
applyWorkspaceLayout(restored, saved);
assert.equal(restored.workflowPaneWeights.research['reader:one'], 640);
assert.equal(restored.workflowPaneWeights.notebook['reader:one'], 880);
assert.equal(restored.workflowPaneWeights.report['reader:one'], 700);
assert.equal(restored.workflowPaneWeights.research.invalid, undefined);
console.log('Independent view widths survive workspace capture/restore; invalid widths are discarded.');
