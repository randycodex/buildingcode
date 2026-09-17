import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const helperStart=source.indexOf('function pendingAnnotationNoteForTarget(');
const helper=source.slice(helperStart,source.indexOf('\nfunction setAnnotationNoteValue',helperStart));
const start=source.indexOf('  let noteRevision = 0;');
const editor=source.slice(start,source.indexOf('\n  content.append(codeLabelElement',start));
class Element {
 constructor(){this.textContent='';this.children=[];this.events={};}
 replaceChildren(){this.children=[];this.textContent='';}
 append(...children){this.children.push(...children);}
 addEventListener(event,callback){this.events[event]=callback;}
 setAttribute(){}
 querySelectorAll(){return this.children.filter(x=>typeof x==='object');}
}
function harness({error='Socket closed',entryOverrides={},rejected=false,displayedBody}={}){
 const annotation={id:'original-annotation',userID:'owner',codeVersion:'1968',sectionID:598,blockID:null,noteBody:'Retained original draft',updatedAt:'2026-09-16T12:00:00Z'};
 const entry={id:'owner:original-annotation',accountUserID:'owner',recordID:annotation.id,queuedAt:'2026-09-16T12:00:01Z',attemptCount:2,lastError:error,mutation:{annotation},...entryOverrides};
 const state={syncOutbox:rejected?[]:[entry],syncConflicts:rejected?[entry]:[],localAnnotations:[{...annotation}]};
 const saveState=new Element(),textarea=new Element();textarea.value=displayedBody??annotation.noteBody;
 const panel={isConnected:false};const callbacks=[];let reviews=0;let writes=0,flush=async()=>{state.syncOutbox=[];},current=true;
 const c=vm.createContext({state,saveState,textarea,panel,sectionTarget:{codeVersion:'1968',sectionID:598,blockID:null},
  toggleAccountDialog:()=>{reviews++;},activeAccount:()=>({userID:'owner'}),syncCodeVersion:v=>v,normalizeAnnotationBlockID:v=>v||'',
  Object,String,clearTimeout:()=>{},window:{setTimeout:()=>1},document:{createElement:()=>new Element()},
  captureAccountRequest:()=>({userID:'owner'}),requireCurrentAccountRequest:()=>{if(!current)throw Error('Account changed');},isCurrentAccountRequest:()=>current,
  flushSyncOutbox:()=>flush(),saveWorkspaceState:()=>{},
  setAnnotationNoteValue:(_target,value,callback)=>{writes++;callbacks.push(callback);return true;},
  noteValueForTarget:()=>annotation.noteBody,syncReaderNoteControls:()=>{}
 });
 vm.runInContext(helper+'\n'+editor,c);panel.isConnected=true;
 return {state,saveState,textarea,panel,entry,callbacks,setFlush:fn=>{flush=fn;},writes:()=>writes,reviews:()=>reviews,changeAccount:()=>{current=false;},retry:()=>saveState.children.find(x=>x?.events?.click)?.events.click()};
}

test('Reloaded failed Detail note immediately exposes Retry and reuses exact durable mutation',async()=>{
 const h=harness();assert.equal(h.saveState.children[0],'Couldn’t sync · ');
 const body=JSON.stringify(h.entry);let observed;
 h.setFlush(async()=>{observed=JSON.stringify(h.state.syncOutbox[0]);throw Error('Still offline');});
 await h.retry();assert.equal(observed,body);assert.equal(h.writes(),0);assert.equal(JSON.stringify(h.state.syncOutbox[0]),body);assert.equal(h.textarea.value,'Retained original draft');
 assert.equal(h.saveState.children[0],'Couldn’t sync · ');
 h.setFlush(async()=>{h.state.syncOutbox=[];});await h.retry();
 assert.equal(h.writes(),0);assert.equal(h.saveState.textContent,'Synced');assert.equal(h.state.localAnnotations.length,0);assert.equal(h.textarea.value,'Retained original draft');
});

