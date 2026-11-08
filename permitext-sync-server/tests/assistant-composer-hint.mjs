import assert from 'node:assert/strict';
import { bindAssistantComposerHint } from '../public/assistant-composer-hint.js';

class Node extends EventTarget {
  constructor(doc, tag = 'div') {
    super(); this.ownerDocument = doc; this.tag = tag; this.children = [];
    this.attributes = new Map(); this.hidden = false; this.disabled = false; this.isConnected = true;
  }
  append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  focus() { this.ownerDocument.activeElement = this; }
  remove() { this.parent.children = this.parent.children.filter(child => child !== this); this.isConnected = false; }
}
const doc = new Node(null, 'document'); doc.ownerDocument = doc;
doc.createElement = tag => new Node(doc, tag);
doc.body = doc.createElement('body');
const observers = new Set();
globalThis.MutationObserver = class {
  constructor(callback) { this.callback = callback; }
  observe() { observers.add(this); }
  disconnect() { observers.delete(this); }
};
const changed = () => [...observers].forEach(observer => observer.callback());
const fire = (node, type, properties = {}) => {
  const event = new Event(type, { cancelable: true });
  for (const [key, value] of Object.entries(properties)) Object.defineProperty(event, key, { value });
  node.dispatchEvent(event); return event;
};
const form = doc.createElement('form'), box = doc.createElement('div'), input = doc.createElement('textarea');
doc.body.append(form); form.append(box); box.append(input);
input.setAttribute('aria-describedby', 'existing-description');
let reader = true, passage = false, opened = 0, saved = 0;
const controller = bindAssistantComposerHint({ form, composerBox: box, input,
  hasReader: () => reader, hasPassage: () => passage,
  openReader: () => opened++, openSavedEvidence: () => saved++ });
const hint = form.children.at(-1), message = hint.children[0], actions = hint.children[1];
const labels = () => actions.children.map(button => button.textContent);

assert.equal(hint.hidden, true);
input.focus(); fire(input, 'focus');
assert.equal(hint.hidden, true, 'Automatic focus does not show guidance on startup or refresh.');
fire(box, 'click');
assert.equal(hint.hidden, false);
assert.equal(message.textContent, 'Select text in Reader, then choose Ask Assistant.');
assert.deepEqual(labels(), ['Saved Evidence']);
assert.equal(input.getAttribute('aria-describedby'), `existing-description ${message.id}`);
fire(doc, 'pointerdown', { target: actions.children[0] });
assert.equal(hint.hidden, false, 'Interacting with hint actions does not dismiss them prematurely.');
actions.children[0].focus();
const escape = fire(doc, 'keydown', { key: 'Escape' });
assert.equal(escape.defaultPrevented, true);
assert.equal(hint.hidden, true);
assert.equal(doc.activeElement, input);
assert.equal(input.getAttribute('aria-describedby'), 'existing-description');
assert.equal(observers.size, 0);

reader = false; fire(box, 'click');
assert.equal(message.textContent, 'Choose a passage to begin.');
assert.deepEqual(labels(), ['Open Reader', 'Saved Evidence']);
fire(actions.children[0], 'click');
assert.equal(opened, 1); assert.equal(hint.hidden, true);
fire(input, 'input');
assert.equal(hint.hidden, false, 'Keyboard typing can request the same guidance.');
fire(actions.children[1], 'click');
assert.equal(saved, 1); assert.equal(hint.hidden, true);

fire(box, 'click'); fire(doc, 'pointerdown', { target: doc.body });
assert.equal(hint.hidden, true, 'Clicking away dismisses the hint.');
fire(box, 'click'); fire(doc, 'focusin', { target: doc.body });
assert.equal(hint.hidden, true, 'Tabbing away dismisses the hint.');
fire(box, 'click'); passage = true; changed();
assert.equal(hint.hidden, true, 'Including a passage dismisses the hint.');
fire(box, 'click'); fire(input, 'input');
assert.equal(hint.hidden, true, 'Sourced composers do not show missing-passage guidance.');
passage = false; input.disabled = true; fire(box, 'click');
assert.equal(hint.hidden, true, 'Busy or unavailable composers do not request a passage.');
input.disabled = false; fire(box, 'click'); form.isConnected = false; changed();
assert.equal(hint.hidden, true); assert.equal(observers.size, 0, 'Closing or replacing the composer releases document listeners.');
form.isConnected = true; controller.dispose();
fire(box, 'click'); fire(input, 'input');
assert.equal(form.children.includes(hint), false);
assert.equal(hint.hidden, true);
console.log('Assistant composer hint: explicit interaction, live Reader state, actions, keyboard access, dismissal, included passages and cleanup passed.');
