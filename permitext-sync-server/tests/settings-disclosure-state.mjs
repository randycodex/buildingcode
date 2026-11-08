import assert from 'node:assert/strict';
import { bindSettingsDisclosureState } from '../public/settings-disclosure-state.js';

const values = new Map();
const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
const lifecycle = new EventTarget();
const createPanel = () => {
  const nodes = Object.fromEntries(['projects', 'savedContent', 'trash'].map(key => [key, Object.assign(new EventTarget(), { open: false })]));
  const selectors = { '.settings-project-management': nodes.projects, '.settings-delete-content': nodes.savedContent, '.settings-trash': nodes.trash };
  return { nodes, querySelector: selector => selectors[selector] || null };
};
const key = accountID => `permitext:settingsDisclosures:v1:${accountID}`;
const bind = (panel, accountID = 'account-a', extra = {}) => bindSettingsDisclosureState(panel, { accountID, storage, lifecycle, ...extra });
const state = panel => Object.fromEntries(Object.entries(panel.nodes).map(([id, node]) => [id, node.open]));

let panel = createPanel(), controls = bind(panel);
assert.deepEqual(state(panel), { projects: false, savedContent: false, trash: false });
panel.nodes.projects.open = true;
panel.nodes.savedContent.open = true;
panel.nodes.savedContent.dispatchEvent(new Event('toggle'));
assert.deepEqual(JSON.parse(values.get(key('account-a'))), { projects: true, savedContent: true, trash: false });
panel.nodes.savedContent.open = false;
controls.dispose();
assert.equal(JSON.parse(values.get(key('account-a'))).savedContent, false, 'Closing before a queued toggle still saves the collapsed state.');
const closedSnapshot = values.get(key('account-a'));
panel.nodes.trash.open = true;
panel.nodes.trash.dispatchEvent(new Event('toggle'));
assert.equal(values.get(key('account-a')), closedSnapshot, 'Disposed panels cannot overwrite newer preferences.');

panel = createPanel(); controls = bind(panel);
assert.deepEqual(state(panel), { projects: true, savedContent: false, trash: false }, 'Reopening restores each section independently.');
panel.nodes.projects.open = false;
panel.nodes.trash.open = true;
lifecycle.dispatchEvent(new Event('pagehide'));
const refreshed = createPanel(), refreshedControls = bind(refreshed);
assert.deepEqual(state(refreshed), { projects: false, savedContent: false, trash: true }, 'Refresh captures the latest state even before toggle dispatch.');
controls.dispose(); refreshedControls.dispose();

const otherAccount = createPanel(), otherControls = bind(otherAccount, 'account-b');
assert.deepEqual(state(otherAccount), { projects: false, savedContent: false, trash: false }, 'Accounts do not share disclosure preferences.');
otherControls.dispose();
const originalAccount = createPanel(), originalControls = bind(originalAccount);
assert.deepEqual(state(originalAccount), { projects: false, savedContent: false, trash: true });
originalControls.dispose();

for (const invalid of ['invalid-json', 'null', '{"projects":"true","savedContent":1,"trash":null}']) {
  values.set(key('invalid'), invalid);
  const invalidPanel = createPanel(), invalidControls = bind(invalidPanel, 'invalid');
  assert.deepEqual(state(invalidPanel), { projects: false, savedContent: false, trash: false });
  invalidControls.dispose();
}
assert.doesNotThrow(() => {
  const blocked = bind(createPanel(), 'blocked', { storage: { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } } });
  lifecycle.dispatchEvent(new Event('pagehide'));
  blocked.dispose();
});
const beforeGuest = values.size;
bind(createPanel(), '').dispose();
assert.equal(values.size, beforeGuest, 'Signed-out Settings does not save private account presentation.');
console.log('Settings disclosures passed: independent expansion/collapse, reopen, refresh, immediate close, account isolation, invalid storage, and listener cleanup.');
