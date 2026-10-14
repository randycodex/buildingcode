import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const start = source.indexOf('  async function deleteVersion(report, trigger) {');
assert(start > 0);
const implementation = source.slice(start,source.indexOf('\n  function renderHistory',start));
function harness({confirmed=true,fail=false}={}) {
 const version={id:'version-a',title:'Frozen report',reportVersion:3};
 const versionsScope={}, historyBody={scrollTop:127,replaceChildren(){c.cleared++}};
 const c=vm.createContext({disposed:false,generatingReport:false,deletingReport:false,deletingVersionID:null,historyMutationGeneration:0,
  requestIdentity:'account',requestWorkspaceID:'workspace',activeWorkspaceID:'workspace',current:true,projectID:'project',
  version,history:[version,{id:'version-b'}],activeDraft:{title:'Unsaved title',blocks:[{text:'Unsaved text'}]},dirty:true,
  shell:{inert:false},panel:{querySelector:selector=>selector==='.report-history'?historyBody:null,_updateReportColumns(){c.availabilityUpdates++;}},
  trigger:{disabled:false,isConnected:true,closest:()=>versionsScope,focus(){c.focused++}},
  focused:0,cleared:0,renders:0,availabilityUpdates:0,calls:[],confirmations:[],closed:[],message:'',
  isCurrentAccountRequest:()=>c.current,
  confirmWebWarning:async(...args)=>{c.confirmations.push(args);return confirmed},
  reportRequest:async(path,body)=>{c.calls.push({path,body});if(fail)throw Error('Offline');return{}},
  comparisonController:{removeVersion:id=>c.closed.push(id)},
  clearStatus:()=>{c.message=''},showStatusError:message=>{c.message=message},renderHistory:()=>{c.renders++}});
 vm.runInContext(implementation+'\nglobalThis.remove=deleteVersion;',c);
 return{c,historyBody,versionsScope};
}
for(const mode of ['success','cancel','failure']) {
 const{c,historyBody,versionsScope}=harness({confirmed:mode!=='cancel',fail:mode==='failure'});
 const draft=c.activeDraft,blocks=draft.blocks;
 assert.equal(await c.remove(c.version,c.trigger),mode==='success');
 assert.equal(c.confirmations[0][2].scope,versionsScope,'Confirmation stays in Versions');
 assert.equal(c.history.length,mode==='success'?1:2);
 assert.equal(c.renders,mode==='success'?1:0,'Only the version list is rebuilt');
 assert.equal(c.availabilityUpdates,mode==='success'?1:0,'Only confirmed deletion updates comparison availability');
 assert.equal(c.activeDraft,draft);assert.equal(c.activeDraft.blocks,blocks);assert.equal(c.dirty,true);
 assert.equal(historyBody.scrollTop,127);assert.equal(c.shell.inert,false);assert.equal(c.trigger.disabled,false);
 assert.equal(c.deletingVersionID,null);
 if(mode==='success') {
  assert.equal(c.calls[0].path,'/reports/history/delete');
  assert.equal(c.calls[0].body.manifestID,'version-a');
  assert.deepEqual(Array.from(c.closed),['version-a']);
 } else assert.equal(c.closed.length,0,'Cancel and failed requests retain the preview');
 if(mode==='failure')assert.equal(c.message,'Offline');
}
for(const phase of ['confirmation','request'])for(const change of ['account','workspace','disposed']) {
 const{c}=harness();
 const mutate=()=>{if(change==='account')c.current=false;if(change==='workspace')c.activeWorkspaceID='different';if(change==='disposed')c.disposed=true;};
 if(phase==='confirmation')c.confirmWebWarning=async()=>{mutate();return true};
 else c.reportRequest=async()=>{mutate();return{}};
 assert.equal(await c.remove(c.version,c.trigger),false);
 assert.equal(c.history.length,2);assert.equal(c.closed.length,0);assert.equal(c.focused,0);
}
{
 const{c}=harness();let confirm;
 c.confirmWebWarning=()=>new Promise(resolve=>{confirm=resolve});
 const pending=c.remove(c.version,c.trigger);
 assert.equal(await c.remove(c.version,c.trigger),false,'Duplicate deletion cannot open another warning');
 assert.equal(c.shell.inert,true);confirm(true);assert.equal(await pending,true);
}
console.log('Report version deletion UI passed: scoped confirmation, Cancel/error preservation, dirty editor identity, list scroll, duplicate and account/workspace fences.');
