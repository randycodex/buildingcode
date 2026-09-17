import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {syncProjectIdentity} from '../public/sync-identity.js';
const source=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
function actualFunction(name) {
 const match=new RegExp(`(?:async )?function ${name}\\(`).exec(source);
 assert.ok(match, name);
 return source.slice(match.index, source.indexOf('\n}',match.index)+2);
}
function adapterMethod(which) {
 const positions=[...source.matchAll(/    async listOwnedProjectMutations\(userID\) \{/g)].map(m=>m.index);
 assert.equal(positions.length,2);
 const start=positions[which];
 return source.slice(start,source.indexOf('\n    },',start)+6).trim().replace(/^async /,'async function ');
}
const identity = record => ({project:record});
function harness(records) {
 const reads=[],ownerships=new Map(),memberships=new Map();
 let fail=false;
 const context=vm.createContext({Map,Date,Set,Promise,Number,String,Array,
  syncProjectIdentity,
  mutationKindAndRecord: mutation=>{const [kind,record]=Object.entries(mutation)[0]||[];return {kind,record};},
  storeAdapter: async()=>({listOwnedProjectMutations:async user=>{reads.push(user);if(fail)throw Error('Quota unavailable');return records[user]||[];}}),
  readStore:()=>{throw Error('Whole-store read forbidden');},
  ownerScope:id=>({kind:'user',id}), projectOwnershipRecord:x=>x,
  organizationOwnerScope:id=>({kind:'organization',id}),
  rolePermissions:role=>role==='viewer'||role==='owner'||role==='editor'?['view']:[],
  organizationPermissions:{projectView:'view'},
  storedProjectOwnership:async id=>ownerships.get(id)||null,
  storedOrganization:async()=>({id:'org',status:'active'}),
  storedProjectMembership:async(id,user)=>memberships.get(`${id}:${user}`)||null,
  storedOrganizationMembership:async()=>null,
  authenticatedResearchBody:async request=>({body:request.body,userID:request.userID}),
  storedArtifactRevisionState:async(user,{projectIDs=[]})=>({storageOwnerUserID:user,projects:projectIDs.map(projectID=>({projectID,revision:0}))}),
  sendError:(response,status,error)=>Object.assign(response,{status,error}),
  sendJSON:(response,status,json)=>Object.assign(response,{status,json})
 });
 for(const name of ['projectIdentityForRecord','ownedProjectRecord','projectAccessForUser','handleProjectArtifactCheckpoint']) vm.runInContext(actualFunction(name),context);
 return {context,reads,ownerships,memberships,setFailure:()=>{fail=true;}};
}

test('Postgres project lookup binds user and returns only project rows in existing record order',async()=>{
 const calls=[];
 const context=vm.createContext({ensureSchema:async()=>{},migrateLegacyStateIfNeeded:async()=>{},
  sql:async(strings,...values)=>{calls.push({text:strings.join('?'),values});return [{mutation:JSON.stringify({project:{id:'a'}})},{mutation:{project:{id:'b'}}}];},
  safeJSON:(v,f)=>v==null?f:typeof v==='string'?JSON.parse(v):v
 });
 vm.runInContext(adapterMethod(1),context);
 const result=await context.listOwnedProjectMutations('owner-isolated');
 assert.equal(calls.length,1);
 assert.match(calls[0].text,/SELECT mutation FROM permitext_projects\s+WHERE user_id = \?\s+ORDER BY record_id/);
 assert.deepEqual(calls[0].values,['owner-isolated']);
 assert.deepEqual(Array.from(result,m=>m.project.id),['a','b']);
});

test('File adapter retains per-user project mutation order',async()=>{
 const context=vm.createContext({});vm.runInContext(adapterMethod(0),context);
 const a=identity({id:'a'}),b=identity({id:'b'});
 const result=await context.listOwnedProjectMutations.call({read:async()=>({mutationsByUserID:{owner:[a,{annotation:{id:'note'}},b],other:[identity({id:'secret'})]}})},'owner');
 assert.deepEqual(Array.from(result),[a,b]);
});

test('Owned project resolution preserves ID client legacy deletion reference and first-match behavior',async()=>{
 const rows=[identity({id:'record',clientID:'web-project-client'}),identity({id:'older',clientID:'duplicate',name:'first'}),identity({id:'newer',clientID:'duplicate',name:'second'}),identity({id:'',localFolderID:17}),identity({id:'deleted',deletedAt:'2026-09-16T00:00:00Z'}),identity({id:'reference',folderType:'reference'}),identity({id:'invalid-date',deletedAt:'not-a-date'})];
 const h=harness({owner:rows,other:[identity({id:'secret'})]});
 for(const id of ['record','web-project-client']) assert.equal(await h.context.ownedProjectRecord('owner',id),rows[0].project);
 assert.equal((await h.context.ownedProjectRecord('owner','duplicate')).name,'first');
 assert.equal(await h.context.ownedProjectRecord('owner','legacy-project-17'),rows[3].project);
 for(const id of ['deleted','reference','secret']) assert.equal(await h.context.ownedProjectRecord('owner',id),null);
 assert.equal(await h.context.ownedProjectRecord('owner','invalid-date'),rows[6].project);
});

test('Checkpoint authorization uses owner scoped reads once per request, never whole store',async()=>{
 const h=harness({owner:[identity({id:'p1'}),identity({id:'p2'}),identity({id:'deleted',deletedAt:'2026-09-16T00:00:00Z'}),identity({id:'reference',folderType:'reference'}),identity({id:'',localFolderID:27})]});
 h.ownerships.set('p1',{owner:{kind:'user',id:'owner'},storageOwnerUserID:'owner'});
 const first={};await h.context.handleProjectArtifactCheckpoint({userID:'owner',body:{projectIDs:['p1','p2']}},first);
 assert.equal(first.status,200);assert.deepEqual(h.reads,['owner']);
 const second={};await h.context.handleProjectArtifactCheckpoint({userID:'owner',body:{projectIDs:['p1']}},second);
 assert.deepEqual(h.reads,['owner','owner'],'No global cache may survive a request');
 const denied={};await h.context.handleProjectArtifactCheckpoint({userID:'other',body:{projectIDs:['p1']}},denied);
 assert.equal(denied.status,404);assert.equal(h.reads.length,2,'Reject mismatched owner before reading private records');
 h.ownerships.set('p1',{owner:{kind:'organization',id:'org'},storageOwnerUserID:'owner'});
 h.memberships.set('p1:member',{status:'active',role:'viewer'});
 const member={};await h.context.handleProjectArtifactCheckpoint({userID:'member',body:{projectIDs:['p1']}},member);
 assert.equal(member.status,200);assert.equal(h.reads.at(-1),'owner');
 h.memberships.set('p1:member',{status:'revoked',role:'viewer'});
 const revoked={};await h.context.handleProjectArtifactCheckpoint({userID:'member',body:{projectIDs:['p1']}},revoked);
 assert.equal(revoked.status,404);
 for (const id of ['deleted','reference']) {
  const unavailable={};await h.context.handleProjectArtifactCheckpoint({userID:'owner',body:{projectIDs:[id]}},unavailable);
  assert.equal(unavailable.status,404);
 }
 const legacy={};await h.context.handleProjectArtifactCheckpoint({userID:'owner',body:{projectIDs:['legacy-project-27']}},legacy);
 assert.equal(legacy.status,200);assert.equal(legacy.json.projects[0].projectID,'legacy-project-27');
 h.setFailure();
 await assert.rejects(h.context.handleProjectArtifactCheckpoint({userID:'owner',body:{projectIDs:['p2']}},{}),/Quota unavailable/);
});


test('Checkpoint request cache never combines distinct storage owners',async()=>{
 const h=harness({one:[identity({id:'p1'})],two:[identity({id:'p2'})]});
 for(const [id,owner] of [['p1','one'],['p2','two']]) {
  h.ownerships.set(id,{owner:{kind:'organization',id:'org'},storageOwnerUserID:owner});
  h.memberships.set(`${id}:member`,{status:'active',role:'viewer'});
 }
 const response={};await h.context.handleProjectArtifactCheckpoint({userID:'member',body:{projectIDs:['p1','p2']}},response);
 assert.equal(response.status,200);assert.deepEqual(h.reads,['one','two']);
 assert.deepEqual(Array.from(response.json.projects,p=>p.storageOwnerUserID),['one','two']);
});
