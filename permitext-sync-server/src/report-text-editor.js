import {Editor, Node, Mark, mergeAttributes} from '@tiptap/core';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import Strike from '@tiptap/extension-strike';
import Text from '@tiptap/extension-text';
import {UndoRedo} from '@tiptap/extensions';
import {canonicalReportRuns, reportRunsText, reportBlockRuns, reportRunsDocument, reportDocumentRuns, reportLinkURL} from '../public/report-rich-text.js';

const Document = Node.create({name:'doc', topNode:true, content:'paragraph+'});
const Paragraph = Node.create({name:'paragraph', group:'block', content:'inline*', parseHTML:() => [{tag:'p'}, {tag:'div'}, {tag:'h1'}, {tag:'h2'}, {tag:'h3'}, {tag:'li'}], renderHTML:() => ['p',0]});
const HardBreak = Node.create({name:'hardBreak', inline:true, group:'inline', selectable:false,
  parseHTML:() => [{tag:'br'}], renderHTML:() => ['br'],
  addKeyboardShortcuts() {return {'Shift-Enter':() => this.editor.commands.insertContent({type:'hardBreak'})};}});
const Highlight = Mark.create({name:'highlight', parseHTML:() => [{tag:'mark'}], renderHTML:() => ['mark',0]});
const Link = Mark.create({name:'link', inclusive:false,
  addAttributes:() => ({href:{default:null, parseHTML:element => reportLinkURL(element.getAttribute('href')) || null}}),
  parseHTML:() => [{tag:'a[href]', getAttrs:element => reportLinkURL(element.getAttribute('href')) ? {} : false}],
  renderHTML:({HTMLAttributes}) => ['a',mergeAttributes(HTMLAttributes,{rel:'noopener noreferrer'}),0]});
const icon = paths => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">${paths.map(d=>`<path d="${d}"/>`).join('')}</svg>`;
export const reportHighlightIcon = icon(['M5 12l6-8 5 4-6 8-5-4Z','M5 12l-2 5h6','M2 19h15']);

