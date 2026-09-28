import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const web=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const native=await readFile(new URL('../../NYC CC APP/permitext/Views/ResearchView.swift',import.meta.url),'utf8');
const models=await readFile(new URL('../../NYC CC APP/permitext/Models/ResearchNotebookModels.swift',import.meta.url),'utf8');
function extract(name) { const start=web.indexOf(`function ${name}(`);const end=web.indexOf('\n}',start);assert.ok(start>=0&&end>start);return web.slice(start,end+2); }
const context=vm.createContext({Date,Intl,Map});
vm.runInContext(['researchHistoryDayIndex','researchConversationHistoryGroups','researchConversationTitle'].map(extract).join('\n'),context);
const date='2026-09-28T12:00:00Z';
const rows=[
 {id:'evidence',messageCount:0,sourceCount:1,title:'',createdAt:date},
 {id:'answered',messageCount:2,title:'Question',createdAt:date},
 {id:'custom-draft',messageCount:0,title:'Authored title',createdAt:date},
 {id:'negative',messageCount:-1,title:'Unknown count',createdAt:date},
 {id:'pending-draft',messageCount:0,title:'',createdAt:date},
 {id:'old-question',messageCount:1,title:'Older question',createdAt:'2020-01-01T00:00:00Z'}
];
const frozen=JSON.stringify(rows);
const grouped=context.researchConversationHistoryGroups(rows,new Date(date));
assert.equal(JSON.stringify(rows),frozen);
assert.deepEqual(Array.from(grouped.flatMap(group=>group.conversations),x=>x.id),['answered','negative','old-question','evidence','custom-draft','pending-draft']);
const drafts=grouped.at(-1);
assert.equal(drafts.id,'drafts');assert.equal(drafts.label,'Drafts');assert.equal(drafts.collapsible,false);assert.equal(drafts.defaultExpanded,true);
assert.equal(context.researchConversationTitle(rows[0]),'Draft with selected evidence');
assert.equal(context.researchConversationTitle(rows[2]),'Authored title');
assert.equal(context.researchConversationTitle(rows[4]),'Research draft');
for (const count of [undefined,null,'0',false,NaN,Infinity,-1,0.5]) {
 const result=context.researchConversationHistoryGroups([{id:'unknown',messageCount:count,createdAt:date}],new Date(date));
 assert.ok(result.every(group=>group.id!=='drafts'),'missing/invalid/nonzero counts stay in date chronology');
}
assert.equal(context.researchConversationHistoryGroups([],new Date(date)).length,0);
assert.equal(context.researchConversationHistoryGroups([rows[0]],new Date(date))[0].id,'drafts');
const render=web.slice(web.indexOf('  researchConversationHistoryGroups(researchConversationList).forEach'),web.indexOf('\nfunction visualEvidenceDataURL'));
assert.match(render,/document.createElement\(historyGroup.collapsible === false \? "span" : "button"\)/);
assert.match(render,/if \(historyGroup.collapsible !== false\) \{[\s\S]*?wireProjectSectionMotion/);
assert.match(render,/groupBody.append\(row\)/);
assert.match(native,/Text\(startsDrafts \? "Drafts" : historyDateGroup\(item\)\)/);
assert.match(native,/ForEach\(Array\(orderedSummaries.enumerated\(\)\)/);
assert.doesNotMatch(native,/"Empty draft"/);
const helper=native.slice(native.indexOf('enum ResearchHistoryPresentation {'),native.indexOf('enum ResearchComposerDraftCache {'));
const model=models.slice(models.indexOf('struct ResearchHistoryContentFacts:'),models.indexOf('struct ResearchConversation:'));
const titleStart=native.indexOf('    private func researchTitle(for summary:');
const title=native.slice(titleStart,native.indexOf('\n    }',titleStart)+6).replace('private func','static func');
const dir=await mkdtemp(join(tmpdir(),'permitext-history-grouping-'));
await writeFile(join(dir,'rows.json'),JSON.stringify(rows.map(row=>({...row,updatedAt:date,sourceCount:row.sourceCount||0,sourceSectionIDs:[],projectContextReviewRequired:false,sourceStatus:'current'}))));
await writeFile(join(dir,'main.swift'),`import Foundation\n${model}\n${helper}\nenum Titles {\n${title}\n}\n
let data=try Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[1]))
let input=try JSONDecoder().decode([ResearchConversationSummary].self,from:data)
let ordered=ResearchHistoryPresentation.ordered(input)
precondition(ordered.map(\\.id)==["answered","negative","old-question","evidence","custom-draft","pending-draft"])
precondition(Set(ordered.map(\\.id))==Set(input.map(\\.id)))
precondition(ResearchHistoryPresentation.ordered([]).isEmpty)
precondition(Titles.researchTitle(for:input[0])=="Draft with selected evidence")
precondition(Titles.researchTitle(for:input[2])=="Authored title")
precondition(Titles.researchTitle(for:input[4])=="Research draft")
// Native messageCount is a required Int in actual Codable synthesis. Omission
// and invalid types must not quietly become a zero-count draft.
var object=(try JSONSerialization.jsonObject(with:data) as! [[String:Any]])[0]
for invalid:Any in [NSNull(),"0",false,0.5] {
 object["messageCount"]=invalid
 precondition((try? JSONDecoder().decode(ResearchConversationSummary.self,from:JSONSerialization.data(withJSONObject:object)))==nil)
}
object.removeValue(forKey:"messageCount")
precondition((try? JSONDecoder().decode(ResearchConversationSummary.self,from:JSONSerialization.data(withJSONObject:object)))==nil)
print("PASS actual native stable partition/title parity; invalid or missing count never defaults to draft")
`);
execFileSync('xcrun',['swiftc',join(dir,'main.swift'),'-o',join(dir,'verify')],{stdio:'inherit'});
execFileSync(join(dir,'verify'),[join(dir,'rows.json')],{stdio:'inherit'});
console.log('PASS web actual grouping: final always-visible Drafts, unchanged records/titles, stable order, unknown counts stay chronological.');
