import assert from 'node:assert/strict';
import {buildResearchPassageIndex,searchResearchPassages} from '../research-passage-index.mjs';
import {discoverRelevantEvidence} from '../evidence-discovery.mjs';
import {assembleResearchEvidence} from '../research-evidence-assembly.mjs';

const authority={corpusID:'synthetic-current',codeVersion:'synthetic-current-v1',codeEdition:'2022',jurisdiction:'New York City'};
const section=(id,number,title,text,codePrefix='MC')=>({...authority,id,sectionID:id,sectionNumber:number,title,codePrefix,
 body:{blocks:[{id:id+'-body',plainText:text}]}});
const lead=section('meaning-lead','991.1','General arrangement',
 'General arrangement. The same equipment in less room shall retain the specified general arrangement. Shower outlet connections are listed separately.');
const other=section('meaning-other','992.1','Listed installation',
 'Listed installation. The same equipment in less room shall retain its listed installation. Shower outlet connections are governed separately.');
const question=action=>`Can we ${action} it if there is less room? This is the same piece of equipment, not a shower outlet connection.`;
async function run({action='replace',q=question(action),subject='exhaust ducts',text='The exhaust duct shall be replaced only when its listed connections are maintained. Exception: The approved sealed arrangement is permitted.',
 complete=true,authorized=true,edition='2022',limit=3,semantic=true,context=true,companion=false,parentContext=''}={}){
 const target=section('action-rule','990.2','Qualified arrangement',text);
 if(parentContext)target.body.blocks.unshift({id:target.id+'-scope',plainText:parentContext});
 const indexedTarget={...target,codeEdition:edition};
 const sibling=section('protected-sibling','991.2','Listed conditions',
  'The same equipment in less room retains the listed qualified conditions. Exception: Its approved sealed arrangement is permitted.');
 const extra=companion?[sibling]:[];
 const index=await buildResearchPassageIndex([lead,other,indexedTarget,...extra],async s=>s.body,parentContext?{maximumCharacters:12000}:{});
 if(!complete)for(const passage of index.passages.filter(p=>p.sectionID===target.id))passage.scopeComplete=false;
 const catalog=authorized?[lead,other,target,...extra]:[lead,other,...extra];
 const hit=id=>index.passages.find(p=>p.sectionID===id);
 const result=await discoverRelevantEvidence({question:q,
  retrievalContext:{currentQuestion:q,sourceQuery:q,contextDependentFollowUp:context,resolvedSubjectContext:subject},
  catalog,invertedIndex:new Map(),passageIndex:index,
  semanticSearch:semantic?{search:async()=>({hits:[lead,other].map((s,i)=>({...hit(s.id),score:.99-i*.01,similarity:.99-i*.01,passages:[hit(s.id)]}))})}:null,
  readSectionBody:async s=>s.body,availableCodePrefixes:['MC','PC'],limit});
 return {result,target,index};
}
const marker=result=>result.candidates.find(c=>c.signals.currentQuestionLexicalReservation?.kind==='current_action_resolved_subject');
const base=await run();
assert.equal(marker(base.result)?.sectionID,base.target.id,'A current action plus resolved equipment subject survives semantic crowding.');
assert.equal(base.result.candidates[0].sectionID,lead.id);
assert.equal(base.result.candidates.length,3);
assert(base.result.candidates.filter(c=>c.signals.currentQuestionLexicalReservation).length<=1);
assert(marker(base.result).signals.currentQuestionLexicalReservation.strength>=.7);
const packet=await assembleResearchEvidence({question:question('replace'),pinnedEvidence:[],discover:async()=>base.result,
 resolveSection:async request=>{const s=[lead,other,base.target].find(s=>s.id===request.sectionID);return s?{...s,text:s.body.blocks[0].plainText}:null;},
 limits:{maximumDiscovered:2,maximumCharactersPerSource:1000,maximumCharacters:3000}});
const source=packet.sources.find(s=>s.sectionID===base.target.id);assert(source);
assert.match(source.text,/only when its listed connections are maintained/);assert.match(source.text,/Exception: The approved sealed arrangement/);
assert(source.canonicalContextComplete&&source.indexedPassage.completeSection);
assert(packet.usage.characterCount<=3000&&packet.sources.every(s=>s.text.length<=1000));

