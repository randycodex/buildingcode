import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createNotebookNoteMenu } from '../public/notebook-note-menu.js';

class Element {
  constructor(tag) {
    this.tagName = tag; this.children = []; this.attributes = {}; this.events = {};
    this.dataset = {}; this.hidden = false; this.disabled = false; this.open = false; this.value = '';
    this.classList = { toggle: (name, on) => {
      const names = new Set((this.className || '').split(' ').filter(Boolean));
      if (on) names.add(name); else names.delete(name);
      this.className = [...names].join(' ');
    }};
  }
  append(...elements) { this.children.push(...elements); }
  replaceChildren(...elements) { this.children = elements; }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(name, listener) { (this.events[name] ||= []).push(listener); }
  contains(element) { return this === element || this.children.some(child => child.contains(element)); }
  focus() { document.activeElement = this; }
  select() { this.selected = true; }
  all() { return this.children.flatMap(child => [child, ...child.all()]); }
  querySelectorAll(selector) {
    return this.all().filter(el => selector === 'button' ? el.tagName === 'button' :
      (el.className || '').split(' ').includes(selector.slice(1)));
  }
  querySelector(selector) {
    if (selector.startsWith('.')) return this.querySelectorAll(selector)[0] || null;
    assert.equal(selector, '[aria-current="true"] > span');
    return this.all().find(el => el.getAttribute('aria-current') === 'true')?.children[0] || null;
  }
  dispatch(type, options = {}) {
    const event = { target: this, preventDefault() {}, stopPropagation() {}, ...options };
    for (const listener of this.events[type] || []) listener(event);
  }
  click() { if (!this.disabled) this.dispatch('click'); }
}
globalThis.document = { activeElement: null, createElement: tag => new Element(tag) };
const cards = [{id:'second',title:'Project note 2',version:1}, {id:'first',title:'Project note 1',version:3},
  {id:'archived',title:'Archived note',version:2,archivedAt:'2026-10-12'}];
let activeCard = cards[1], selected = [], created = 0;
const menu = createNotebookNoteMenu({ onSelect: card => selected.push(card.id),
  onTitleChange: value => { activeCard.title = value; } });
menu.createButton.addEventListener('click',()=>{created++});
menu.render({cards,activeCard});
assert.equal(menu.menu.open,false,'Notes starts as a compact closed dropdown');
assert.equal(menu.list.children.length,2,'Archive entries stay outside the active list');
const choices = () => menu.list.querySelectorAll('button');
assert.equal(choices()[0].children[1].textContent,'Revision 1');
assert.equal(choices()[1].children[1].textContent,'Current');
assert.equal(choices()[1].getAttribute('aria-current'),'true');
menu.menu.open = true;
choices()[1].click();
assert.equal(menu.menu.open,false);
assert.equal(selected.length,0,'Choosing the current Note keeps its live editor');
menu.menu.open = true;
choices()[0].click();
assert.deepEqual(selected,['second']);
assert.equal(menu.menu.open,false,'Switching a Note closes the dropdown');
menu.createButton.click();
assert.equal(created,1);
menu.toggle.focus();
menu.menu.dispatch('keydown',{key:'ArrowDown',target:menu.toggle});
assert.equal(menu.menu.open,true);
assert.equal(document.activeElement,choices()[0]);
menu.menu.dispatch('keydown',{key:'ArrowDown',target:document.activeElement});
assert.equal(document.activeElement,choices()[1]);
menu.menu.dispatch('keydown',{key:'End',target:document.activeElement});
assert.equal(document.activeElement,menu.createButton);
menu.menu.dispatch('keydown',{key:'Escape',target:document.activeElement});
assert.equal(menu.menu.open,false);
assert.equal(document.activeElement,menu.toggle);
menu.menu.open = true;
menu.menu.dispatch('focusout',{relatedTarget:menu.titleEditor});
assert.equal(menu.menu.open,false,'Moving focus outside closes Notes');

menu.editTitle();
assert.equal(document.activeElement,menu.titleEditor);
menu.titleEditor.value = 'Edited note title';
menu.titleEditor.dispatch('input');
assert.equal(activeCard.title,'Edited note title');
assert.equal(choices()[1].children[0].textContent,'Edited note title');
menu.render({cards,activeCard});
assert.equal(menu.titleEditor.hidden,false,'Refreshing the list does not hide the live title editor');
assert.equal(menu.titleEditor.value,'Edited note title');
menu.titleEditor.dispatch('keydown',{key:'Enter'});
assert.equal(menu.titleEditor.hidden,true);
assert.equal(menu.element.children[0].textContent,'Edited note title');

activeCard = {id:'',title:'Unsaved note',version:0};
menu.render({cards:[{...activeCard},...cards],activeCard});
assert.equal(choices().length,3,'Refreshing an unsaved Note cannot duplicate its menu entry');
assert.equal(choices()[0].children[1].textContent,'Current','The unsaved Note remains selectable');
menu.editTitle();
menu.titleEditor.value = 'Still typing';
menu.titleEditor.dispatch('input');
activeCard = {...activeCard,id:'accepted'};
menu.render({cards:[activeCard,...cards],activeCard});
assert.equal(menu.titleEditor.hidden,false,'First-save acknowledgement keeps title editing uninterrupted');
assert.equal(menu.titleEditor.value,'Still typing');