test('Queued note without previous failure remains actionable after reopen',()=>{
 const h=harness({error:null});assert.equal(h.saveState.children[0],'Changes pending · ');assert.ok(h.saveState.children[1].events.click);
});

test('Unrelated owner edition section or block never restores another note status',()=>{
 for(const change of [{accountUserID:'other'},{mutation:{annotation:{userID:'other',codeVersion:'1968',sectionID:598,noteBody:'private'}}},{mutation:{annotation:{userID:'owner',codeVersion:'2022',sectionID:598,noteBody:'private'}}},{mutation:{annotation:{userID:'owner',codeVersion:'1968',sectionID:599,noteBody:'private'}}},{mutation:{annotation:{userID:'owner',codeVersion:'1968',sectionID:598,blockID:'different',noteBody:'private'}}},{mutation:{annotation:{userID:'owner',codeVersion:'1968',sectionID:598,tags:['tag-only']}}}]){
  const h=harness({entryOverrides:change});assert.equal(h.saveState.children.length,0);
 }
});

test('Old retry cannot overwrite newer edit status or clear its local draft',async()=>{
 const h=harness();let release;h.setFlush(()=>new Promise(resolve=>{release=resolve;}));
 const old=h.retry();h.textarea.value='Newer draft';h.textarea.events.input();
 h.state.localAnnotations=[{...h.entry.mutation.annotation,noteBody:'Newer draft',updatedAt:'2026-09-16T13:00:00Z'}];
 release();await old;assert.equal(h.saveState.textContent,'Saving…');assert.equal(h.textarea.value,'Newer draft');assert.equal(h.state.localAnnotations.length,1);assert.equal(h.writes(),1);
});

test('Server-rejected pending retry is not displayed as Synced',async()=>{
 const h=harness();h.setFlush(async()=>{h.state.syncOutbox=[];h.state.syncConflicts=[h.entry];});await h.retry();
 assert.equal(h.saveState.children[0],'Save conflict · ');assert.equal(h.state.localAnnotations.length,1);
 assert.equal(h.textarea.readOnly,true);await h.retry();assert.equal(h.reviews(),1);assert.equal(h.writes(),0);
});

 test('Rejected note survives reopen and requires explicit conflict review instead of transport Retry',async()=>{
 const h=harness({rejected:true,displayedBody:'Newer server copy'});const original=JSON.stringify(h.state.syncConflicts);
 assert.equal(h.saveState.children[0],'Save conflict · ');assert.equal(h.saveState.children[1].textContent,'Review conflict');
 assert.equal(h.textarea.readOnly,true);assert.equal(h.textarea.value,'Retained original draft');
 await h.retry();h.textarea.events.input();
 assert.equal(h.reviews(),1);assert.equal(h.writes(),0);assert.equal(h.state.syncOutbox.length,0);assert.equal(JSON.stringify(h.state.syncConflicts),original);
 });
 test('Previously rendered Retry cannot restage a newly rejected annotation',async()=>{
 const h=harness();const staleRetry=h.saveState.children[1].events.click;
 h.state.syncOutbox=[];h.state.syncConflicts=[h.entry];await staleRetry();
 assert.equal(h.writes(),0);assert.equal(h.saveState.children[1].textContent,'Review conflict');assert.equal(h.state.syncConflicts.length,1);
 });

 test('Conflict display preserves a newer local draft over rejected and server versions',async()=>{
 const h=harness();h.state.localAnnotations=[{...h.entry.mutation.annotation,noteBody:'Newer local draft',updatedAt:'2026-09-16T13:00:00Z'}];
 h.setFlush(async()=>{h.state.syncOutbox=[];h.state.syncConflicts=[h.entry];});await h.retry();
 assert.equal(h.textarea.value,'Newer local draft');assert.equal(h.state.syncConflicts[0].mutation.annotation.noteBody,'Retained original draft');
 });

