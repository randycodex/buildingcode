import assert from 'node:assert/strict';
import {withoutPersistentSearchQueries,writeSearchQuerySession,restoreSearchQuerySession,startSearchQuerySession} from '../public/search-query-session.js';
class Storage {
  values=new Map();
  get length(){return this.values.size;}
  key(index){return [...this.values.keys()][index];}
  getItem(key){return this.values.get(key)??null;}
  setItem(key,value){this.values.set(key,value);}
  removeItem(key){this.values.delete(key);}
}
const layout={searchQuery:'legacy',recentSearches:['concrete'],utilityInstances:[
  {id:'one',key:'search',query:'concrete',codeFilters:['BC'],searchPosition:{key:'concrete',scrollTop:220,selectedResult:'result'}},
  {id:'two',key:'search',query:'sprinkler'}, {id:'saved',key:'saved',folderQuery:'evidence'}
]};
const session=new Storage();
layout.columnGroups=[{id:'group',columns:{
  'search:closed':{kind:'utility',value:{id:'closed',key:'search',query:'steel',searchPosition:{scrollTop:90}}},
  'search:one':{kind:'utility',value:{id:'one',key:'search',query:'outdated group query'}},
  'reader:kept':{kind:'reader',value:{chapterID:'2'}}
}}];
const durable=withoutPersistentSearchQueries(layout);
assert.equal(durable.searchQuery,'');
assert.deepEqual(durable.utilityInstances.filter(x=>x.key==='search').map(x=>x.query),['','']);
assert.equal(layout.utilityInstances[0].query,'concrete','Runtime query remains intact');
assert.equal(durable.columnGroups[0].columns['search:closed'].value.query,'','Closed saved searches do not persist a query');
assert.equal(layout.columnGroups[0].columns['search:closed'].value.query,'steel','Runtime group is unchanged');
writeSearchQuerySession(session,'account-a','project-a',layout);
startSearchQuerySession(session,'account-a',true);
const refresh=restoreSearchQuerySession(session,'account-a','project-a',durable);
assert.equal(refresh.utilityInstances[0].query,'concrete');
assert.equal(refresh.utilityInstances[0].searchPosition.scrollTop,220,'Refresh preserves the result position');
assert.equal(refresh.utilityInstances[1].query,'sprinkler');
assert.equal(refresh.columnGroups[0].columns['search:closed'].value.query,'steel','Refresh retains closed group queries in this tab');
assert.equal(refresh.columnGroups[0].columns['search:one'].value.query,'concrete','Live query supersedes an older group snapshot');
for(const [storage,key,workspace] of [[new Storage(),'account-a','project-a'],[session,'account-b','project-a'],[session,'account-a','project-b']]){
  assert.equal(restoreSearchQuerySession(storage,key,workspace,layout).utilityInstances[0].query,'','New tab, account and project do not inherit queries');
}
startSearchQuerySession(session,'account-a',false);
const cold=restoreSearchQuerySession(session,'account-a','project-a',layout);
assert.equal(cold.searchQuery,'');assert.equal(cold.utilityInstances[0].query,'');
assert.equal(cold.columnGroups[0].columns['search:closed'].value.query,'','A saved closed group starts blank');
assert.equal(cold.columnGroups[0].columns['search:closed'].value.searchPosition,null);
assert.equal(cold.columnGroups[0].columns['reader:kept'].value.chapterID,'2','Other grouped columns retain their content');
assert.deepEqual(cold.recentSearches,['concrete'],'History remains available');
assert.deepEqual(cold.utilityInstances[0].codeFilters,['BC']);
assert.equal(cold.utilityInstances[2].folderQuery,'evidence','Other tool searches are unchanged');
const blocked={getItem(){throw Error('Blocked');},setItem(){throw Error('Blocked');}};
writeSearchQuerySession(blocked,'account-a','project-a',layout);
assert.equal(restoreSearchQuerySession(blocked,'account-a','project-a',layout).utilityInstances[0].query,'');
console.log('Cold search start, refresh position, multi-column queries, account/project isolation and blocked storage passed.');
