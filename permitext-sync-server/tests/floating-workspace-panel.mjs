import assert from 'node:assert/strict';
import { floatingWorkspacePanelBounds, bindFloatingWorkspacePanel, createFloatingWorkspaceTabs } from '../public/floating-workspace-panel.js';

class Element extends EventTarget {
  constructor(tag = 'div') { super(); this.tag = tag; this.children = []; this.attributes = {}; this.style = {}; this.isConnected = true; this.offsetWidth = 600; }
  append(child) { this.children.push(child); child.parent = this; }
  setAttribute(key, value) { this.attributes[key] = value; }
  focus() { document.activeElement = this; }
  contains(target) { return target === this || this.children.some(child => child.contains(target)); }
  closest(selector) { return selector.includes('.custom-select-menu') && this.className === 'custom-select-menu' ? this : this.parent?.closest(selector); }
  getBoundingClientRect() { return this.bounds || { bottom: 35, right: 1400 }; }
}
const previousDocument = globalThis.document, previousWindow = globalThis.window;
globalThis.document = Object.assign(new EventTarget(), { createElement: tag => new Element(tag), querySelector: () => document.modal || null });
globalThis.window = Object.assign(new EventTarget(), { innerWidth: 1440, innerHeight: 900 });
function dispatch(target, type, values = {}) {
  const event = new Event(type, { cancelable: true });
  for (const [key, value] of Object.entries(values)) Object.defineProperty(event, key, { value });
  target.dispatchEvent(event);
  return event;
}
try {
  assert.deepEqual(floatingWorkspacePanelBounds({ right: 1400, bottom: 35 }, 600, 1440, 900), { left: 800, top: 43, maxHeight: 841 });
  assert.equal(floatingWorkspacePanelBounds({ right: 350, bottom: 35 }, 600, 900, 900).left, 8);
  const entries = ['account', 'library', 'recovery'].map(id => ({ id, label: id, panel: new Element('section') }));
  entries[0].panel.draft = 'Unfinished profile edit'; entries[0].panel.scrollTop = 245;
  let selection;
  const tabs = createFloatingWorkspaceTabs({ id: 'test', label: 'Settings', entries, onSelect: id => { selection = id; } });
  assert.equal(selection, 'account');
  assert.equal(entries[0].panel.hidden, false); assert.equal(entries[1].panel.hidden, true); assert.equal(entries[1].panel.inert, true);
  dispatch(tabs.element.children[1], 'click');
  assert.equal(selection, 'library'); assert.equal(entries[0].panel.inert, true);
  dispatch(tabs.element.children[1], 'keydown', { key: 'Home' });
  assert.equal(selection, 'account'); assert.equal(document.activeElement, tabs.element.children[0]);
  assert.equal(entries[0].panel.draft, 'Unfinished profile edit'); assert.equal(entries[0].panel.scrollTop, 245);
  dispatch(tabs.element.children[0], 'keydown', { key: 'ArrowLeft' });
  assert.equal(selection, 'recovery');
  tabs.dispose(); dispatch(tabs.element.children[0], 'click');
  assert.equal(selection, 'recovery', 'Disposed tabs release their listeners.');

  const panel = new Element(), anchor = new Element('button'), input = new Element('input');
  panel.append(input);
  let open = true, dismissals = 0, pinned = false;
  const controls = bindFloatingWorkspacePanel(panel, { anchor, alignmentReference: () => ({ right: window.innerWidth - 24, bottom: 67.5 }), manageAnchor: true, isOpen: () => open, isPinned: () => pinned, dismiss() { open = false; dismissals++; } });
  assert.equal(anchor.attributes['aria-expanded'], 'true');
  assert.equal(panel.style.left, '816px', 'Menus share a right edge even when their triggers differ.');
  assert.equal(panel.style.top, '75.5px', 'The panel can align to the Reader toolbar instead of its header trigger.');
  dispatch(document, 'pointerdown', { target: input });
  assert.equal(dismissals, 0, 'Editing inside the floating panel keeps it open.');
  const nested = new Element(); nested.className = 'custom-select-menu';
  dispatch(document, 'pointerdown', { target: nested });
  assert.equal(dismissals, 0, 'Controls rendered in a nested menu do not dismiss the panel.');
  const handled = new Event('keydown', { cancelable: true }); Object.defineProperty(handled, 'key', { value: 'Escape' }); handled.preventDefault(); document.dispatchEvent(handled);
  assert.equal(dismissals, 0, 'An editor can handle Escape without closing its parent.');
  document.modal = new Element('dialog'); dispatch(document, 'keydown', { key: 'Escape' }); document.modal = null;
  assert.equal(dismissals, 0, 'A modal confirmation keeps control of Escape.');
  pinned = true;
  const pinnedOutside = dispatch(document, 'pointerdown', { target: new Element('button') });
  assert.equal(dismissals, 0, 'Pinned menus stay open while the workspace receives outside clicks.');
  assert.equal(pinnedOutside.defaultPrevented, false);
  pinned = false;
  const outside = dispatch(document, 'pointerdown', { target: new Element('button') });
  assert.equal(dismissals, 1); assert.equal(outside.defaultPrevented, false, 'The underlying workspace still receives the outside click.');
  open = true; pinned = true; dispatch(document, 'keydown', { key: 'Escape' });
  assert.equal(dismissals, 2); assert.equal(document.activeElement, anchor);
  open = true; window.innerWidth = 1000; anchor.bounds = { right: 984, bottom: 35 }; dispatch(window, 'resize');
  assert.equal(panel.style.left, '376px');
  controls.dispose(); assert.equal(anchor.attributes['aria-expanded'], 'false');
  dispatch(document, 'pointerdown', { target: new Element() }); assert.equal(dismissals, 2);
  console.log('Floating panels passed: retained tab drafts and scroll, keyboard navigation, nested controls, outside clicks, Escape/focus, bounds, and listener cleanup.');
} finally {
  globalThis.document = previousDocument; globalThis.window = previousWindow;
}
