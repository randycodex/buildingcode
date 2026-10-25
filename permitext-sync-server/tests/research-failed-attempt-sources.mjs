import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {researchSystemRecoveryReasons} from '../public/research-failure-recovery.js';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.events={};this.attributes={};this.classList={add(){}};}
 set textContent(v){this.text=String(v);this.children=[];}
 get textContent(){return (this.text||'')+this.children.map(n=>n.textContent).join(' ');}
 append(...nodes){this.children.push(...nodes);}
 prepend(...nodes){this.children.unshift(...nodes);}
 setAttribute(k,v){this.attributes[k]=v;}
 addEventListener(k,fn){this.events[k]=fn;}
}
const extract=(name,next)=>source.slice(source.indexOf(`function ${name}(`),source.indexOf(`\nfunction ${next}(`,source.indexOf(`function ${name}(`)));
for(const failed of [true,false]) {
 const initial=Array.from({length:4},(_,n)=>({id:`initial-${n}`,sectionID:String(n)}));
 const exact=[{sourceID:'exact-1',sectionID:'2152',passageText:'Exact source text'}];
 const answer=failed?{mode:'clarification',model:'permitext-conversation-clarification',verification:{status:'clarification',pass:false,reason:'verification_incomplete'}}:{citations:[{sectionID:'0'}]};
 const before=JSON.stringify(answer);
 const c=vm.createContext({document:{createElement:tag=>new Element(tag)},researchSystemRecoveryReasons,
  researchSourcesForAnswer:()=>initial,researchDisplaySources:s=>s,
  renderResearchSource:s=>{const e=new Element('source');e.textContent=s.id;return e;},
  clear:e=>{e.children=[];},openTrashAfterSettingsDeletion:false,wireResearchDetailsMotion(){},
  postResearch:async()=>({answer:{answer,evidence:exact}})});
 vm.runInContext(extract('researchAnswerHasVerificationRecovery','researchRecoveryQuestionForMessage')+extract('renderResearchAnswerSources','appendHistoricalResearchList'),c);
 const details=c.renderResearchAnswerSources({primaryProjectID:'project'},{id:'answer',answer},'pane');
 if(failed){assert.match(details.textContent,/4 source references available · No answer completed/);assert.doesNotMatch(details.textContent,/sources used|Cited in this answer|Reviewed for context/);}
 else assert.match(details.textContent,/Cited in this answer/);
 details.open=true;await details.events.toggle();
 if(failed){assert.match(details.textContent,/1 source reference available · No answer completed/);assert.doesNotMatch(details.textContent,/sources used|Cited in this answer/);}
 assert.equal(JSON.stringify(answer),before,'Source presentation never rewrites saved answer/verification.');
}
console.log('Failed-attempt source presentation: initial/exact reference counts, no false citation claims, successful grouping retained and immutable answers passed.');
