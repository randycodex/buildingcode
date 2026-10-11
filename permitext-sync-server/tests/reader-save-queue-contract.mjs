import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const extract = (start,end) => source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const state={localSavedItems:[],localProjectSections:[]}, queue=new Map(), project={id:'p'};
const context=vm.createContext({state,queue,Date,Set,document:{activeElement:null},activeWorkspaceID:'w',
  requirePrivateWorkspaceWritable(){},captureAccountRequest:()=>({userID:'u'}),requireCurrentAccountRequest(){},
  activeAccount:()=>({userID:'u'}),workspaceProject:()=>project,savedItemForSection:()=>null,
  primarySavedPaneID:()=>'',currentContentSummary:()=>({projects:[]}),hasCapability:()=>true,
  projectRecordID:p=>p.id,syncCodeVersion:x=>x,defaultSyncCodeVersion:'edition',setLocalSectionSaved(){},
  savedEvidenceKey:x=>x.sectionID,savedRecordForSection:x=>({...x,id:x.sectionID}),
  savedMutationForSection:x=>({savedItem:{...x,id:x.sectionID}}),saveWorkspaceState(){},
  projectSectionRecordForSection:(p,x)=>({...x,id:`project-${x.sectionID}`}),
  projectSectionMutationForSection:(p,x)=>({projectSection:{...x,id:`project-${x.sectionID}`}}),
  enqueueSyncMutation(m){ const record=Object.values(m)[0];queue.set(record.id,m); },
  refreshProjectMembershipPanes(){
    assert.equal(queue.size>=2,true,'Both records must be durable before rendering begins');
    return Promise.reject(new Error('Rendering failed'));
  },
  refreshOpenSavedPanes:()=>Promise.reject(new Error('Rendering failed')),
  refreshProjectSourceConsumers:()=>Promise.reject(new Error('Rendering failed')),
  pushMutation:()=>Promise.reject(new Error('Offline')),
  isSessionAuthenticationError:()=>false
});
vm.runInContext(extract('async function persistSectionBookmark(', 'async function persistSectionInProject(')+
 extract('async function persistSectionInProject(', '\nasync function removeSectionFromProject('),context);
const results=await Promise.all(['a','b','c'].map(sectionID=>context.persistSectionBookmark({sectionID,codeVersion:'edition'},true)));
assert(results.every(Boolean));
assert.equal(queue.size,6,'All rapid saves and project links remain queued after network and render failures');
assert.equal(state.localSavedItems.length,3);
assert.equal(state.localProjectSections.length,3);
console.log('Rapid Reader saves retain all records and project links before failed refreshes or offline sync.');