menu.render({cards,activeCard:cards[1],showingArchivedCards:true});
assert.equal(menu.label.textContent,'Archive');
assert.equal(choices().length,1);
assert.equal(choices()[0].children[0].textContent,'Archived note');
menu.titleEditor.value = 'Title while viewing archive';
assert.doesNotThrow(()=>menu.titleEditor.dispatch('input'));
menu.render({cards,activeCard:cards[1],selectingCards:true,selectedCardIDs:new Set(['first'])});
assert.equal(choices()[1].getAttribute('aria-pressed'),'true');
menu.menu.open = true;
choices()[0].click();
assert.equal(menu.menu.open,true,'Bulk selection keeps the menu open');
menu.menu.dispatch('keydown',{key:'Escape'});
assert.equal(menu.menu.open,true,'The owning Notebook cancels selection before closing the menu');
// Legacy question metadata neither changes the list nor adds task controls.
const question = {id:'q',text:'Verify condition',why:'',status:'open',resolution:''};
const questionCards = cards.map(card => ({...card,openQuestions:card.id === 'second' ? [] : [question]}));
const metadataBefore = structuredClone(questionCards);
menu.render({cards:questionCards,activeCard:questionCards[1],selectingCards:true,selectedCardIDs:new Set(['first'])});
assert.equal(menu.menu.querySelector('.notebook-question-filter'),null);
assert.equal(choices().length,2);
assert.equal(choices()[1].getAttribute('aria-pressed'),'true');
assert(!choices().some(choice => /open question/.test(choice.textContent)));
menu.render({cards:questionCards,activeCard:questionCards[1],showingArchivedCards:true});
assert.equal(menu.label.textContent,'Archive');
assert.equal(choices().length,1);
assert.equal(choices()[0].children[0].textContent,'Archived note');
assert.deepEqual(questionCards,metadataBefore,'Rendering simple notes preserves stored metadata');
menu.render({cards:[],activeCard:null,readOnly:true});
assert.equal(menu.list.children.length,0);
assert.equal(menu.createButton.disabled,true);
menu.createButton.click();
assert.equal(created,1,'Read-only Notes cannot create a draft');
menu.editTitle();
assert.equal(menu.titleEditor.hidden,true);
console.log('Notebook Notes menu passed: current/revision rows, switching/new action, keyboard/close behavior, live title editing, first-save continuity, archive/selection and read-only access.');

// Run the actual app's control setup and list renderer so integration state,
// title autosave callbacks and management controls are checked together.
const source = await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const setupStart = source.indexOf('    const noteMenu = createNotebookNoteMenu({');
const setupEnd = source.indexOf('    function scheduleNotebookAutosave',setupStart);
const managementStart = source.indexOf('    const updateNotebookCardManagement = () => {',setupEnd);
const managementEnd = source.indexOf('    refreshNotebookCards = async',managementStart);
assert(setupStart>0 && setupEnd>setupStart && managementStart>setupEnd && managementEnd>managementStart);
const appCards=[{id:'a',title:'First Note',version:2},{id:'b',title:'Second Note',version:1},
  {id:'archived',title:'Archived Note',version:1,archivedAt:'2026-10-12'}];
const c=vm.createContext({ createNotebookNoteMenu, notebookReadOnly:false, document,
  shell:new Element('div'),panel:new Element('article'),draftStatus:new Element('p'),
  cards:appCards,activeCard:appCards[0],disposed:false,requestIdentity:'account',
  isCurrentAccountRequest:()=>true,dirtyWrites:0,opened:[],
  markNotebookDirty:()=>{c.dirtyWrites++},
  loadCard:async id=>{c.opened.push(id)},showWebNotice:()=>{},
  archiveIconSVG:()=>'',selectionModeIconSVG:()=>'',trashIconSVG:()=>'',activeProjectsIconSVG:()=>'',archiveRestoreIconSVG:()=>'' });
vm.runInContext(source.slice(setupStart,setupEnd)+source.slice(managementStart,managementEnd)+
  '\nglobalThis.controls={noteMenu,render:renderCardList,selectButton,newButton,archiveButton,selectMode(){selectingCards=true;renderCardList()},archiveMode(){showingArchivedCards=true;selectingCards=false;renderCardList()}};',c);
c.controls.render();
assert.equal(c.controls.noteMenu.list.children.length,2);
c.controls.noteMenu.list.querySelectorAll('button')[1].click();
assert.deepEqual(c.opened,['b']);
c.controls.noteMenu.editTitle();
c.controls.noteMenu.titleEditor.value='Edited actual title';
c.controls.noteMenu.titleEditor.dispatch('input');
assert.equal(c.activeCard.title,'Edited actual title');
assert.equal(c.dirtyWrites,1,'Title edits retain the actual Notebook autosave callback');
c.controls.selectMode();
c.controls.noteMenu.list.querySelectorAll('button')[1].click();
assert.equal(c.controls.noteMenu.list.querySelectorAll('button')[1].getAttribute('aria-pressed'),'true');
assert.equal(c.opened.length,1,'Selecting Notes does not switch the editor');
c.controls.archiveMode();
assert.equal(c.controls.noteMenu.list.children.length,1);
assert.equal(c.controls.newButton.hidden,true);
c.notebookReadOnly=true;
c.controls.render();
assert.equal(c.controls.newButton.disabled,true);
assert.equal(c.controls.selectButton.disabled,true);
console.log('Notebook menu app integration passed: actual setup/render state, switching, title autosave, bulk selection, archive and read-only controls.');
