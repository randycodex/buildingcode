import assert from 'node:assert/strict';
import {settingsSavedContentSnapshot, settingsSavedContentTitle, createSettingsSavedContent} from '../public/settings-saved-content.js';

const project = {id: 'project-a', name: 'A'};
const target = {sectionID: 101, codeVersion: 'nyc-2022', blockID: 'scope'};
const saved = {id: 'saved-a', ...target, title: 'Scope', updatedAt: '2026-11-01'};
const link = {id: 'link-a', ...target, folderClientID: project.id};
const note = {id: 'note-a', ...target, noteBody: 'Check existing conditions'};
const summary = {
  projects: [project, {id: 'archived', archivedAt: '2026-11-01'}, {id: 'deleted', deletedAt: '2026-11-01'}],
  savedItems: [saved, {...saved, id: 'legacy-copy', updatedAt: '2026-11-02'},
    {...saved, id: 'other-edition', codeVersion: 'nyc-2014'},
    {...saved, id: 'other-block', blockID: 'intent'},
    {...saved, id: 'removed', sectionID: 202, deletedAt: '2026-11-03'}],
  projectSections: [link, {...link, id: 'duplicate-link'},
    {...link, id: 'link-only', sectionID: 303},
    {...link, id: 'archived-link', folderClientID: 'archived'},
    {...link, id: 'deleted-project-link', sectionID: 404, folderClientID: 'deleted'},
    {...link, id: 'deleted-link', sectionID: 505, deletedAt: '2026-11-03'}],
  annotations: [note, {...note, id: 'identical-legacy-note'},
    {...note, id: 'different-note', noteBody: 'Confirm permitted occupancy'},
    {...note, id: 'different-edition', codeVersion: 'nyc-2014'},
    {...note, id: 'deleted-note', sectionID: 404, deletedAt: '2026-11-03'},
    {...note, id: 'tags-only', sectionID: 505, noteBody: '   ', tags: ['verify']}]
};
const before = structuredClone(summary);
const result = settingsSavedContentSnapshot(summary);
assert.equal(result.passages.length, 4, 'One row per exact passage; a link-only passage remains browsable.');
assert.equal(result.projectLinkCount, 3, 'Duplicate memberships count once; archived Project links remain real links.');
assert.equal(result.notes.length, 3, 'Identical legacy notes display once; different note text and editions remain separate.');
assert.equal(result.passages.find(entry => entry.key === 'nyc-2022:101:scope').item.id, 'legacy-copy');
assert.deepEqual(result.passages.find(entry => entry.key === 'nyc-2022:101:scope').projects.map(p => p.id), ['project-a', 'archived']);
assert(result.passages.some(entry => entry.key === 'nyc-2022:303:scope'));
assert(!result.passages.some(entry => [202,404,505].includes(entry.item.sectionID)));
assert.deepEqual(summary, before, 'Browsing and deduplication never mutate or delete original records.');
assert.deepEqual(settingsSavedContentSnapshot(), {passages: [], notes: [], projectLinkCount: 0});

// The source adapter supplies the same edition/block normalization used by Reader.
const normalized = settingsSavedContentSnapshot({savedItems: [saved, {...saved, id:'alias', codeVersion:'2022'}]}, {
  recordKey: item => `canonical:${item.sectionID}:${item.blockID}`
});
assert.equal(normalized.passages.length, 1);
assert.equal(settingsSavedContentTitle({sectionNumber:'101.1',title:'101.1 Title.'}), '101.1 Title.');
assert.equal(settingsSavedContentTitle({sectionNumber:'101.1',title:'Title.'}), '101.1 Title.');
assert.equal(settingsSavedContentTitle({sectionNumber:'101.1',title:'101.10 Other provision.'}), '101.1 101.10 Other provision.');
console.log('Saved Content snapshot passed: unique targets, editions, note variants, active memberships, link-only saves, tombstones, and immutable input.');

