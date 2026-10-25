import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {reportsContainingSource} from '../public/project-workflow.js';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const start=app.indexOf('async function openIncludedSourceReport('),end=app.indexOf('\n}',start);
for (const kind of ['notebookCard','evidence','researchAnswer']) {
 for (const mode of ['open','removed','switch','multiple','cancel','failed']) {
  const sourceID=kind+':exact';const report={id:'r1',title:'Chosen Report',blocks:[{kind,sourceID}]};
  const button={isConnected:true,dataset:{reportSourceKind:kind,reportResolvedSourceId:sourceID,reportIncludedDraftIds:'["r1"]'}};
  const pending=new Map(),opened=[];let refreshed=0;
  const c=vm.createContext({captureAccountRequest:()=>1,isCurrentAccountRequest:()=>mode!=='switch',activeWorkspaceID:'w',
   projectDetailKey:p=>p.id,projectIdentity:p=>p,reportsContainingSource,pendingReportDraftByProject:pending,
   refreshProjectReportMembership:async()=>refreshed++,postResearch:async()=>({drafts:mode==='removed'?[]:mode==='multiple'||mode==='cancel'?[report,{...report,id:'r2'}]:[report]}),
   openWebWarning:async()=>mode==='cancel'?false:'r2',openProjectReportDraft:async()=>{opened.push(pending.get('p'));if(mode==='failed')throw Error('Unavailable');}});
  vm.runInContext(app.slice(start,end+2),c);
  if(mode==='failed')await assert.rejects(c.openIncludedSourceReport(button,{id:'p'}),/Unavailable/);
  else {const result=await c.openIncludedSourceReport(button,{id:'p'});assert.equal(result,mode!=='removed');}
  assert.equal(pending.size,0,'Pending navigation cannot leak into a later Report opening');
  assert.deepEqual(opened,['open','failed'].includes(mode)?['r1']:mode==='multiple'?['r2']:[]);
  assert.equal(refreshed,mode==='removed'?1:0);
 }
}
assert.equal(reportsContainingSource([{id:'snapshot',blocks:[{kind:'snapshot',derivedFrom:{kind:'notebookCard',id:'n'}}]}],'notebookCard','n').length,1);
console.log('Report membership navigation: Notes/evidence/answers, exact source ID, existing Note snapshots, multiple destinations, removal, cancellation, failed opening and stale account guards passed.');
