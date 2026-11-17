import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {documentFixture} from './helpers/workflow-dom.mjs';
const app = await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const slice=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));
const body={};
const layer=vm.createContext({document:{body},HTMLElement:class {}});
vm.runInContext(slice('function resolveWebWarningContainer(', 'function mountWebWarningBackdrop('),layer);
assert.equal(layer.resolveWebWarningContainer(body),null,'An explicit body destination must use the global layer, never column z-index 20.');
const floatingPanel={isConnected:true};
for(const container of [undefined,floatingPanel]) for(const mode of ['cancel','recovery-unavailable']) {
 let preflights=0,deleted=0;
 const notices=[];
 const context=vm.createContext({document:{...documentFixture(),body},captureAccountRequest:()=>1,requireCurrentAccountRequest(){},projectRecordID:p=>p.id,folderRecordCountLabel:()=> '1 Project',track:{scrollLeft:0},
 confirmWebWarning:async(title,message,options)=>{assert.equal(options.container,container||body);assert.equal(options.confirmLabel,'Move to Trash');assert.match(message,/30 days/);assert.doesNotMatch(message,/permanently|cannot be undone/);return mode!=='cancel';},
 prepareRecoverableDeletion:async()=>{preflights++;throw new Error('Recovery unavailable');},deleteArchivedProjectData:async()=>{deleted++;},showWebNotice:async(...args)=>notices.push(args)});
 vm.runInContext(slice('async function deleteArchivedProjects(', 'async function deleteArchivedProjectData('),context);
 assert.equal(await context.deleteArchivedProjects([{id:'qa',name:'QA'}],{includeNames:true,container}),false);
 assert.equal(deleted,0);
 assert.equal(preflights,mode==='cancel'?0:1);
 assert.equal(notices.length,mode==='cancel'?0:1);
 if(notices.length)assert.equal(notices[0][2].container,container||body);
}
console.log('Project confirmation global and floating-panel scope, Cancel, recovery wording and unavailable-recovery guard passed.');

const names=Array.from({length:8},(_,index)=>`Project ${index+1} — ${'Long selected project name '.repeat(3)}`);
names[1]='<img src=x onerror=alert(1)>';
let confirmation;
const document={...documentFixture(),body};
const context=vm.createContext({document,captureAccountRequest:()=>1,requireCurrentAccountRequest(){},projectRecordID:p=>p.id,
 folderRecordCountLabel:()=> '8 Projects',confirmWebWarning:async(title,message,options)=>{confirmation={title,message,...options};return false;},
 prepareRecoverableDeletion(){throw new Error('Preview must not begin deletion');}});
vm.runInContext(slice('async function deleteArchivedProjects(', 'async function deleteArchivedProjectData('),context);
await context.deleteArchivedProjects(names.map((name,index)=>({id:String(index),name})));
assert.equal(confirmation.title,'Move 8 Projects to Trash?');
assert.match(confirmation.message,/30 days/);
assert.equal(confirmation.className,'project-trash-confirmation');
assert.deepEqual(confirmation.content.querySelectorAll('li').map(item=>item.textContent),names,'Every name stays separate, in order, and is inserted as text');
assert.match(confirmation.content.querySelector('.project-trash-scope').textContent,/another workspace stay/);
assert.match(confirmation.content.querySelector('.project-trash-recovery').textContent,/Manage workspaces → Deleted workspaces/);
console.log('Project Trash dialog passed: all selected names, long names, literal HTML, recovery path, shared-content scope and no mutation on Cancel.');
