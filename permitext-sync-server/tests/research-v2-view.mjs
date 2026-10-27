import assert from 'node:assert/strict';
import {createResearchV2View, researchAnswerText, researchReviewLabel, passageChipLabel, researchV2RetryContext} from '../public/research-v2.js';

// Minimal DOM for exercising the real asynchronous view handlers, without a
// provider or browser dependency. Layout is verified separately in the browser.
class Element {
  constructor(tag){this.tagName=tag;this.children=[];this.handlers={};this.attributes={};this.dataset={};this.className='';this.isConnected=true;this.hidden=false;this.value='';}
  focus(){this.focused=true;}
  get lastChild(){return this.children.at(-1);}
  append(...items){for(const item of items){item.parent=this;this.children.push(item);}}
  replaceChildren(...items){this.children=[];this.append(...items);}
  setAttribute(key,value){this.attributes[key]=value;}
  removeAttribute(key){delete this.attributes[key];}
  addEventListener(name,fn){this.handlers[name]=fn;}
  remove(){this.parent.children=this.parent.children.filter(x=>x!==this);}
  get classList(){return {toggle:(name,on)=>{const set=new Set(this.className.split(' '));const active=on??!set.has(name);active?set.add(name):set.delete(name);this.className=[...set].join(' ');return active;}};}
  querySelector(selector){return all(this).find(x=>x!==this&&x.className.split(' ').includes(selector.slice(1)))||null;}
}
const all=root=>[root,...root.children.flatMap(all)];
globalThis.document={createElement:tag=>new Element(tag),createTextNode:text=>Object.assign(new Element('#text'),{textContent:text})};
globalThis.requestAnimationFrame=fn=>fn();
let layoutCallback;globalThis.ResizeObserver=class{constructor(callback){layoutCallback=callback;}observe(){}disconnect(){}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const source={kind:'selection',sectionID:'2342',sectionNumber:'1012.2',codePrefix:'BC',codeEdition:'2022',selectedText:'Exact passage.'};
const prior={id:'same',revision:1,sources:[source],messages:[]};const retry={...prior,revision:2,messages:[{id:'q',role:'user',requestID:'stable',failure:{status:'failed'}}]};
assert.equal(researchV2RetryContext(prior,retry,'stable'),retry);
assert.equal(researchV2RetryContext(prior,{...retry,evidenceSetVersion:2},'stable'),prior);
assert.equal(researchV2RetryContext(prior,{...retry,messages:[{id:'other',role:'user',requestID:'other',failure:{}}]},'stable'),prior);
const old={role:'assistant',answer:{conclusion:'Conclusion.',explanation:'Important qualification.'}};
let gapQuery,gapOptions,gapDraft='My unsent follow-up',gapSends=0;
const gapsView=createResearchV2View({conversation:{sources:[source],messages:[{role:'user',question:'What is the corridor rating?'},
 {role:'assistant',answer:{answerText:'Applicability is unresolved. [S1]',additionalEvidenceNeeded:['Complete table and footnote c.'],missingFacts:['Whether sprinklers protect the building throughout.']}}]},
 initialDraft:gapDraft,onDraft:value=>{gapDraft=value;},onSend:()=>{gapSends++;},onFind:async (question,options)=>{gapQuery=question;gapOptions=options;return {candidates:[],coverage:{candidateCount:20,shownCount:12,omittedCandidateCount:8},queryExpansions:['hallway → corridor']};}});
const gapElements=()=>all(gapsView.element);
assert(gapElements().some(x=>x.textContent==='Sources still needed'));assert(gapElements().some(x=>x.textContent==='Project facts still needed'));
assert(gapElements().some(x=>x.textContent==='Whether sprinklers protect the building throughout.'));
await gapElements().find(x=>x.textContent==='Find source').handlers.click();await tick();
assert.equal(gapQuery,'What is the corridor rating?');assert.equal(gapOptions.focus,'Complete table and footnote c.');assert.equal(gapsView.element.querySelector('.rv2-input').value,'My unsent follow-up');
assert(gapElements().some(x=>x.textContent==='Showing 12 of 20 candidates.'));
gapElements().find(x=>x.textContent==='Close').handlers.click();
gapElements().find(x=>x.textContent==='Add fact').handlers.click();
const factInput=gapsView.element.querySelector('.rv2-fact-input');factInput.value='We have not verified sprinkler coverage.';
const gapInput=gapsView.element.querySelector('.rv2-input');gapInput.value='x'.repeat(1950);const originalGapDraft=gapDraft;
gapElements().find(x=>x.textContent==='Add to draft').handlers.click();assert.equal(gapDraft,originalGapDraft,'An oversized addition does not overwrite the draft.');assert.equal(factInput.value,'We have not verified sprinkler coverage.');
gapInput.value=originalGapDraft;
gapElements().find(x=>x.textContent==='Add to draft').handlers.click();
assert.match(gapDraft,/^My unsent follow-up/);assert.match(gapDraft,/My response: We have not verified sprinkler coverage\./);
assert.equal(gapSends,0,'Providing a fact only changes the draft; it never starts a paid answer.');
gapsView.dispose();
assert.equal(researchAnswerText(old),'Conclusion.\n\nImportant qualification.');
assert.equal(researchReviewLabel(old.answer),'Unreviewed');
const failedView=createResearchV2View({conversation:{sources:[],messages:[{role:'user',question:'Interrupted question.',requestID:'prior-request',failure:{message:'The provider failed.'}}]},onDraft(){},isCurrent:()=>true});
assert(all(failedView.element).some(x=>x.textContent==='The provider failed.'));assert(all(failedView.element).some(x=>x.textContent==='Retry question'));failedView.dispose();
assert.equal(passageChipLabel({codePrefix:'BC68',sectionNumber:'27-369',codeVersion:'2026-bundle',codeSource:{editionLabel:'1968 NYC Building Code'}}),'BC68 § 27-369 · 1968');
let sent=[],draft='Explain this.',savedRequest=null,current=true,snapshots=0;
let flight=deferred(),review=deferred();
const projectControl=document.createElement('select');projectControl.setAttribute('aria-label','Project');
const view=createResearchV2View({projectControl,hasMore:true,history:[{id:'first',title:'First'}],onLoadMore:async()=>({conversations:[{id:'first',title:'First'},{id:'second',title:'Older question'}],hasMore:false}),renderAnswerActions:()=>Object.assign(document.createElement('button'),{textContent:'Add to note…'}),conversation:{id:'test',sources:[source],messages:[old]},initialDraft:draft,
  isCurrent:()=>current,onDraft:text=>{draft=text;},onFind:async()=>({candidates:[source],unresolvedReferences:[{title:'PC § 1',reason:'Not found in this edition.'}]}),
  onOpenReader:async()=>{},onReview:()=>review.promise,onInclude:async()=>{},onCitation:async()=>{},
  onSnapshot:async()=>{snapshots++;return [source];},
  requestStore:{read:()=>savedRequest,write:value=>{savedRequest=value;}},
  onSend:args=>{sent.push(args);return flight.promise;}});
const find=text=>all(view.element).find(x=>x.textContent===text);
const thread=view.element.querySelector('.rv2-thread');thread.clientHeight=400;thread.scrollHeight=1200;layoutCallback();assert.equal(thread.scrollTop,1200,'A delayed pane mount reveals the latest answer');
assert(find('Add to note…'));assert(find('Save or share'));
find('More questions').handlers.click();await tick();assert.equal(all(view.element).filter(x=>x.textContent==='First').length,1);assert(find('Older question'));assert.equal(find('More questions').hidden,true);
const input=view.element.querySelector('.rv2-input'),send=view.element.querySelector('.rv2-send');
find('Find passages').handlers.click();await tick();
assert(find('Unresolved reference: PC § 1. Not found in this edition.'));
find('Review in Reader').handlers.click();await tick();
assert.equal(send.disabled,true);
input.handlers.keydown({key:'Enter',preventDefault(){}});assert.equal(sent.length,0,'Enter cannot submit during passage review');
review.resolve({selection:source});await tick();assert.equal(send.disabled,false);
send.handlers.click();await tick();assert.equal(sent.length,1);
assert.equal(view.element.querySelector('.rv2-thread').hidden,false,'Send restores the conversation from the source detail view');
find('Sources used').handlers.click();await tick();assert.equal(snapshots,0,'Source inspection cannot invalidate the active request');
flight.reject(new Error('Network interrupted'));await tick();
assert.equal(draft,'Explain this.');assert.match(view.element.querySelector('.rv2-status').textContent,/Network interrupted/);
const firstID=sent[0].requestID;flight=deferred();send.handlers.click();await tick();assert.equal(sent[1].requestID,firstID,'Retry preserves the request identity');
current=false;flight.resolve();await tick();assert.equal(draft,'Explain this.','Late completion cannot clear a different account or conversation draft');
view.dispose();
let pages=[];const paged=createResearchV2View({conversation:{sources:[],messages:[]},initialDraft:'Find ramps',onDraft(){},
 onFind:async(question,options)=>{pages.push(options);return options.cursor?{candidates:[{...source,id:'a'},{...source,id:'b',title:'Second result'}],coverage:{candidateCount:2,shownCount:2},nextCursor:null}:{candidates:[{...source,id:'a',title:'First result'}],coverage:{candidateCount:2,shownCount:1},nextCursor:'next-page'};}});
const pagedFind=text=>all(paged.element).find(x=>x.textContent===text);
pagedFind('Find passages').handlers.click();await tick();
await pagedFind('More results').handlers.click();
assert.equal(pages[1].cursor,'next-page');assert.equal(all(paged.element).filter(x=>x.className==='rv2-candidate').length,2,'Appending a page preserves existing rows and skips duplicates.');
assert.equal(pagedFind('More results').hidden,true);assert(pagedFind('Showing 2 of 2 candidates.'));paged.dispose();
const pendingPage=deferred();let pageAttempts=0;
const stalePage=createResearchV2View({conversation:{sources:[],messages:[]},initialDraft:'Find ramps',onDraft(){},
 onFind:async(_question,options)=>{if(!options.cursor)return {candidates:[{...source,id:'first'}],nextCursor:'later'};
  if(++pageAttempts===1)throw Error('Page connection lost');return pendingPage.promise;}});
const staleFind=text=>all(stalePage.element).find(x=>x.textContent===text);
staleFind('Find passages').handlers.click();await tick();await staleFind('More results').handlers.click();
assert.equal(staleFind('More results').disabled,false);assert.match(stalePage.element.querySelector('.rv2-status').textContent,/Page connection lost/);
const loading=staleFind('More results').handlers.click();await tick();stalePage.dispose();pendingPage.resolve({candidates:[{...source,id:'late'}],nextCursor:null});await loading;
assert.equal(all(stalePage.element).filter(x=>x.className==='rv2-candidate').length,1,'A late page cannot change a disposed or different conversation.');
const openingReader=deferred();let staleReviews=0;
const staleReview=createResearchV2View({conversation:{sources:[],messages:[]},initialDraft:'Find ramps',onDraft(){},
 onFind:async()=>({candidates:[source]}),onOpenReader:()=>openingReader.promise,onReview:async()=>{staleReviews++;return {selection:source};}});
const staleReviewFind=text=>all(staleReview.element).find(x=>x.textContent===text);
staleReviewFind('Find passages').handlers.click();await tick();const reviewing=staleReviewFind('Review in Reader').handlers.click();await tick();staleReview.dispose();openingReader.resolve();await reviewing;
assert.equal(staleReviews,0,'A stale Reader opening cannot start a review for a different account or conversation.');
console.log('Research v2 view: legacy answer preservation, edition labels, attachment/send races, source-detail send, failure draft retention, stable retry identity and stale-context isolation passed.');
