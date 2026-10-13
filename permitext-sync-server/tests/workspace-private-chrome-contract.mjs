import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function actual(name){const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));const end=source.indexOf('\n}',start);assert.ok(start>=0&&end>start);return source.slice(start,end+2);}
class Element {
 constructor(tag='div'){this.tag=tag;this.children=[];this.style={};this.classList={add(){},toggle(){}};this.listeners={};}
 append(...children){this.children.push(...children);}
 setAttribute(key,value){this[key]=value;}
 addEventListener(key,callback){this.listeners[key]=callback;}
 getBoundingClientRect(){return {left:0,bottom:40,width:240,height:240};}
 querySelector(){return this.children.flatMap(child=>[child,...child.children]).find(child=>child.tag==='button'&&!child.disabled);}
 focus(){}
}
let allowed=false,privateReads=0,authority='unavailable',current=true,account={userID:'owner'};
const label={textContent:'Old private title'},container={hidden:false};
const button=new Element('button');
Object.assign(button,{disabled:false,title:'Old private title',closest:()=>container,querySelector:()=>label});
const body=new Element('body');
const layoutControl=new Element('button');layoutControl.textContent='Reset layout';
const state={get columnGroups(){privateReads++;return [{name:'Private group'}];}};
const context=vm.createContext({workspaceActionsButton:button,detachedProjectWindow:false,workspacePrivatePresentationAllowed:()=>allowed,
 captureAccountRequest:()=>({userID:account?.userID}),isCurrentAccountRequest:()=>current,activeAccount:()=>account,
 ensureSyncedContentForRender:async()=>({userID:account?.userID,workspacePresentationAccess:authority}),
 loadSyncedContent:async()=>({userID:account?.userID,workspacePresentationAccess:authority}),showWebNotice:async()=>{},
 activeWorkspaceRecord(){privateReads++;return{id:'project'};},visibleWorkspaceRecords(){privateReads++;return[{id:'project',name:'Private Project'}];},
 reconcileProjectWorkspaces(){privateReads++;},closeWorkspaceContextMenu(){body.children=[];},state,
 document:{createElement:tag=>new Element(tag),body,getElementById:id=>id==='fit-columns'?layoutControl:null},
 window:{innerWidth:1000,innerHeight:800},workspaceContextMenu:null,activeWorkspaceID:'project',updateWorkspaceLayoutControls(){},
 toggleAccountDialog(){},createNewWorkspace(){},openProjectManager(){},switchWorkspace(){}
});
const privateMenus=['openMobileMoreSheet','openWorkspaceManager','openSavedColumnGroupsMenu','openColumnGroupEditor'];
vm.runInContext(['renderWorkspaceTabs','openWorkspaceContextMenu',...privateMenus].map(actual).join('\n'),context);
context.renderWorkspaceTabs();
assert.equal(privateReads,0);assert.equal(label.textContent,'Workspace');assert.equal(button['aria-label'],'Workspace and view options');assert.equal(button.disabled,false);
for(const name of privateMenus) await context[name]();
assert.equal(privateReads,0,'unverified private-only menus may not read saved project state');
await context.openWorkspaceContextMenu('project',button);
const labels=()=>{const visit=node=>[node.textContent,...node.children.flatMap(visit)];return visit(body).filter(Boolean);};
assert.equal(privateReads,0,'public menu must not inspect private project names or saved groups');
assert.ok(labels().includes('View options'));assert.ok(labels().includes('Reset layout'));
assert.ok(labels().includes('Account & project access'));assert.ok(!labels().includes('Saved groups…'));
account=null;await context.openWorkspaceContextMenu('project',button);
assert.ok(labels().includes('Sign in for Projects'));assert.ok(labels().includes('Reset layout'));assert.equal(privateReads,0);
account={userID:'owner'};authority='verified';allowed=true;
context.renderWorkspaceTabs();assert.equal(label.textContent,'Private Project');assert.equal(button.disabled,false);
await context.openWorkspaceContextMenu('project',button);
assert.ok(labels().includes('Private Project'));assert.ok(labels().includes('Saved groups…'));assert.ok(labels().includes('Manage Projects…'));
const readsBefore=privateReads;body.children=[];current=false;
await context.openWorkspaceContextMenu('project',button);
assert.equal(body.children.length,0,'a stale account request cannot mount its menu');assert.equal(privateReads,readsBefore);
console.log('Workspace private chrome passed: public layout access, no private names/groups before verification, verified project actions, stale-account rejection.');