for(const scenario of [
 {action:'reroute',q:'May we reroute it if there is less room? This is the same equipment, not a shower outlet connection.',subject:'refrigerant piping',text:'The refrigerant piping shall not be rerouted unless the listed joints remain accessible. Exception: Listed sealed joints are permitted.'},
 {action:'insulate',q:'Must we insulate it if there is less room? This is the same equipment, not a shower outlet connection.',subject:'steam conduits',text:'The steam conduit shall be insulated with its listed jacket. Exception: The approved protected jacket may be used.'},
 {action:'remove',q:'Can we not remove it if there is less room? This is the same equipment, not a shower outlet connection.',subject:'guard panels',text:'The guard panel shall not be removed unless its stated protection remains in place. Exception: The listed access arrangement is permitted.'}
])assert.equal(marker((await run(scenario)).result)?.sectionID,'action-rule',`Modal ${scenario.action} retains its independently qualified source and conservative morphology.`);

for(const scenario of [
 {action:'use'}, {action:'check'}, {action:'be'},
 {q:'Which arrangement is needed for this same equipment?',action:'replace'},
 {subject:''}, {subject:'equipment systems'}, {subject:'not a shower outlet'},
 {subject:'exhaust ducts; steam conduits'}, {subject:'Can we replace these ducts?'},
 {subject:'steam conduits'}, {context:false}, {complete:false}, {authorized:false}, {edition:'2014'},
 {text:'The duct may be replaced only under its listed arrangement.'},
 {text:'The exhaust duct shall retain its listed arrangement.'}
])assert(!marker((await run(scenario)).result),'Weak/generic actions, ambiguous or absent subject, missing conjunction, incomplete or unauthorized sources cannot trigger the probe.');

// Completeness cannot be faked by a matching fragment from an oversized rule.
const oversized=await run({text:('The exhaust duct may be replaced only when all listed conditions remain satisfied. ').repeat(200)});
assert(!marker(oversized.result));
const oversizedScope=await run({parentContext:('All approved material conditions remain operative. ').repeat(225),
 text:('The exhaust duct may be replaced only when the approved arrangement remains intact. ').repeat(15)});
assert(oversizedScope.index.passages.some(p=>p.sectionID==='action-rule'&&p.scopeComplete&&p.contextTexts.join('\n\n').length+p.text.length>12000),
 'The complete child genuinely requires its oversized canonical parent context.');
assert(!marker(oversizedScope.result),'A complete child cannot be reserved when its required parent context exceeds the unchanged source budget.');
const direct=await run({q:'Under MC 991.1 and MC 992.1, can we replace it?',limit:2});
assert.deepEqual(direct.result.candidates.map(c=>c.sectionID),[lead.id,other.id]);
assert(!marker(direct.result));
const singleton=await run({limit:1});assert.equal(singleton.result.candidates.length,1);assert(!marker(singleton.result));
const protectedSibling=await run({limit:2,companion:true});
assert.equal(protectedSibling.result.candidates[0].sectionID,lead.id);
assert.equal(protectedSibling.result.candidates[1].sectionID,'protected-sibling');
assert(protectedSibling.result.candidates[1].signals.completeSiblingCompanionOf);
assert(!marker(protectedSibling.result),'The existing complete companion keeps its protected slot.');

// This action-and-subject source is genuinely below the relative threshold;
// extra conjunctions alone must not create a mandatory source.
const strong=section('strong-focus','996.1','Exhaust duct replaced',
 'Exhaust duct replaced. The exhaust duct shall be replaced only when its listed replacement arrangement and replacement connections remain intact.');
const weak=section('weak-focus','997.1','Qualified arrangement',
 'The exhaust duct is replaced. '+('Other material conditions are stated in the approved listed arrangement. ').repeat(24));
const weakIndex=await buildResearchPassageIndex([lead,strong,weak],async s=>s.body);
const weakRanks=searchResearchPassages(weakIndex,'replace exhaust ducts',{limit:100});
assert(weakRanks.find(h=>h.sectionID===weak.id).score/weakRanks[0].score<.7,'The rejection fixture genuinely falls below the unchanged relative strength threshold.');
const weakResult=await discoverRelevantEvidence({question:question('replace'),
 retrievalContext:{currentQuestion:question('replace'),sourceQuery:question('replace'),contextDependentFollowUp:true,resolvedSubjectContext:'exhaust ducts'},
 catalog:[lead,strong,weak],invertedIndex:new Map(),passageIndex:weakIndex,
 semanticSearch:{search:async()=>({hits:[lead,strong].map((s,i)=>({...weakIndex.passages.find(p=>p.sectionID===s.id),score:.99-i*.01}))})},
 readSectionBody:async s=>s.body,limit:2});
assert(!weakResult.candidates.some(c=>c.sectionID===weak.id));
assert.notEqual(marker(weakResult)?.sectionID,weak.id);
console.log('Action/subject reservation passed: varied modal verbs and equipment, exact whole conditions, one protected slot, writer cap, meaningful conjunction, weak/incomplete/unauthorized/direct-reference guards.');