export function createReportFormatting({onChange, onInsert, onError = () => {}, isCurrent = () => true}) {
  const toolbar = document.createElement('div');
  toolbar.className = 'report-format-toolbar';
  toolbar.setAttribute('role','toolbar'); toolbar.setAttribute('aria-label','Report formatting');
  let current = null, stopped = false, linkSession = null;
  const editors = new Set(), controls = [];
  const valid = () => !stopped && isCurrent() && current && !current.editor.isDestroyed && current.element.isConnected;
  const refresh = () => {
    const enabled = Boolean(valid());
    controls.forEach(control => {control.disabled = !enabled;});
    for (const [name, button] of marks) button.setAttribute('aria-pressed', String(enabled && current.editor.isActive(name)));
    if (enabled) {
      style.value = current.block.kind === 'heading' ? `heading-${current.block.headingLevel || 1}` : 'paragraph';
      bullets.setAttribute('aria-pressed',String(current.block.kind === 'list' && current.block.listStyle !== 'ordered'));
      numbers.setAttribute('aria-pressed',String(current.block.kind === 'list' && current.block.listStyle === 'ordered'));
    }
  };
  const button = (label, html, handler, needsEditor = true) => {
    const element = document.createElement('button'); element.type = 'button';
    element.title = label; element.setAttribute('aria-label',label); element.innerHTML = html;
    element.addEventListener('mousedown',event => event.preventDefault());
    element.addEventListener('click',() => {if (!stopped && isCurrent() && (!needsEditor || valid())) handler();});
    if (needsEditor) controls.push(element);
    return element;
  };
  const marks = new Map();
  for (const [mark,label,html] of [['bold','Bold','<strong>B</strong>'],['italic','Italic','<em>I</em>'],['strike','Strikethrough','<s>S</s>'],['highlight','Highlight',reportHighlightIcon]]) {
    const control = button(label,html,() => {current.editor.chain().focus().toggleMark(mark).run(); refresh();});
    control.className = `report-format-${mark}`; marks.set(mark,control); toolbar.append(control);
  }
  const style = document.createElement('select'); style.setAttribute('aria-label','Text style'); style.title = 'Text style';
  for (const [value,label] of [['paragraph','Body'],['heading-1','Heading 1'],['heading-2','Heading 2'],['heading-3','Heading 3']]) {
    const option = document.createElement('option'); option.value = value; option.textContent = label; style.append(option);
  }
  const paintBlock = entry => {
    entry.element.dataset.kind = entry.block.kind;
    entry.element.dataset.headingLevel = String(entry.block.headingLevel || 1);
    entry.element.dataset.listStyle = entry.block.listStyle || 'bullet';
    entry.element.querySelector('[contenteditable]')?.setAttribute('aria-label',`Report ${entry.block.kind === 'list' ? 'list items' : entry.block.kind}`);
  };
  const store = entry => {
    const runs = canonicalReportRuns(reportDocumentRuns(entry.editor.getJSON()),{list:entry.block.kind === 'list'});
    if (entry.block.kind === 'list') {entry.block.items = reportRunsText(runs).split('\n'); delete entry.block.text;}
    else {entry.block.text = reportRunsText(runs); delete entry.block.items;}
    entry.block.richText = runs;
    onChange(entry.block); refresh();
  };
  const changeKind = (kind, props = {}) => {
    if (!valid()) return;
    current.block.kind = kind; delete current.block.headingLevel; delete current.block.listStyle;
    Object.assign(current.block,props); paintBlock(current); store(current); current.editor.commands.focus();
  };
  style.addEventListener('change',() => changeKind(style.value.startsWith('heading') ? 'heading' : 'paragraph',
    style.value.startsWith('heading') ? {headingLevel:Number(style.value.slice(-1))} : {}));
  controls.push(style); toolbar.append(style);
  const bullets = button('Bulleted list',icon(['M7 5h10M7 10h10M7 15h10','M3 4.5h.5v.5H3zM3 9.5h.5v.5H3zM3 14.5h.5v.5H3z']),
    () => changeKind(current.block.kind === 'list' && current.block.listStyle !== 'ordered' ? 'paragraph' : 'list',{listStyle:'bullet'}));
  const numbers = button('Numbered list',icon(['M8 5h9M8 10h9M8 15h9','M2 3h1v4M2 9c3-2 3 1 0 3h3M2 15h2l-1 1c3 0 2 3-1 2']),
    () => changeKind(current.block.kind === 'list' && current.block.listStyle === 'ordered' ? 'paragraph' : 'list',{listStyle:'ordered'}));
  toolbar.append(bullets,numbers);
  const link = document.createElement('span'); link.className = 'report-format-link';
  const linkButton = button('Link',icon(['M8 6l2-2a4 4 0 0 1 6 6l-2 2M12 14l-2 2a4 4 0 0 1-6-6l2-2M7 13l6-6']),() => {
    if (linkSession) {closeLink(); return;}
    const {from,to} = current.editor.state.selection;
    const selectedText = current.editor.state.doc.textBetween(from,to,'\n');
    linkSession = {entry:current,doc:current.editor.state.doc,from,to,label:selectedText.replace(/\n/g,' ')};
    url.value = current.editor.getAttributes('link').href || '';
    linkText.value = linkSession.label;
    error.textContent = ''; form.hidden = false; linkButton.setAttribute('aria-expanded','true'); url.focus();
  });
  linkButton.setAttribute('aria-expanded','false');
  const form = document.createElement('form'); form.className = 'report-format-link-form'; form.hidden = true;
  const url = document.createElement('input'); url.type = 'text'; url.placeholder = 'https://'; url.setAttribute('aria-label','Link URL');
  const linkText = document.createElement('input'); linkText.type = 'text'; linkText.setAttribute('aria-label','Link text');
  const error = document.createElement('p'); error.setAttribute('role','alert');
  for (const [label,input] of [['URL',url],['Text',linkText]]) {const row = document.createElement('label'); row.textContent = label; row.append(input); form.append(row);}
  const closeLink = () => {form.hidden = true; linkSession = null; linkButton.setAttribute('aria-expanded','false');};
  const restoreLink = () => {
    if (!valid() || !linkSession || linkSession.entry !== current || current.editor.state.doc !== linkSession.doc) {
      error.textContent = 'The Report changed. Select the link location again.'; return false;
    }
    current.editor.commands.setTextSelection({from:linkSession.from,to:linkSession.to}); return true;
  };
  form.addEventListener('submit',event => {
    event.preventDefault(); const href = reportLinkURL(url.value);
    if (!href) {error.textContent = 'Use an HTTP, HTTPS, or mailto URL.'; return;}
    if (!restoreLink()) return;
    const {from,to} = linkSession;
    const chain = current.editor.chain().focus();
    if (from === to || linkText.value !== linkSession.label) chain.insertContent({type:'text',text:linkText.value || href,marks:[{type:'link',attrs:{href}}]});
    else chain.setMark('link',{href});
    chain.run(); closeLink();
  });
  form.addEventListener('keydown',event => {if (event.key === 'Escape') {event.preventDefault(); closeLink(); if (valid()) current.editor.commands.focus();}});
  const apply = document.createElement('button'); apply.type = 'submit'; apply.textContent = 'Apply link';
  const unlink = button('Remove link','Remove link',() => {if (restoreLink()) {current.editor.chain().focus().extendMarkRange('link').unsetMark('link').run(); closeLink();}});
  const cancel = button('Cancel','Cancel',() => {closeLink(); if (valid()) current.editor.commands.focus();},false);
  form.append(error,apply,unlink,cancel); link.append(linkButton,form); toolbar.append(link);
  const insert = document.createElement('details'); insert.className = 'report-format-insert';
  const summary = document.createElement('summary'); summary.textContent = 'Insert'; summary.setAttribute('aria-label','Insert report content');
  const menu = document.createElement('div'); menu.className = 'report-format-insert-menu';
  for (const [kind,label] of [['heading','Heading'],['paragraph','Paragraph'],['list','Bulleted list'],['ordered','Numbered list'],['source','Source']]) {
    menu.append(button(label,label,() => {insert.open = false; onInsert(kind);},false));
  }
  insert.append(summary,menu); toolbar.append(insert);
  const focusOut = event => {if (!toolbar.contains(event.relatedTarget)) {insert.open = false; if (linkSession) closeLink();}};
  toolbar.addEventListener('focusout',focusOut);
  const selectionChanged = () => {
    if (valid()) {
      const selection = window.getSelection();
      if (selection?.anchorNode && !current.element.contains(selection.anchorNode) && !toolbar.contains(document.activeElement)) {
        current = null;
      }
    }
    refresh();
  };
  document.addEventListener('selectionchange',selectionChanged);
  const api = {
    element:toolbar,
    mount(block) {
      const element = document.createElement('div'); element.className = 'report-rich-editor';
      const entry = {block,element,editor:null};
      entry.editor = new Editor({element, extensions:[Document,Paragraph,Text,HardBreak,Bold,Italic,Strike,Highlight,Link,UndoRedo],
        content:reportRunsDocument(reportBlockRuns(block)),
        editorProps:{attributes:{role:'textbox','aria-multiline':'true','aria-label':`Report ${block.kind === 'list' ? 'list items' : block.kind}`},
          handleClick:(_view,_pos,event) => {if (event.target.closest('a')) {event.preventDefault(); return true;} return false;}},
        onFocus:() => {if (!stopped && isCurrent()) {current = entry; refresh();}},
        onSelectionUpdate:() => {if (!stopped && isCurrent()) {current = entry; refresh();}},
        onUpdate:() => {if (!stopped && isCurrent()) {try {store(entry);} catch (error) {onError(error.message);}}}
      });
      paintBlock(entry); editors.add(entry);
      return element;
    },
    focus(block) {const entry = [...editors].find(entry => entry.block === block); if (entry) {current = entry; entry.editor.commands.focus('end'); refresh();}},
    dispose() {stopped = true; document.removeEventListener('selectionchange',selectionChanged); editors.forEach(entry=>entry.editor.destroy()); editors.clear(); current = null;}
  };
  refresh(); return api;
}