// A tiny DOM host exercises real event handlers without touching account data.
function host() {
  class Element extends EventTarget {
    constructor(tag) { super(); this.tagName=tag; this.children=[]; this.attributes={}; this.dataset={}; this.textContent=''; this.className=''; }
    get ownerDocument() { return document; }
    get isConnected() { return this.root === true || Boolean(this.parent?.isConnected); }
    append(...children) { for(const child of children){child.parent=this;this.children.push(child);} }
    replaceChildren(...children) { for(const child of this.children) child.parent=null;this.children=[];this.append(...children); }
    setAttribute(key,value) { this.attributes[key]=String(value); }
    getAttribute(key) { return this.attributes[key] ?? null; }
    focus() { document.activeElement=this; }
    querySelectorAll(selector) {
      const match = element => selector==='button' ? element.tagName==='button' : selector.startsWith('#') ? element.id===selector.slice(1)
        : selector.startsWith('.') ? element.className.split(' ').includes(selector.slice(1))
        : selector==='[data-browse-content]' ? Boolean(element.dataset.browseContent)
        : selector.startsWith('[data-browse-content=') && element.dataset.browseContent===selector.split('"')[1];
      return this.children.flatMap(child=>[...(match(child)?[child]:[]),...child.querySelectorAll(selector)]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    click() { this.dispatchEvent(new Event('click')); }
  }
  const document={createElement:tag=>new Element(tag)};
  const root=new Element('section');root.root=true;
  for(const kind of ['bookmarks','notes']) {
    const trigger=new Element('button');trigger.dataset.browseContent=kind;trigger.setAttribute('aria-controls',kind);
    const label=new Element('span');label.className='settings-content-view-label';trigger.append(label);
    const list=new Element('div');list.id=kind;list.hidden=true;root.append(trigger,list);
  }
  return {root,trigger:kind=>root.querySelector(`[data-browse-content="${kind}"]`),list:kind=>root.querySelector(`#${kind}`)};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const ui=host();let active=true, finishHydration, opened=0, assigned=0;
const controls=createSettingsSavedContent(ui.root, {
  isCurrent:()=>active,hydrate:items=>new Promise(resolve=>{finishHydration=()=>resolve(items.map(item=>({...item,title:'Hydrated title'})));}),
  codeLabel:()=> 'Building Code (2022)',projectID:p=>p.id,projectName:p=>p.name,
  availableProjects:()=>[project,{id:'b',name:'B'}],onOpen:async()=>{opened++;},onAssign:async()=>{assigned++;return {saved:true};},onRefresh(){}
});
controls.refresh({passages:result.passages.slice(0,1),notes:result.notes.slice(0,1)});
ui.trigger('bookmarks').click();await tick();
assert.equal(ui.list('bookmarks').querySelectorAll('.settings-library-row').length,1);
assert.equal(ui.trigger('bookmarks').getAttribute('aria-expanded'),'true');
const originalTitle=ui.list('bookmarks').querySelector('.settings-library-open').textContent;
active=false;finishHydration();await tick();
assert.equal(ui.list('bookmarks').querySelector('.settings-library-open').textContent,originalTitle,'Late hydration cannot publish after an account change.');
ui.list('bookmarks').querySelector('.settings-library-open').click();
ui.list('bookmarks').querySelector('.settings-library-action').click();
assert.equal(opened,0);assert.equal(assigned,0,'Stale account controls are inert.');
controls.dispose();active=true;ui.trigger('notes').click();
assert.equal(ui.list('notes').hidden,true,'Disposed views cannot reopen private lists.');

const working=host();let chosen=null;
const browsing=createSettingsSavedContent(working.root, {
  isCurrent:()=>true,hydrate:async items=>items.map(item=>({...item,title:'Scope',previewText:'Exact passage preview'})),
  codeLabel:()=> 'Building Code (2022)',projectID:p=>p.id,projectName:p=>p.name,
  availableProjects:()=>[project,{id:'b',name:'B'}],onOpen:async item=>{chosen=item;},
  onAssign:async (p,item)=>{chosen={project:p,item};return {saved:true};},onRefresh(){}
});
browsing.refresh({passages:[{...result.passages[0],projects:[project]}],notes:[result.notes[0]]});
working.trigger('bookmarks').click();await tick();
working.list('bookmarks').querySelector('.settings-library-action').click();
assert.equal(working.list('bookmarks').querySelectorAll('.settings-library-project-option').length,1,'Already-linked Projects are excluded from additive assignment.');
working.list('bookmarks').querySelector('.settings-library-project-option').click();await tick();
assert.equal(chosen.project.id,'b');assert.equal(chosen.item.previewText,'Exact passage preview');
working.trigger('notes').click();await tick();
assert.equal(working.list('bookmarks').hidden,true);assert.equal(working.list('notes').hidden,false);
assert.equal(working.list('notes').querySelector('.settings-library-preview').textContent,result.notes[0].item.noteBody);
browsing.refresh({passages:[],notes:[]});
assert.equal(working.list('notes').querySelectorAll('.settings-library-row').length,0,'Cleared notes cannot remain in the expanded list.');
assert.equal(working.list('notes').querySelector('.settings-library-empty').textContent,'No section notes in your account');
browsing.dispose();
console.log('Saved Content controls passed: exact previews, additive Project selection, empty refresh, one expanded list, late-response isolation, and cleanup.');