for(const fails of [false,true])test(`Account conflict resolution ${fails?'failure retains enabled actions':'success refreshes the open overlay'}`,async()=>{
 const state={syncConflicts:[{accountUserID:'owner',mutation:{annotation:{noteBody:'Local draft'}}}]};
 const card=new Element(),summary=new Element(),list=new Element();
 const c=vm.createContext({state,panel:{isConnected:true},settingsIdentity:{},isCurrentAccountRequest:()=>true,activeAccount:()=>({userID:'owner'}),
  syncConflictsCard:card,syncConflictsSummary:summary,syncConflictsList:list,document:{createElement:()=>new Element()},
  mutationKindAndRecord:m=>({kind:'annotation',record:m.annotation}),setStatus:()=>{},resolveSyncConflict:async()=>{if(fails)throw Error('Offline');state.syncConflicts=[];}});
 const start=source.indexOf('  const renderSyncConflictReview = () => {');
 vm.runInContext(source.slice(start,source.indexOf('\n  const settingsProjects',start))+'\nrenderSyncConflictReview();',c);
 const actions=list.children[0].children.at(-1),button=actions.children[0];await button.events.click();
 if(fails){assert.equal(card.hidden,false);assert.equal(list.children.length,1);assert.ok(actions.children.every(b=>!b.disabled));}
 else{assert.equal(card.hidden,true);assert.equal(list.children.length,0);assert.equal(summary.textContent,'');}
});

test('Real unfocused Detail refresh preserves recovery text until explicit resolution',()=>{
 const h=harness({rejected:true,displayedBody:'Server copy'});
 const start=source.indexOf('  track.querySelectorAll(".section-detail-panel").forEach((panel) => {');
 const snippet=source.slice(start,source.indexOf('\n  openProjectDetails()',start));
 const target={codeVersion:'1968',sectionID:598,blockID:null};
 const notes={dispatchEvent:()=>{},querySelector:()=>h.textarea};
 const panel={__annotationTarget:target,__sectionPayload:target,querySelector:()=>notes};
 const c=vm.createContext({state:h.state,activeAccount:()=>({userID:'owner'}),syncCodeVersion:v=>v,normalizeAnnotationBlockID:v=>v||'',noteValueForTarget:()=> 'Server copy',
 track:{querySelectorAll:()=>[panel]},focusedElement:null,isSectionSaved:()=>true,CustomEvent:class{}});
 vm.runInContext(helper+'\n'+snippet,c);assert.equal(h.textarea.value,'Retained original draft');
 h.state.syncConflicts=[];h.state.syncOutbox=[h.entry];vm.runInContext(snippet,c);assert.equal(h.textarea.value,'Retained original draft');
 h.state.syncOutbox=[];vm.runInContext(snippet,c);assert.equal(h.textarea.value,'Server copy');
});

test('Explicit Keep mine submits the same newer local body shown in Detail',async()=>{
 const h=harness({rejected:true});h.state.localAnnotations=[{...h.entry.mutation.annotation,noteBody:'Newer local draft',updatedAt:'2026-09-16T13:00:00Z'}];
 let submitted;
 const c=vm.createContext({state:h.state,captureAccountRequest:()=>({userID:'owner'}),activeAccount:()=>({userID:'owner'}),
 syncCodeVersion:v=>v,normalizeAnnotationBlockID:v=>v||'',noteValueForTarget:()=> 'Server copy',mutationKindAndRecord:m=>({kind:'annotation',record:m.annotation}),
 enqueueSyncMutation:m=>{submitted=m;},flushSyncOutbox:async()=>{},requireCurrentAccountRequest:()=>{},renderWorkspace:async()=>{}});
 const start=source.indexOf('async function resolveSyncConflict(');vm.runInContext(helper+'\n'+source.slice(start,source.indexOf('\nfunction scheduleSyncOutboxRetry',start)),c);
 c.entry=h.entry;await vm.runInContext('resolveSyncConflict(entry,true)',c);
 assert.equal(submitted.annotation.noteBody,'Newer local draft');assert.equal(submitted.annotation.id,h.entry.mutation.annotation.id);
 assert.equal(h.entry.mutation.annotation.noteBody,'Retained original draft');
});
