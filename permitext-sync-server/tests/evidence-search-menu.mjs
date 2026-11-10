import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const renderSource = source.match(/^function renderSavedFilters\([\s\S]*?^}/m)?.[0];
assert.ok(renderSource);
const wrapper = {}, close = {}, document = {activeElement:null};
const input = {value:'', focus(){document.activeElement=this;}};
const form = {contains:node => node === input};
let menuButton = null, changes = 0, saves = 0, expansions = 0;
const nodes = new Map([
  ['.saved-inline-filters',wrapper], ['.saved-evidence-search',form],
  ['.saved-evidence-search-input',input], ['.saved-evidence-search-close',close]
]);
const panel = {querySelector:selector => selector === '.column-group-menu-button' ? menuButton
  : selector.startsWith('.saved-evidence-section-toggle') ? {click(){expansions++;}} : nodes.get(selector)};
const render = new Function('document','requestAnimationFrame','saveWorkspaceState',
  `${renderSource}; return renderSavedFilters;`)(document, callback => callback(), () => saves++);
const state = {folderQuery:'',evidenceSearchOpen:false};
render(panel,state,[{id:'saved'}],() => changes++);
assert.equal(panel._savedEvidenceSearch.available,true);
assert.equal(form.hidden,true);
panel._savedEvidenceSearch.toggle();
assert.equal(form.hidden,false);
assert.equal(document.activeElement,input);
assert.equal(expansions,1,'Menu search expands a closed legacy evidence section.');
input.value='28-101.3'; input.oninput();
assert.equal(state.folderQuery,'28-101.3');
assert.equal(changes,1);
panel._savedEvidenceSearch.toggle();
assert.equal(form.hidden,true);
assert.equal(state.folderQuery,'');
assert.equal(changes,2,'Closing from the menu clears the active filter.');
panel._savedEvidenceSearch.toggle();
menuButton={}; // The shared header control is installed after panel construction.
form.onfocusout({relatedTarget:menuButton});
assert.equal(form.hidden,false,'Opening the column menu keeps an empty search field open.');
close.onclick();
assert.equal(panel._savedEvidenceSearch.isOpen(),false);
assert.equal(input.value,'');
assert.equal(saves,5);
render(panel,state,[],() => changes++);
assert.equal(panel._savedEvidenceSearch.available,false);
assert.equal(wrapper.hidden,true);
console.log('Evidence menu search passed: focus, filtering, clearing, legacy section expansion, delayed menu binding and empty evidence.');
