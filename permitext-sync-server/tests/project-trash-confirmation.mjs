import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const app = await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const slice=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));
const body={};
const layer=vm.createContext({document:{body},HTMLElement:class {}});
vm.runInContext(slice('function resolveWebWarningContainer(', 'function mountWebWarningBackdrop('),layer);
assert.equal(layer.resolveWebWarningContainer(body),null,'An explicit body destination must use the global layer, never column z-index 20.');
for(const mode of ['cancel','recovery-unavailable']) {
 let preflights=0,deleted=0;
 const notices=[];
 const context=vm.createContext({document:{body},captureAccountRequest:()=>1,requireCurrentAccountRequest(){},projectRecordID:p=>p.id,folderRecordCountLabel:()=> '1 Project',track:{scrollLeft:0},
 confirmWebWarning:async(title,message,options)=>{assert.equal(options.container,body);assert.equal(options.confirmLabel,'Move to Trash');assert.match(message,/30 days/);assert.doesNotMatch(message,/permanently|cannot be undone/);return mode!=='cancel';},
 prepareRecoverableDeletion:async()=>{preflights++;throw new Error('Recovery unavailable');},deleteArchivedProjectData:async()=>{deleted++;},showWebNotice:async(...args)=>notices.push(args)});
 vm.runInContext(slice('async function deleteArchivedProjects(', 'async function deleteArchivedProjectData('),context);
 assert.equal(await context.deleteArchivedProjects([{id:'qa',name:'QA'}],{includeNames:true}),false);
 assert.equal(deleted,0);
 assert.equal(preflights,mode==='cancel'?0:1);
 assert.equal(notices.length,mode==='cancel'?0:1);
 if(notices.length)assert.equal(notices[0][2].container,body);
}
console.log('Project confirmation global layer, Cancel, recovery wording and unavailable-recovery guard passed.');
