import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {researchHistoryContentFacts} from '../research-history-content.mjs';
import {researchHistoryContentClassification as classify} from '../public/research-history-content.js';
import {projectResearchConversationForList} from '../app.mjs';
const base = {id:'draft', title:'Sep 28, 2026 · 1:00 PM', titleSource:'default', createdAt:'2026-09-28T17:00:00Z', sources:[], messages:[], origin:{kind:'chat'}};
const local = {localStateKnown:true, hasAuthoredText:false, hasPendingRequest:false, hasSelectedEvidence:false, hasAttachments:false, hasContext:false};
const blankFacts = researchHistoryContentFacts(base);
assert.equal(classify({historyContentFacts:blankFacts},local),'confirmed-empty');
const rows=[];
function check(summary, state, expected) {
 assert.equal(classify(summary,state),expected);
 rows.push({facts:summary.historyContentFacts ?? null, local:state ?? {}, expected,
  serverRetained:Boolean((typeof summary.title === 'string' && summary.title.length > 0 && !/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4} · \d{1,2}:\d{2} (?:AM|PM)$/.test(summary.title)) || (summary.sourceStatus && summary.sourceStatus !== 'current') || summary.primaryProjectID || summary.linkedCodeDecisionID || summary.starterQuestion || summary.historyHiddenAt || summary.projectContextReviewRequired === true || Number(summary.messageCount)>0 || Number(summary.sourceCount)>0 || summary.sourceSectionIDs?.length)});
}
for (const override of [
 {messages:[{role:'user',question:'Unanswered',failure:{status:'failed'}}]},
 {sources:[{kind:'selection',selectedText:'Retained passage'}]},
 {messageCount:1},
 {sources:[{kind:'related',text:'Retained automatic evidence'}]},
 {sources:[{kind:'selection',visualSources:[{dataBase64:'PRIVATE-VISUAL'}],richSourceGrids:[{text:'PRIVATE-GRID'}]}]},
 {attachments:[{body:'PRIVATE-ATTACHMENT'}]}, {projectContext:{facts:['Fact']}},
 {codeBasis:{codeVersion:'2014'}}, {contextRevision:2}, {pendingRequest:{question:'Pending'}},
 {draftText:' '}, {title:'Authored title',titleSource:'manual'}, {titleSource:undefined},
 {origin:{kind:'reusedEvidence',answerID:'prior'}}
]) {
 const raw={...base,...override};const facts=researchHistoryContentFacts(raw);
 const projected=projectResearchConversationForList(raw);
 assert.deepEqual(projected.historyContentFacts,facts);
 assert.deepEqual(researchHistoryContentFacts(projected),facts,'projection must not recompute from stripped fields');
 assert.ok(!JSON.stringify(projected).includes('PRIVATE-'),'no heavy attachment payload in list');
 check({...projected,historyContentFacts:facts},local,'retained');
}
for (const summary of [{}, {historyContentFacts:null}, {historyContentFacts:{...blankFacts,schemaVersion:2}}, {historyContentFacts:{...blankFacts,complete:false}}, {historyContentFacts:{schemaVersion:1}}]) check(summary,local,'unknown');
for (const state of [undefined,{}, {...local,localStateKnown:false}, {...local,hasAuthoredText:undefined}, {...local,hasPendingRequest:null}]) check({historyContentFacts:blankFacts},state,'unknown');
for (const key of ['hasAuthoredText','hasPendingRequest','hasSelectedEvidence','hasAttachments','hasContext']) check({historyContentFacts:blankFacts},{...local,[key]:true},'retained');
for (const summary of [{title:'Locally renamed'}, {title:' '}, {sourceStatus:'changed'}, {primaryProjectID:'p'},{linkedCodeDecisionID:'q'},{starterQuestion:' '},{historyHiddenAt:'date'},{projectContextReviewRequired:true},{messageCount:1},{sourceCount:1},{sourceSectionIDs:['section']}]) check({...summary,historyContentFacts:blankFacts},local,'retained');
check({historyContentFacts:blankFacts},local,'confirmed-empty');
assert.equal(researchHistoryContentFacts({sources:[]}),null,'legacy partial records are unknown');
assert.equal(researchHistoryContentFacts({...base,sources:null}).complete,false);
assert.equal(researchHistoryContentFacts({...base,sources:{}}).complete,false);
assert.equal(researchHistoryContentFacts({...base,historyContentFacts:{...blankFacts,hasSources:true}}).hasSources,false,'full documents derive fresh facts');

