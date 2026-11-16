import assert from 'node:assert/strict';
import {createResearchV2View, researchAnswerText, researchReviewLabel, passageChipLabel, researchV2RetryContext} from '../public/research-v2.js';

// Minimal DOM for exercising the real asynchronous view handlers, without a
// provider or browser dependency. Layout is verified separately in the browser.
class Element {
  constructor(tag){this.tagName=tag;this.children=[];this.handlers={};this.attributes={};this.dataset={};this.className='';this.isConnected=true;this.hidden=false;this.value='';this.style={setProperty(){}};}
  focus(){this.focused=true;}
  get lastChild(){return this.children.at(-1);}
  get childNodes(){return this.children;}
  append(...items){for(const item of items){item.parent=this;this.children.push(item);}}
  replaceChildren(...items){this.children=[];this.append(...items);}
  setAttribute(key,value){this.attributes[key]=value;}
  removeAttribute(key){delete this.attributes[key];}
  addEventListener(name,fn){this.handlers[name]=fn;}
  removeEventListener(name){delete this.handlers[name];}
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
{
 const removal=deferred(),removed=[];
 const selected={...source,id:'passage-to-remove'},other={...source,id:'different-passage',selectedText:'A different passage from the same section.'};
 const attached=createResearchV2View({conversation:{id:'attachments',sources:[selected,other],messages:[]},initialDraft:'Keep my unsent question',
   onDraft(){},onRemove:async item=>{removed.push(item.id);await removal.promise;},onSend:()=>{throw Error('Do not send while removing a passage');}});
 const controls=all(attached.element).filter(element=>element.className==='rv2-passage-remove');
 assert.equal(controls.length,2,'Every selected passage has its own direct remove control');
 assert.match(controls[0].attributes['aria-label'],/Remove BC § 1012.2.*next question/);
 controls[1].handlers.click();await tick();controls[1].handlers.click();
 assert.deepEqual(removed,['different-passage'],'Removing a repeated section targets the exact passage once');
 assert.equal(attached.element.querySelector('.rv2-detail').hidden,true,'Removal never opens the passage details');
 assert.equal(attached.element.querySelector('.rv2-input').disabled,false,'The question draft stays editable');
 assert.equal(attached.element.querySelector('.rv2-send').disabled,true);
 assert.ok(controls.every(button=>button.disabled));
 attached.element.querySelector('.rv2-send').handlers.click();await tick();
 removal.reject(Error('Could not save this removal'));await tick();
 assert.equal(all(attached.element).filter(element=>element.className==='rv2-passage-remove').length,2,'A failed removal retains both passages');
 assert.match(attached.element.querySelector('.rv2-status').textContent,/Could not save this removal/);
 assert.equal(attached.element.querySelector('.rv2-input').value,'Keep my unsent question');
 assert.ok(controls.every(button=>!button.disabled));
 attached.dispose();
}
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
{
 let opened;
 const text='Rules:\n- **First rule.** [S1]\n- Second rule with a wrapped\n  continuation. [S2]\n\nSteps:\n3. Identify the equipment.\n5. Review the listing.\n5. Confirm the stated conditions.\n\nRepeated Markdown numbers:\n1. First step.\n1. Second step.';
 const message={id:'lists',role:'assistant',answer:{answerText:text,verification:{pass:true}}};
 const listView=createResearchV2View({conversation:{sources:[],messages:[message]},onDraft(){},onCitation:(answer,id)=>{opened={answer,id};}});
 const answer=listView.element.querySelector('.rv2-answer');
 const lists=all(answer).filter(element=>element.className==='rv2-answer-list');
 assert.deepEqual(lists.map(element=>element.tagName),['ul','ol','ol']);
 assert.equal(lists[0].children.length,2);assert.equal(lists[1].attributes.start,'3');
 assert.deepEqual(lists[1].children.map(element=>element.attributes.value),['3','5','5'],'Explicit nonconsecutive numbers retain their values');
 assert(lists[2].children.every(element=>element.attributes.value===undefined),'Repeated 1. Markdown markers use the native counter');
 assert(all(lists[0]).some(element=>element.tagName==='strong'));
 assert(all(lists[0]).some(element=>element.textContent?.includes('continuation. ')));
 all(lists[0]).find(element=>element.attributes['aria-label']==='Open citation S2').handlers.click();
 assert.equal(opened.answer,message);assert.equal(opened.id,'S2');assert.equal(message.answer.answerText,text,'Rendering never rewrites the saved answer');
 listView.dispose();
}
{
 let opened,openedSource;
 const message={id:'reference-answer',role:'assistant',answer:{answerText:'A referenced table is supplied. [S2]',verification:{pass:true},
  referenceLookup:{added:[{label:'FGC Table 308.2',codeEdition:'2022 New York City Construction Codes',citationID:'S2'}]}}};
 const referenceView=createResearchV2View({conversation:{sources:[],messages:[message]},onDraft(){},
  onCitation:(answer,id)=>{opened={answer,id};},onOpenReader:source=>{openedSource=source;},onSnapshot:async()=>({sources:[
   {codePrefix:'FGC',sectionNumber:'308.3.2',codeEdition:'2022',passageText:'Exact attached passage.'},
   {codeBook:'FGC',sectionNumber:'308.2',codeEdition:'2022',
   passageText:'Complete table and notes.',provenance:{origin:'permitext_cross_reference',retrievalReason:'Automatically retrieved FGC Table 308.2 from the same codebook and edition'}}]})});
 const elements=()=>all(referenceView.element);
 assert(elements().some(element=>element.attributes['aria-label']==='Automatically retrieved references'));
 elements().find(element=>element.textContent==='FGC Table 308.2 · 2022').handlers.click();
 assert.equal(opened.answer,message);assert.equal(opened.id,'S2','Automatically retrieved sources use the original saved citation index');
 await elements().find(element=>element.textContent==='Sources used').handlers.click();await tick();
 const rows=elements().filter(element=>element.className==='rv2-snapshot-row');
 assert.equal(rows.length,2);assert(rows.every(row=>row.tagName==='details'&&row.open===false),'Saved sources start as compact collapsed rows');
 assert(elements().some(element=>element.textContent==='2. FGC § 308.2 · 2022'),'Numbered source rows retain the answer citation order');
 const sourceList=referenceView.element.querySelector('.rv2-snapshot-list');
 assert.equal(sourceList.tagName,'ol');assert.equal(sourceList.children.length,2);
 assert(elements().some(element=>element.textContent==='Automatically retrieved FGC Table 308.2 from the same codebook and edition'));
 assert(elements().some(element=>element.textContent==='Complete table and notes.'));
 all(rows[1]).find(element=>element.textContent==='Open in Reader').handlers.click();
 assert.equal(openedSource.sectionNumber,'308.2');assert.equal(openedSource.passageText,'Complete table and notes.');
 referenceView.dispose();
}
const failedView=createResearchV2View({conversation:{sources:[],messages:[{role:'user',question:'Interrupted question.',requestID:'prior-request',failure:{message:'The provider failed.'}}]},onDraft(){},isCurrent:()=>true});
assert(all(failedView.element).some(x=>x.textContent==='The provider failed.'));assert(all(failedView.element).some(x=>x.textContent==='Retry question'));failedView.dispose();
assert.equal(passageChipLabel({codePrefix:'BC68',sectionNumber:'27-369',codeVersion:'2026-bundle',codeSource:{editionLabel:'1968 NYC Building Code'}}),'BC68 § 27-369 · 1968');
let sent=[],draft='Explain this.',savedRequest=null,current=true,snapshots=0;
let flight=deferred(),review=deferred();
const view=createResearchV2View({hasMore:true,history:[{id:'first',title:'First'}],onLoadMore:async()=>({conversations:[{id:'first',title:'First'},{id:'second',title:'Older question'}],hasMore:false}),renderAnswerActions:()=>Object.assign(document.createElement('button'),{textContent:'Add to note…'}),conversation:{id:'test',sources:[source],messages:[{...old,answer:{...old.answer,additionalEvidenceNeeded:['Related definition.']}}]},initialDraft:draft,
  isCurrent:()=>current,onDraft:text=>{draft=text;},onFind:async()=>({candidates:[source],unresolvedReferences:[{title:'PC § 1',reason:'Not found in this edition.'}]}),
  onOpenReader:async()=>{},onReview:()=>review.promise,onInclude:async()=>{},onCitation:async()=>{},
  onSnapshot:async()=>{snapshots++;return [source];},
  requestStore:{read:()=>savedRequest,write:value=>{savedRequest=value;}},
  onSend:args=>{sent.push(args);return flight.promise;}});
const find=text=>all(view.element).find(x=>x.textContent===text);
assert(!all(view.element).some(x=>x.tagName==='select'),'The question list follows the workspace Project without a conversation Project selector.');
const thread=view.element.querySelector('.rv2-thread');thread.clientHeight=400;thread.scrollHeight=1200;layoutCallback();assert.equal(thread.scrollTop,1200,'A delayed pane mount reveals the latest answer');
assert(find('Add to note…'));
assert(view.element.querySelector('.rv2-answer-footer').children.includes(find('Add to note…')), 'The Note handoff is visible with the answer actions.');
find('More questions').handlers.click();await tick();assert.equal(all(view.element).filter(x=>x.textContent==='First').length,1);assert(find('Older question'));assert.equal(find('More questions').hidden,true);
const input=view.element.querySelector('.rv2-input'),send=view.element.querySelector('.rv2-send');
find('Find source').handlers.click();await tick();
assert(find('Unresolved reference: PC § 1. Not found in this edition.'));
find('Review in Reader').handlers.click();await tick();
assert.equal(send.disabled,true);
input.handlers.keydown({key:'Enter',preventDefault(){}});assert.equal(sent.length,0,'Enter cannot submit during passage review');
review.resolve({selection:source});await tick();assert.equal(send.disabled,false);
send.handlers.click();
assert.equal(input.value,'','Sending clears the visible composer before the network request can finish');
assert.equal(input.disabled,true);
assert.equal(draft,'Explain this.','The recovery draft remains durable until the answer is saved');
assert.equal(savedRequest.question,'Explain this.');
await tick();assert.equal(sent.length,1);
assert.equal(view.element.querySelector('.rv2-thread').hidden,false,'Send restores the conversation from the source detail view');
const pendingTurn=view.element.querySelector('.rv2-pending-turn');
const turnStatus=view.element.querySelector('.rv2-turn-status');
assert.equal(pendingTurn.parent,thread);
assert.equal(pendingTurn.children[0].textContent,'Explain this.');
assert.equal(pendingTurn.children[1],turnStatus,'Progress follows the submitted question inside the conversation');
assert.equal(turnStatus.attributes.role,'status');assert.equal(turnStatus.attributes['aria-live'],'polite');
assert.equal(turnStatus.textContent,'Preparing your answer…');
sent[0].onProgress({stage:'generating_answer'});assert.equal(turnStatus.textContent,'Developing your answer…');
sent[0].onProgress({stage:'checking_citation_support'});assert.equal(turnStatus.textContent,'Checking the answer against the sources…');
assert(all(view.element).filter(element=>element.className==='rv2-status').every(element=>element.hidden),'Generation notices never occupy the space above the composer');
find('Sources used').handlers.click();await tick();assert.equal(snapshots,0,'Source inspection cannot invalidate the active request');
flight.reject(new Error('Network interrupted'));await tick();
assert.equal(draft,'Explain this.');assert.match(view.element.querySelector('.rv2-status').textContent,/Network interrupted/);
assert.equal(input.value,'Explain this.','A failed request restores the question for editing or retry');
assert.equal(turnStatus.textContent,'Network interrupted');assert.equal(turnStatus.hidden,false);
const firstID=sent[0].requestID;flight=deferred();send.handlers.click();await tick();assert.equal(sent[1].requestID,firstID,'Retry preserves the request identity');
assert.equal(all(view.element).filter(element=>element.className==='rv2-pending-turn').length,1,'Retry replaces the pending exchange instead of duplicating the question');
const activeStatus=view.element.querySelector('.rv2-turn-status');
current=false;sent[1].onProgress({stage:'checking_citation_support'});
assert.equal(activeStatus.textContent,'Preparing your answer…','Late progress cannot change a different account or conversation');
flight.resolve();await tick();assert.equal(draft,'Explain this.','Late completion cannot clear a different account or conversation draft');
view.dispose();
{
 let retainedDraft='  Keep my question.\n',request=null,attempts=[];
 const stopped=createResearchV2View({conversation:{id:'stop-and-retry',sources:[source],messages:[]},initialDraft:retainedDraft,
  onDraft:value=>{retainedDraft=value;},requestStore:{read:()=>request,write:value=>{request=value;}},
  onSend:args=>{attempts.push(args);return new Promise((resolve,reject)=>{
    args.signal.addEventListener('abort',()=>reject(Object.assign(Error('Aborted'),{name:'AbortError'})));
    args.complete=resolve;
  });}});
 const stoppedInput=stopped.element.querySelector('.rv2-input');
 stopped.element.querySelector('.rv2-send').handlers.click();
 all(stopped.element).find(element=>element.textContent==='Stop').handlers.click();await tick();
 assert.equal(stoppedInput.value,'  Keep my question.\n','Stop restores the exact draft including whitespace');
 assert.equal(retainedDraft,stoppedInput.value);assert.equal(stoppedInput.disabled,false);
 assert.equal(stopped.element.querySelector('.rv2-turn-status').textContent,'Stopped. Your draft and passages are retained.');
 const stoppedRequestID=request.requestID;
 stopped.element.querySelector('.rv2-send').handlers.click();
 assert.equal(stoppedInput.value,'');assert.equal(attempts[1].requestID,stoppedRequestID);
 attempts[1].complete();await tick();
 assert.equal(stoppedInput.value,'');assert.equal(retainedDraft,'');assert.equal(request,null);
 assert.equal(stopped.element.querySelector('.rv2-turn-status').hidden,true,'Completed requests remove the generation notice');
 assert.equal(stoppedInput.disabled,false);stopped.dispose();
}
const reviewAttempts=[];let persistedReviewRequest=null;
const rejectedView=createResearchV2View({conversation:{id:'review-retry',sources:[source],messages:[]},initialDraft:'Explain the table.',onDraft(){},isCurrent:()=>true,
 requestStore:{read:()=>persistedReviewRequest,write:value=>{persistedReviewRequest=value;}},
 onSend:async args=>{reviewAttempts.push(args);throw Object.assign(Error('Check the table qualification and retry.'),{payload:{code:'V2_REVIEW_FAILED'}});}});
all(rejectedView.element).find(x=>x.className==='rv2-send').handlers.click();await tick();
assert.equal(persistedReviewRequest,null,'A definitive review rejection retires the completed request');
assert.equal(rejectedView.element.querySelector('.rv2-input').value,'Explain the table.');
all(rejectedView.element).find(x=>x.textContent==='Retry answer').handlers.click();await tick();
assert.equal(reviewAttempts.length,2);assert.notEqual(reviewAttempts[0].requestID,reviewAttempts[1].requestID,'Retry after completed rejection gets a fresh reviewed attempt');
rejectedView.dispose();
let pages=[];const paged=createResearchV2View({conversation:{sources:[],messages:[{role:'user',question:'Find ramps'},{role:'assistant',answer:{additionalEvidenceNeeded:['Ramp rules.']}}]},initialDraft:'Find ramps',onDraft(){},
 onFind:async(question,options)=>{pages.push(options);return options.cursor?{candidates:[{...source,id:'a'},{...source,id:'b',title:'Second result'}],coverage:{candidateCount:2,shownCount:2},nextCursor:null}:{candidates:[{...source,id:'a',title:'First result'}],coverage:{candidateCount:2,shownCount:1},nextCursor:'next-page'};}});
const pagedFind=text=>all(paged.element).find(x=>x.textContent===text);
await pagedFind('Find source').handlers.click();await tick();
await pagedFind('More results').handlers.click();
assert.equal(pages[1].cursor,'next-page');assert.equal(all(paged.element).filter(x=>x.className==='rv2-candidate').length,2,'Appending a page preserves existing rows and skips duplicates.');
assert.equal(pagedFind('More results').hidden,true);assert(pagedFind('Showing 2 of 2 candidates.'));paged.dispose();
const pendingPage=deferred();let pageAttempts=0;
const stalePage=createResearchV2View({conversation:{sources:[],messages:[{role:'user',question:'Find ramps'},{role:'assistant',answer:{additionalEvidenceNeeded:['Ramp rules.']}}]},initialDraft:'Find ramps',onDraft(){},
 onFind:async(_question,options)=>{if(!options.cursor)return {candidates:[{...source,id:'first'}],nextCursor:'later'};
  if(++pageAttempts===1)throw Error('Page connection lost');return pendingPage.promise;}});
const staleFind=text=>all(stalePage.element).find(x=>x.textContent===text);
await staleFind('Find source').handlers.click();await tick();await staleFind('More results').handlers.click();
assert.equal(staleFind('More results').disabled,false);assert.match(stalePage.element.querySelector('.rv2-status').textContent,/Page connection lost/);
const loading=staleFind('More results').handlers.click();await tick();stalePage.dispose();pendingPage.resolve({candidates:[{...source,id:'late'}],nextCursor:null});await loading;
assert.equal(all(stalePage.element).filter(x=>x.className==='rv2-candidate').length,1,'A late page cannot change a disposed or different conversation.');
const openingReader=deferred();let staleReviews=0;
const staleReview=createResearchV2View({conversation:{sources:[],messages:[{role:'user',question:'Find ramps'},{role:'assistant',answer:{additionalEvidenceNeeded:['Ramp rules.']}}]},initialDraft:'Find ramps',onDraft(){},
 onFind:async()=>({candidates:[source]}),onOpenReader:()=>openingReader.promise,onReview:async()=>{staleReviews++;return {selection:source};}});
const staleReviewFind=text=>all(staleReview.element).find(x=>x.textContent===text);
await staleReviewFind('Find source').handlers.click();await tick();const reviewing=staleReviewFind('Review in Reader').handlers.click();await tick();staleReview.dispose();openingReader.resolve();await reviewing;
assert.equal(staleReviews,0,'A stale Reader opening cannot start a review for a different account or conversation.');
console.log('Research v2 view: legacy answer preservation, edition labels, attachment/send races, source-detail send, failure draft retention, stable retry identity and stale-context isolation passed.');

// Both Assistant views expose the same history management without opening a chat while selecting.
const historyBindings=[],historyPages=[];let selectingHistory=false,openedHistory='',disposedHistory=0;
const historyToolbar=new Element('div');historyToolbar.className='assistant-history-management-toolbar';
const historyManagement={element:new Element('div'),toolbar:historyToolbar,handleKeyDown(){},bindRow(row,button,item){historyBindings.push(item.id);},setConversations(items){historyPages.push(items.map(item=>item.id));},selectConversation(){return selectingHistory;},dispose(){disposedHistory++;}};
const managedView=createResearchV2View({history:[{id:'one',title:'First chat'},{id:'two',title:'Second chat'}],historyManagement,onNew(){},onOpen:id=>{openedHistory=id;}});
assert.deepEqual(historyBindings,['one','two']);assert.deepEqual(historyPages,[['one','two']]);
const historyTop=managedView.element.querySelector('.rv2-rail-top-row');
assert.equal(historyTop.children[0].textContent,'New Chat +');
assert.equal(historyTop.children[1],historyToolbar,'History options sit beside New Chat instead of in a hidden toolbar.');
assert.equal(historyTop.children[2].className,'icon-button rv2-history-toggle','History options stay immediately left of collapse.');
const managedRail=managedView.element.querySelector('.rv2-rail');
assert.equal(managedRail.children[0],historyTop);
assert.equal(managedRail.children[1],historyManagement.element,'Selection controls follow the top row.');
const managedFirst=all(managedView.element).find(node=>node.className==='rv2-question-link');
selectingHistory=true;managedFirst.handlers.click();assert.equal(openedHistory,'','Selection stays in History.');
selectingHistory=false;managedFirst.handlers.click();assert.equal(openedHistory,'one');
managedView.dispose();assert.equal(disposedHistory,1,'Closing the Assistant also closes its management menu.');
console.log('Research v2 shared history management integration passed.');

const originalAsk='Calculate the occupant load of a library reading room with 1,405 net square feet.';
const historyItem={id:'summary',title:'Library reading room occupant load',starterQuestion:originalAsk,messageCount:2};
const historyDraft={id:'draft',title:'BC § 1004.1 — Design occupant load',messageCount:0};
const renames=[];let renameControl,newChats=0;
const grouped=createResearchV2View({history:[historyItem,historyDraft],initialDraft:'Keep my unsent follow-up',onDraft(){},onOpen(){},
  onOriginal:()=>assert.fail('The retired interface cannot be opened'),
  onNew:()=>{newChats++;},
  historyGroups:items=>[{label:'7 days',conversations:items.filter(item=>item.messageCount>0)},{label:'Drafts',conversations:items.filter(item=>item.messageCount===0)}],
  historyManagement:{element:new Element('div'),bindRow(_row,_open,item,title,controls){if(item.id==='summary')renameControl=controls.onRename;},setConversations(){},dispose(){}},
  onRename:async(item,title)=>{renames.push([item.id,title]);return {...item,title,titleSource:'manual'};}
});
assert.deepEqual(all(grouped.element).filter(node=>node.className==='rv2-history-group-label').map(node=>node.textContent),['7 days','Drafts']);
assert.equal(all(grouped.element).some(node=>node.tagName==='ol'),false,'The grouped history has no numbered list');
assert.equal(all(grouped.element).some(node=>/Original Research/.test(node.textContent||'')),false);
assert.equal(all(grouped.element).find(node=>node.className==='rv2-question-link').title,originalAsk,'The full ask stays available without becoming the visible title');
renameControl();
const renameInput=grouped.element.querySelector('.rv2-rename-input');renameInput.value='My reading room question';
await grouped.element.querySelector('.rv2-rename-form').handlers.submit({preventDefault(){}});
assert.deepEqual(renames,[['summary','My reading room question']]);
assert.equal(historyItem.starterQuestion,originalAsk);
assert.equal(grouped.element.querySelector('.rv2-input').value,'Keep my unsent follow-up');
assert.ok(all(grouped.element).some(node=>node.textContent==='My reading room question'));
const historyToggle=grouped.element.querySelector('.rv2-history-toggle');
historyToggle.handlers.click();
assert.equal(historyToggle.attributes['aria-expanded'],'false');
assert.equal(grouped.element.querySelector('.rv2-input').value,'Keep my unsent follow-up','Collapsing history retains the live draft.');
historyToggle.handlers.click();assert.equal(historyToggle.attributes['aria-expanded'],'true');
all(grouped.element).find(node=>node.textContent==='New Chat +').handlers.click();
assert.equal(newChats,1);assert.equal(grouped.element.querySelector('.rv2-input').value,'Keep my unsent follow-up');
grouped.dispose();
console.log('Grouped Research history passed: dates/Drafts, summary labels, full original ask, no legacy action, inline rename and draft preservation.');

// Project context permits a question without passage discovery; the snapshot
// viewer reads only the answer's saved context, including status/provenance.
{
 let sends=0,finds=0;
 const view=createResearchV2View({conversation:{sources:[],messages:[{id:'frozen',role:'assistant',answer:{answerText:'Saved answer.'}}]},
  initialDraft:'Summarize my Project.',onDraft(){},onSend:async()=>sends++,onFind:async()=>{finds++;return[];},
  renderProjectContext:host=>{const controller=document.createElement('section');controller.hidden=true;controller.querySelectorAll=()=>[];controller._projectContextOptions={enabled:()=>true};host.append(controller);return controller;},
  onSnapshot:async()=>({sources:[],projectContextSnapshot:{capturedAt:'2026-11-12T12:00:00.000Z',projectInformation:{address:'Saved address',description:'Original proposal',facts:['Stories Above Grade: 3 (stated; user survey)']}}})});
 view.element.querySelector('.rv2-send').handlers.click();await tick();assert.equal(sends,1);assert.equal(finds,0);
 all(view.element).find(x=>x.textContent==='Sources used').handlers.click();await tick();
 for(const expected of ['Project context','Original proposal','Saved address','Stories Above Grade: 3 (stated; user survey)'])assert(all(view.element).some(x=>x.textContent===expected));
 const contextRow=view.element.querySelector('.rv2-project-snapshot');
 assert.equal(contextRow.tagName,'details');assert.equal(contextRow.open,false,'A captured Project context stays collapsed while preserving every saved value');
 view.dispose();
}
console.log('Default-context view passed: context-only send and saved answer Project snapshot inspection.');

// Prepare the next conversation without blanking the existing chat. Commit
// reuses the actual grid/chat/scroll containers and scrolls without animation.
{
 let nextDraft='',oldDraftWrites=0;
 const first=createResearchV2View({conversation:{id:'stable-a',sources:[],messages:[{role:'user',question:'First conversation'}]},
  initialDraft:'Unsent A',onDraft:()=>oldDraftWrites++});
 const shell=first.capturePresentation(),oldRoot=first.element;
 shell.thread.clientHeight=400;shell.thread.scrollHeight=1600;
 const scrollBehaviors=[];let scrollTop=300;
 Object.defineProperty(shell.thread,'scrollTop',{get:()=>scrollTop,set:value=>{scrollBehaviors.push(shell.thread.style.scrollBehavior);scrollTop=value;}});
 const next=createResearchV2View({presentation:shell,conversation:{id:'stable-b',sources:[],messages:[{role:'user',question:'Second conversation'}]},
  initialDraft:'Unsent B',onDraft:value=>nextDraft=value});
 assert.equal(next.element,oldRoot);
 assert(all(oldRoot).some(e=>e.textContent==='First conversation'),'Preparation keeps the outgoing conversation visible.');
 assert(!all(oldRoot).some(e=>e.textContent==='Second conversation'),'The incoming conversation is staged until commit.');
 first.dispose();next.commit();
 assert.equal(oldRoot.querySelector('.rv2-chat'),shell.chat);
 assert.equal(oldRoot.querySelector('.rv2-thread'),shell.thread);
 assert(all(oldRoot).some(e=>e.textContent==='Second conversation'));
 assert(!all(oldRoot).some(e=>e.textContent==='First conversation'));
 assert.equal(scrollTop,1600,'A retained thread reaches its final position during the synchronous commit.');
 assert.deepEqual(scrollBehaviors,['auto'],'Initial position never inherits smooth scrolling.');
 const nextInput=oldRoot.querySelector('.rv2-input');assert.equal(nextInput.value,'Unsent B');
 nextInput.value='Edited B';nextInput.handlers.input();assert.equal(nextDraft,'Edited B');
 assert.equal(oldDraftWrites,0,'Reused containers bind to the incoming conversation handlers.');
 next.commit();assert.equal(scrollBehaviors.length,1,'Commit is idempotent.');next.dispose();
}
console.log('Stable conversation presentation passed: staged content, retained grid/chat/thread, instant initial scroll and isolated incoming draft handlers.');

{
 const completion=deferred();
 const outgoing=createResearchV2View({conversation:{id:'outgoing',sources:[source],messages:[]},initialDraft:'Pending question',
  requestStore:{read:()=>({question:'Pending question',requestID:'outgoing-request'}),write(){}},onDraft(){},onSend:()=>completion.promise});
 const pending=outgoing.element.querySelector('.rv2-send').handlers.click();
 const incoming=createResearchV2View({presentation:outgoing.capturePresentation(),conversation:{id:'incoming',sources:[],messages:[]},
  onDraft(){},operationGate:{status:()=> 'Working in the new conversation',blocksInput:()=>true,subscribe:()=>()=>{}}});
 outgoing.dispose();incoming.commit();
 assert.equal(incoming.element.attributes['aria-busy'],'true');
 completion.resolve();await pending;await tick();
 assert.equal(incoming.element.attributes['aria-busy'],'true','Late cleanup from a disposed conversation cannot change the retained root.');
 assert.equal(incoming.element.querySelector('.rv2-input').disabled,true);
 incoming.dispose();
}
console.log('Retained-root ownership passed: disposed request cleanup cannot clear the new conversation busy state.');
