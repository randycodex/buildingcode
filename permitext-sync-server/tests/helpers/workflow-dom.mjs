export function documentFixture() {
  const doc = {createElement: tag => node(tag)};
  const matches = (node, selector) => selector.split(',').some(part => {
    part = part.trim().replace(/^:scope > /, '');
    return part.startsWith('.') ? node.className.split(/\s+/).includes(part.slice(1)) : node.tagName === part.toUpperCase();
  });
  function node(tag) {
    return {tagName: tag.toUpperCase(), ownerDocument: doc, children: [], dataset: {}, attributes: {}, handlers: {},
      className: '', textContent: '', hidden: false, open: false, scrollTop: 0,
      setAttribute(key, value) {this.attributes[key] = String(value);},
      append(...values) {for (const value of values) {value.remove?.(); value.parentNode = this; this.children.push(value);}},
      prepend(value) {value.remove?.(); value.parentNode = this; this.children.unshift(value);},
      remove() {if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(value => value !== this); this.parentNode = null;},
      replaceChildren(...values) {for (const child of this.children) child.parentNode = null; this.children = []; this.append(...values);},
      querySelector(selector) {for (const child of this.children) {if (matches(child, selector)) return child; const found = child.querySelector(selector); if (found) return found;} return null;},
      querySelectorAll(selector) {return this.children.flatMap(child => [...(matches(child, selector) ? [child] : []), ...child.querySelectorAll(selector)]);},
      closest(selector) {return matches(this, selector) ? this : this.parentNode?.closest(selector);},
      contains(target) {return target === this || this.children.some(child => child.contains(target));},
      addEventListener(type, action) {(this.handlers[type] ||= []).push(action);},
      removeEventListener(type, action) {this.handlers[type] = (this.handlers[type] || []).filter(handler => handler !== action);},
      dispatch(type, event = {}) {event.target ||= this; for (const action of this.handlers[type] || []) action(event); if (event.bubbles) this.parentNode?.dispatch(type, event);},
      focus() {doc.activeElement = this;}
    };
  }
  return doc;
}
