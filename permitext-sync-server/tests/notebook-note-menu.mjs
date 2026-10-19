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
assert.equal(menu.menu.hidden,false,'Existing Notes expose the picker');
assert.equal(menu.list.children.length,2,'Archive entries stay outside the active list');
const choices = () => menu.list.querySelectorAll('button');
assert.equal(choices()[0].children.length,1,'Inactive Notes show only their title, without a revision label');
assert.equal(choices()[1].children.length,1,'The current Note shows only its title');
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
assert.equal(choices()[0].getAttribute('aria-current'),'true','The unsaved Note remains selectable');
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
menu.menu.open=true;
menu.render({cards:[],activeCard:null,readOnly:true});
assert.equal(menu.menu.hidden,true,'No Notes means no dropdown trigger');
assert.equal(menu.element.hidden,true,'An empty picker does not reserve a title row');
assert.equal(menu.menu.open,false,'Removing the last Note also closes an open picker');
assert.equal(menu.list.children.length,0);
assert.equal(menu.createButton.disabled,true);
menu.createButton.click();
assert.equal(created,1,'Read-only Notes cannot create a draft');
menu.editTitle();
assert.equal(menu.titleEditor.hidden,true);
menu.render({cards:[],activeCard:{id:'',title:'',version:0}});
assert.equal(menu.menu.hidden,false,'A new unsaved Note exposes the picker again');
assert.equal(menu.element.hidden,false);
menu.render({cards:[cards[2]],activeCard:null});
assert.equal(menu.menu.hidden,false,'Archived Notes remain reachable even when there are no active Notes');
console.log('Notebook Notes menu passed: title-only rows, switching/new action, keyboard/close behavior, live title editing, first-save continuity, archive/selection and read-only access.');

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

// Exercise Insert dismissal through the actual document bindings, including
// Escape before the menu's opening animation has moved focus off its button.
const insertStart = source.indexOf('function dismissNotebookInsertMenus(');
const insertEnd = source.indexOf('\nfunction wireCodeFilterMenu(', insertStart);
assert(insertStart > 0 && insertEnd > insertStart);
const insertListeners = {};
const outside = {}, nestedChoice = {}, insertRail = {hidden:false};
const insertState = {referenceMenuOpen:true};
const insertDocument = {activeElement:outside,
  querySelectorAll:()=>[insertMenu],
  addEventListener(type,listener,capture) { assert.equal(capture,true); insertListeners[type]=listener; }};
const insertToggle = {__filterMenuBinding:{filterRail:insertRail,instance:insertState,options:{stateKey:'referenceMenuOpen'}},
  focus() { insertDocument.activeElement=insertToggle; }};
const insertMenu = {contains:element=>element===insertToggle || element===nestedChoice,
  querySelector:()=>insertToggle};
let insertUpdates=0, insertSaves=0;
const insertContext=vm.createContext({document:insertDocument,
  updateCodeFilterMenu:()=>{insertUpdates++;},saveWorkspaceState:()=>{insertSaves++;}});
vm.runInContext(source.slice(insertStart,insertEnd)+'\n'+source.match(/document\.addEventListener\("pointerdown", dismissNotebookInsertMenus, true\);\ndocument\.addEventListener\("keydown", dismissNotebookInsertMenus, true\);/)[0],insertContext);
const dismissInsert = (type,target,key) => {
  const event={type,target,key,prevented:false,stopped:false,
    preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}};
  insertListeners[type](event); return event;
};
for (const target of [insertToggle,nestedChoice]) {
  dismissInsert('pointerdown',target);
  assert.equal(insertState.referenceMenuOpen,true,'Clicks inside Insert keep its nested choices open');
}
dismissInsert('pointerdown',outside);
assert.equal(insertState.referenceMenuOpen,false,'An outside pointer closes Insert');
assert.equal(insertRail.hidden,true,'Dismissal hides the popup immediately');
assert.equal(insertDocument.activeElement,outside,'Outside clicks retain their own focus target');
for (const target of [insertToggle,nestedChoice,outside]) {
  insertState.referenceMenuOpen=true; insertRail.hidden=false; insertDocument.activeElement=target;
  const event=dismissInsert('keydown',target,'Escape');
  assert.equal(insertState.referenceMenuOpen,false,'Escape closes Insert regardless of focus location');
  assert.equal(insertRail.hidden,true);
  assert.equal(event.prevented,true); assert.equal(event.stopped,true);
  assert.equal(insertDocument.activeElement,target===outside?outside:insertToggle,'Escape returns menu focus without stealing outside focus');
}
insertState.referenceMenuOpen=true;
const typing=dismissInsert('keydown',outside,'a');
assert.equal(insertState.referenceMenuOpen,true,'Typing is not intercepted');
assert.equal(typing.prevented,false);
insertState.referenceMenuOpen=false;
const closedEscape=dismissInsert('keydown',outside,'Escape');
assert.equal(closedEscape.prevented,false,'A closed Insert does not consume another control\'s Escape');
assert.equal(insertUpdates,4); assert.equal(insertSaves,4);
console.log('Notebook Insert dismissal passed: outside clicks, nested choices, immediate Escape from button/menu/editor, focus retention and closed-menu pass-through.');
