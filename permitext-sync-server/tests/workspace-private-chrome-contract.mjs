import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function actual(name){const start=source.search(new RegExp(`function ${name}\\(`));const end=source.indexOf('\n}',start);assert.ok(start>=0&&end>start);return source.slice(start,end+2);}
let allowed=false,privateReads=0;
const label={textContent:'Old private title'},container={hidden:false};
const button={disabled:false,title:'Old private title',closest:()=>container,querySelector:()=>label,setAttribute(k,v){this[k]=v;}};
const context=vm.createContext({workspaceActionsButton:button,detachedProjectWindow:false,workspacePrivatePresentationAllowed:()=>allowed,
 activeWorkspaceRecord(){privateReads++;return{id:'project'};},visibleWorkspaceRecords(){privateReads++;return[{id:'project',name:'Private Project'}];}});
const menus=['openMobileMoreSheet','openWorkspaceContextMenu','openWorkspaceManager','openSavedColumnGroupsMenu','openColumnGroupEditor'];
vm.runInContext(['renderWorkspaceTabs',...menus].map(actual).join('\n'),context);
context.renderWorkspaceTabs();assert.equal(privateReads,0);assert.equal(label.textContent,'Workspace');assert.equal(button.title,'Workspace');assert.equal(button['aria-label'],'Workspace');assert.equal(button.disabled,true);
for(const name of menus) context[name](); // No private dependencies exist in the fixture: any access would throw.
assert.equal(privateReads,0);
allowed=true;context.renderWorkspaceTabs();assert.equal(label.textContent,'Private Project');assert.equal(button.disabled,false);assert.equal(privateReads,2);
console.log('Workspace private chrome passed: pending menus read no private state; neutral tab labels upgrade after permission.');