const app=await readFile(new URL('../app.mjs',import.meta.url),'utf8');
const sqlFacts=[...app.matchAll(/'historyContentFacts', jsonb_build_object\(([\s\S]*?)\n                \),/g)].map(x=>x[1]);
assert.equal(sqlFacts.length,2);
assert.equal(sqlFacts[0],sqlFacts[1],'project-scoped and account-wide SQL projections carry identical facts');
for (const field of Object.keys(blankFacts)) assert.ok(sqlFacts[0].includes(`'${field}'`));
assert.match(sqlFacts[0], /jsonb_typeof\(conversation->'sources'\) = 'array'/);
assert.match(sqlFacts[0], /jsonb_object_keys\(conversation\)/);
assert.doesNotMatch(sqlFacts[0], /jsonb_strip_nulls/);
assert.match(sqlFacts[0], /retained_source->'visualSources'/);
assert.match(sqlFacts[0], /retained_source->'richSourceGrids'/);
assert.doesNotMatch(sqlFacts[0], /dataBase64|jsonb_agg/);
assert.equal((app.match(/historyContentFacts: researchHistoryContentFacts\(conversation\)/g)||[]).length,2);

// Compile the actual native scalar predicate against the same fixture cases.
const native=await readFile(new URL('../../NYC CC APP/permitext/Models/ResearchNotebookModels.swift',import.meta.url),'utf8');
const model=native.slice(native.indexOf('struct ResearchHistoryContentFacts:'),native.indexOf('struct ResearchConversationSummary:'));
assert.match(native,/var historyContentFacts: ResearchHistoryContentFacts\? = nil/);
const summaryModel=native.slice(native.indexOf('struct ResearchConversationSummary:'),native.indexOf('struct ResearchConversation:'));
const dir=await mkdtemp(join(tmpdir(),'permitext-history-content-'));
await writeFile(join(dir,'fixtures.json'),JSON.stringify(rows));
await writeFile(join(dir,'main.swift'),`import Foundation\n${model}\n
${summaryModel}
for value in [#""#, #","historyContentFacts":null"#, #","historyContentFacts":{}"#, #","historyContentFacts":false"#, #","historyContentFacts":{"schemaVersion":1,"complete":true}"#] {
 let decoded=try JSONDecoder().decode(ResearchConversationSummary.self,from:Data((#"{"id":"retained-history","title":"Title","createdAt":"date","updatedAt":"date","sourceCount":0,"sourceSectionIDs":[],"messageCount":0,"projectContextReviewRequired":false,"sourceStatus":"current""#+value+"}").utf8))
 precondition(decoded.id == "retained-history")
 precondition(decoded.historyContentFacts == nil || decoded.historyContentFacts?.complete == false)
}
struct Local:Decodable { let localStateKnown:Bool?; let hasAuthoredText:Bool?; let hasPendingRequest:Bool?; let hasSelectedEvidence:Bool?; let hasAttachments:Bool?; let hasContext:Bool? }
let data=try Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[1]))
let objects=try JSONSerialization.jsonObject(with:data) as! [[String:Any]]
for object in objects {
 let local=try JSONDecoder().decode(Local.self,from:JSONSerialization.data(withJSONObject:object["local"]!))
 let facts=(object["facts"] as? [String:Any]).flatMap{try? JSONDecoder().decode(ResearchHistoryContentFacts.self,from:JSONSerialization.data(withJSONObject:$0))}
 let server=object["serverRetained"] as! Bool
 let retained=server || [local.hasAuthoredText,local.hasPendingRequest,local.hasSelectedEvidence,local.hasAttachments,local.hasContext].contains(where:{$0 == true})
 let actual=facts?.classification(serverHasRetainedContent:server,localStateKnown:local.localStateKnown == true,hasAuthoredText:local.hasAuthoredText,hasPendingRequest:local.hasPendingRequest,hasSelectedEvidence:local.hasSelectedEvidence,hasLocalAttachments:local.hasAttachments,hasLocalContext:local.hasContext) ?? (retained ? "retained" : "unknown")
 precondition(actual == object["expected"] as! String)
}
print("PASS native/web history content parity: \\(objects.count) fixtures")
`);
execFileSync('xcrun',['swiftc',join(dir,'main.swift'),'-o',join(dir,'verify')],{stdio:'inherit'});
execFileSync(join(dir,'verify'),[join(dir,'fixtures.json')],{stdio:'inherit'});
console.log('PASS server summary content facts, heavy-payload exclusion, fail-closed local inputs, and both SQL projection contracts (not live database execution).');
