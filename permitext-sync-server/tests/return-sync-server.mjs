import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../app.mjs',import.meta.url),'utf8');
const method=(name,adapter)=>{const start=source.indexOf(`    async ${name}(`,source.indexOf(adapter));assert(start>=0,name);return source.slice(start,source.indexOf('\n    },',start)+6);};
for(const kind of ['file','postgres']) {
  let queries=0;
  const c=vm.createContext({ensureSchema:async()=>{},migrateLegacyStateIfNeeded:async()=>{},
    latestEventID:async userID=>{assert.equal(userID,'u');return 8;},
    normalizedMutationRecordID:m=>Object.values(m)[0].id,
    mutationKindAndRecord:m=>({record:Object.values(m)[0]}),
    sql:async(strings,...values)=>{
      queries++;const query=strings.join('?');
      assert.match(query,/WHERE records.user_id = \?/);assert.match(query,/events.user_id = \?/);
      assert.match(query,/events.event_id > \?/);assert.match(query,/NOT IN \('continuity', 'workboard'\)/);
      assert.doesNotMatch(query,/SELECT records\.mutation/,'Content bodies cannot be selected');
      assert.deepEqual(values,['u','u',3]);
      return [{record_id:'p',updated_at:'2026-10-24T12:00:00Z'}];
    }});
  const adapter=vm.runInContext(`({${method('contentChangeVersions',kind==='file'?'export function createFileStoreAdapter()':'async function createPostgresStoreAdapter()')}})`,c);
  adapter.read=async()=>({syncRevisionsByUserID:{u:8},mutationsByUserID:{u:[
    {project:{id:'p',name:'Private content',updatedAt:'2026-10-24T12:00:00Z'}},
    {continuity:{id:'reading-history'}},{workboard:{id:'old-layout'}}],other:[{project:{id:'foreign'}}]}});
  const result=await adapter.contentChangeVersions('u',3);
  assert.equal(result.latestEventID,8);
  assert.deepEqual(JSON.parse(JSON.stringify(result.records)),[{recordID:'p',updatedAt:kind==='postgres'?'2026-10-24T12:00:00.000Z':'2026-10-24T12:00:00Z'}]);
  if(kind==='file')assert.deepEqual(Array.from((await adapter.contentChangeVersions('u',8)).records),[]);
  else assert.equal(queries,1);
}

const start=source.indexOf('async function handleProjectArtifactCheckpoint(');
const handler=source.slice(start,source.indexOf('\n}',start)+2);
for(const scenario of ['allowed','unauthenticated','foreign-project','invalid-cursor','legacy']) {
  const reads=[];
  const c=vm.createContext({
    authenticatedResearchBody:async()=>scenario==='unauthenticated'?null:{userID:'u',body:{projectIDs:['p'],
      ...(scenario==='legacy'?{}:{includeContentChanges:true,sinceEventID:scenario==='invalid-cursor'?-1:3})}},
    projectAccessForUser:async userID=>{assert.equal(userID,'u');return scenario==='foreign-project'?null:{projectID:'p',storageOwnerUserID:'owner',permissions:['view']};},
    organizationPermissions:{projectView:'view'},
    storedArtifactRevisionState:async(userID,options)=>{reads.push(['artifacts',userID]);assert.deepEqual(Array.from(options.projectIDs),['p']);return {storageOwnerUserID:userID,projects:[{projectID:'p',revision:2}]};},
    storeAdapter:async()=>({contentChangeVersions:async(userID,cursor)=>{reads.push(['content',userID,cursor]);return {latestEventID:8,records:[]};}}),
    sendJSON:(res,status,body)=>Object.assign(res,{status,body}),sendError:(res,status)=>Object.assign(res,{status})});
  vm.runInContext(handler,c);const response={};await c.handleProjectArtifactCheckpoint({},response);
  if(scenario==='allowed'){assert.equal(response.status,200);assert.deepEqual(reads,[['artifacts','owner'],['content','u',3]]);assert.equal(response.body.contentChanges.latestEventID,8);}
  if(scenario==='legacy'){assert.equal(response.status,200);assert.equal(response.body.contentChanges,undefined);assert.deepEqual(reads,[['artifacts','owner']]);}
  if(scenario==='invalid-cursor'){assert.equal(response.status,400);assert.deepEqual(reads,[]);}
  if(scenario==='foreign-project'){assert.equal(response.status,404);assert.deepEqual(reads,[]);}
  if(scenario==='unauthenticated')assert.deepEqual(reads,[]);
}
console.log('Return sync server passed: metadata-only file/Postgres reads, user/event scope, ignored history/layouts, authorization-before-data, invalid cursors, and unchanged legacy response.');
