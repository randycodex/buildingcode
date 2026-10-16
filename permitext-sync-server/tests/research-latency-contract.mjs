import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {openInvestigationServiceTier} from '../research-open-investigation.mjs';
assert.equal(openInvestigationServiceTier({}), 'default');
assert.equal(openInvestigationServiceTier({PERMITEXT_RESEARCH_SERVICE_TIER:'priority'}), 'priority');
assert.equal(openInvestigationServiceTier({PERMITEXT_RESEARCH_SERVICE_TIER:'priority',PERMITEXT_RESEARCH_OPEN_SERVICE_TIER:'default'}), 'default');
assert.equal(openInvestigationServiceTier({PERMITEXT_RESEARCH_OPEN_SERVICE_TIER:'fast'}), 'fast');
assert.throws(()=>openInvestigationServiceTier({PERMITEXT_RESEARCH_OPEN_SERVICE_TIER:'unpriced'}));
const source=await readFile(new URL('../app.mjs',import.meta.url),'utf8');
const start=source.indexOf('const sectionSummaryIndexes = new WeakMap();');
const end=source.indexOf('\nfunction normalizedResearchText',start);
let catalog=[{id:1,webSectionID:'alias'},{id:'alias',webSectionID:'1'},{id:2},{id:'historical',webSectionID:'old'}];
const context=vm.createContext({sectionCatalog:async()=>catalog});
vm.runInContext(source.slice(start,end),context);
for(const id of ['1',1,'alias',' 2 ',null,'missing','old']){
 const expected=catalog.find(s=>String(s.id)===String(id||'').trim()||String(s.webSectionID||'')===String(id||'').trim())||null;
 assert.equal(await context.sectionSummaryByID(id),expected,'Exact ID, alias, missing ID and first-record identity must match the old lookup');
}
const previous=await context.sectionSummaryByID('1');catalog=[{id:1,webSectionID:'new',codeVersion:'replacement'}];
assert.notEqual(await context.sectionSummaryByID('1'),previous);
assert.equal(await context.sectionSummaryByID('alias'),null,'Replacing the catalog cannot retain stale aliases');
assert.equal((await context.sectionSummaryByID('new')).codeVersion,'replacement');
console.log('Research latency contract passed: exact catalog identity and configurable priced tiers. No model calls.');
