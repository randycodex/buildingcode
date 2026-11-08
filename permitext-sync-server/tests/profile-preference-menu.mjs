import assert from 'node:assert/strict';
import { openProfilePreferenceMenu, profilePreferenceMenuBounds } from '../public/profile-preference-menu.js';

class Element extends EventTarget {
  constructor() { super(); this.children = []; this.attributes = {}; this.style = {}; this.offsetWidth = 220; this.offsetHeight = 90; this.isConnected = true; }
  append(child) { this.children.push(child); child.parent = this; }
  remove() { this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
  setAttribute(key, value) { this.attributes[key] = value; }
  getAttribute(key) { return this.attributes[key] ?? null; }
  removeAttribute(key) { delete this.attributes[key]; }
  contains(target) { return target === this || this.children.some(child => child.contains(target)); }
  focus() { document.activeElement = this; }
  getBoundingClientRect() { return { left: 400, right: 700, top: 250, bottom: 298 }; }
}
function dispatch(target, type, values = {}) {
  const event = new Event(type, { cancelable: true });
  for (const [key, value] of Object.entries(values)) Object.defineProperty(event, key, { value });
  target.dispatchEvent(event);
  return event;
}
const previousDocument = globalThis.document, previousWindow = globalThis.window;
globalThis.document = Object.assign(new EventTarget(), { body: new Element(), createElement: () => new Element() });
globalThis.window = Object.assign(new EventTarget(), { innerWidth: 800, innerHeight: 600 });
try {
  assert.deepEqual(profilePreferenceMenuBounds({ right: 790, top: 550, bottom: 590 }, 220, 90, 800, 600), { left: 570, top: 452 });
  assert.deepEqual(profilePreferenceMenuBounds({ right: 100, top: 10, bottom: 50 }, 220, 90, 320, 600), { left: 8, top: 58 });
  const trigger = new Element();
  const anchor = new Element();
  anchor.getBoundingClientRect = () => ({ right: 700, top: 260, bottom: 280 });
  const choices = [], dismissals = [], tabs = [];
  const open = () => openProfilePreferenceMenu({ trigger, anchor, label: 'Email updates', value: false,
    options: [{ label: 'Subscribed', value: true }, { label: 'Off', value: false }],
    onSelect: value => choices.push(value), onDismiss: () => dismissals.push(true), onTab: backward => tabs.push(backward) });
  const current = () => document.body.children.at(-1);
  let controls = open(), menu = current();
  assert.equal(trigger.getAttribute('aria-expanded'), 'true', 'Opening exposes the choices immediately.');
  assert.equal(menu.getAttribute('role'), 'listbox');
  assert.equal(menu.style.top, '306px', 'The menu opens below the whole row, not over its lower padding.');
  assert.equal(document.activeElement, menu.children[1], 'Focus starts on the saved choice.');
  dispatch(menu, 'keydown', { key: 'ArrowUp' });
  assert.equal(document.activeElement, menu.children[0]);
  dispatch(menu, 'keydown', { key: 'End' });
  assert.equal(document.activeElement, menu.children[1]);
  dispatch(menu, 'keydown', { key: 'Escape' });
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(document.activeElement, trigger);
  assert.equal(menu.isConnected, false);
  assert.deepEqual(choices, [], 'Dismissing never saves a different preference.');
  dispatch(document, 'pointerdown', { target: new Element() });
  assert.equal(dismissals.length, 1, 'Dismissal releases the outside-click listener.');

  controls = open(); menu = current();
  dispatch(document, 'pointerdown', { target: menu.children[0] });
  assert.equal(menu.isConnected, true);
  dispatch(menu.children[0], 'click');
  assert.deepEqual(choices, [true]);
  assert.equal(menu.isConnected, false);
  assert.equal(document.activeElement, trigger);
  dispatch(menu.children[1], 'click');
  assert.deepEqual(choices, [true], 'Removed options cannot save again.');

  open(); menu = current();
  dispatch(menu, 'keydown', { key: 'Tab', shiftKey: true });
  assert.deepEqual(tabs, [true]);
  assert.equal(menu.isConnected, false);
  open(); menu = current();
  dispatch(document, 'pointerdown', { target: new Element() });
  assert.equal(menu.isConnected, false);
  controls = open(); menu = current(); controls.destroy();
  assert.equal(menu.isConnected, false, 'Closing Settings can dispose its nested menu.');
  console.log('Profile preference menu passed: immediate choices, saved selection, keyboard, dismissal, bounds, and listener cleanup.');
} finally {
  globalThis.document = previousDocument; globalThis.window = previousWindow;
}
