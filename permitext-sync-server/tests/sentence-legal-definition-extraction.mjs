import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parse} from 'parse5';
import {extractDefinitionEntries,splitSentenceLegalDefinition} from '../reader-definition-index.mjs';
const options={definitionSectionOnly:true,quotedLegalLabels:true,sentenceLegalLabels:true};
const plain=n=>n.nodeName==='#text'?n.value:(n.childNodes||[]).map(plain).join('');
function paragraphs(n,out=[]){if(n.tagName==='p')out.push(plain(n).replace(/\s+/g,' ').trim());for(const c of n.childNodes||[])paragraphs(c,out);return out;}
const source=id=>readFile(new URL(`../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/chapters/${id}.html`,import.meta.url),'utf8');
test('sentence labels require exact repeated quoted names and explicit opt-in',()=>{
 assert.equal(splitSentenceLegalDefinition('Owner. The term "tenant" means another person.').length,0);
 assert.equal(splitSentenceLegalDefinition('The owner means to sell.').length,0);
 const html='<section id="a"><h3>26-2402 Definitions.</h3><p>Owner. The term "owner" means a person.</p></section>';
 assert.equal(extractDefinitionEntries(html,{definitionSectionOnly:true,quotedLegalLabels:true}).length,0);
 assert.equal(extractDefinitionEntries(html,options).length,1);
 assert.equal(extractDefinitionEntries(html.replace('Definitions.','Requirements.'),options).length,0);
});
test('unsupported next label and legislative history cannot contaminate the last accepted body',()=>{
 const html='<h3>26-1 Definitions.</h3><p>Owner. The term "owner" means a person.</p><p>Other. The term "different label" means a second person.</p><p>Additional qualification for Other.</p><p>Tenant. The term "tenant" means an occupant.</p><p>(L.L. 2025/001, eff. 2026)</p>';
 assert.deepEqual(extractDefinitionEntries(html,options).map(x=>x.text),['Owner. The term "owner" means a person.','Tenant. The term "tenant" means an occupant.']);
});
test('actual Booking service keeps both numbered clauses and final exclusion exactly',async()=>{
 const html=await source(30000040),p=paragraphs(parse(html));
 const start=p.findIndex(x=>x.startsWith('Booking service.'));
 const end=p.findIndex((x,i)=>i>start&&x.startsWith('Building.'));
 const entry=extractDefinitionEntries(html,options).find(x=>x.term==='Booking service');
 assert.equal(entry.text,p.slice(start,end).join('\n\n'));
 assert.equal(end-start,4);
 assert.equal(entry.anchor,'section-31000811');
 const referral=extractDefinitionEntries(html,options).find(x=>x.term==='Class B multiple dwelling');
 assert.equal(referral.referenceOnly,true);
 assert.match(referral.text,/shall have the meaning ascribed/);
});
test('actual buyout source has exactly three unchanged paragraph bodies without amendment history',async()=>{
 const html=await source(30000042),p=paragraphs(parse(html));
 const entries=extractDefinitionEntries(html,options);
 assert.deepEqual(entries.map(x=>x.term),['Buyout agreement','Commissioner','Department']);
 for(const entry of entries){assert.equal(entry.text,p.find(x=>x.startsWith(entry.term+'.')));assert.equal(entry.sectionNumber,'26-2402');assert.equal(entry.referenceOnly,false);}
});
test('actual cooperative corporation keeps complete exclusion and final board/agent inclusion',async()=>{
 const html=await source(30000056),p=paragraphs(parse(html));
 const entry=extractDefinitionEntries(html,options).find(x=>x.term==='Cooperative corporation');
 const start=p.findIndex(x=>x.startsWith('Cooperative corporation.'));
 const end=p.findIndex((x,i)=>i>start&&x.startsWith('Dwelling unit.'));
 assert.equal(entry.text,p.slice(start,end).join('\n\n'));
 assert.match(entry.text,/board of directors and managing agent/);
 assert.match(entry.text,/fewer than 10 dwelling units/);
});
