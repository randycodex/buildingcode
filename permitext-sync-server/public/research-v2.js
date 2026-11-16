import {attachResearchQuestionRail, attachResearchHistoryTitleScroll} from "./research-question-rail.js?v=7";
import {revealResearchAnswer} from "./research-answer-reveal.js?v=1";
import {researchInlineRuns} from "./research-inline-format.js?v=1";
import {researchAnswerBlocks} from './research-answer-blocks.js?v=1';
// A small view with injected workspace/Reader adapters. No provider calls or
// evidence selection policy live in the presentation module.
const node = (tag, className = '', text = '') => {
  const el = document.createElement(tag); el.className = className; el.textContent = text; return el;
};
const action = (label, callback, className = '') => {
  const el = node('button', className, label); el.type = 'button'; el.addEventListener('click', callback); return el;
};
export const passageChipLabel = source => `${source.codePrefix || source.codeBook || 'Code'} § ${source.sectionNumber || source.sectionID} · ${String(source.codeEdition || source.edition || source.codeSource?.editionLabel || source.codeVersion || '').match(/(?:19|20)\d{2}/)?.[0] || 'Edition unavailable'}`;

export {researchDiscoveryQuery} from './research-discovery-query.js?v=3';

export const researchAnswerText = message => message.answer?.answerText || [message.answer?.conclusion, message.answer?.explanation].filter(Boolean).join('\n\n') || message.failure?.message || 'This answer did not complete.';
export const researchReviewLabel = answer => answer?.verification?.pass === true ? 'AI reviewed · Check cited text' : answer?.verification?.status === 'failed' || answer?.authorityStatus === 'incomplete' ? 'Incomplete' : 'Unreviewed';

export function researchAnswerTiming(message,{locale,timeZone}={}){
  const date=message.createdAt?new Date(message.createdAt):null;
  const validDate=date&&Number.isFinite(date.getTime());
  const milliseconds=message.answer?.delivery?.generationMilliseconds;
  const hasDuration=typeof milliseconds==='number'&&Number.isFinite(milliseconds)&&milliseconds>=0;
  if(!validDate&&!hasDuration)return null;
  const zone=timeZone?{timeZone}:{};
  const seconds=hasDuration?Math.round(milliseconds/100)/10:null;
  const rounded=hasDuration?Math.round(milliseconds/1000):null;
  const duration=hasDuration?(seconds<1?'<1s':seconds<60?`${seconds}s`:`${Math.floor(rounded/60)}m${rounded%60?` ${rounded%60}s`:''}`):'';
  const fullDate=validDate?date.toLocaleString(locale,{dateStyle:'medium',timeStyle:'long',...zone}):'';
  return {dateTime:validDate?date.toISOString():'',clock:validDate?date.toLocaleTimeString(locale,{hour:'numeric',minute:'2-digit',...zone}):'',duration,
    description:[fullDate,hasDuration?`Answer prepared in ${seconds} seconds`:''].filter(Boolean).join(' · ')};
}

export function researchV2RetryContext(previous,next,requestID){
  const identity=sources=>JSON.stringify((sources||[]).map(s=>[s.id,s.codeVersion,s.selectedText]));
  if(!next||previous.id!==next.id||Number(previous.evidenceSetVersion||1)!==Number(next.evidenceSetVersion||1)||
    Number(previous.contextRevision||0)!==Number(next.contextRevision||0)||identity(previous.sources)!==identity(next.sources))return previous;
  const before=previous.messages||[],after=next.messages||[];
  if(!before.every((m,i)=>after[i]?.id===m.id))return previous;
  const added=after.slice(before.length);
  return added.length&&added.every(m=>m.role==='user'&&m.failure&&(m.requestID||m.researchRequestID)===requestID)?next:previous;
}

export function createResearchV2View(options) {
  let disposed=false;
  const { conversation, history = [], initialDraft = '', onDraft, onOpen, onSend,
    onFind, onReview, onInclude, onRemove, onCitation, onSnapshot,
    isCurrent: contextIsCurrent = () => true, onStatus } = options;
  const isCurrent=()=>!disposed&&contextIsCurrent();
  const presentation=options.presentation;
  const root=presentation?.root || node('section','research-v2');root.setAttribute('aria-label','Research');
  const historyTitles=attachResearchHistoryTitleScroll({root});
  const rail=node('aside','rv2-rail');rail.setAttribute('aria-label','Research history');
  const list=node('div','rv2-questions');
  const historyRecords=[];
  if(options.historyManagement)rail.addEventListener("keydown",options.historyManagement.handleKeyDown);
  const knownQuestions=new Set();
  function renderHistory(){
    const scroll=rail.scrollTop;
    list.replaceChildren();
    const groups=options.historyGroups?.(historyRecords)||[{conversations:historyRecords}];
    for(const group of groups){
      const section=node('section','rv2-history-group');
      if(group.label){section.setAttribute('aria-label',group.label);section.append(node('h3','rv2-history-group-label',group.label));}
      const rows=node('ul','rv2-question-group-list');
      for(const item of group.conversations){
        const li=node('li','rv2-question-row');
        const title=options.historyTitle?.(item)||item.title||item.starterQuestion||'New question';
        const open=action('',()=>{if(!options.historyManagement?.selectConversation(item.id))onOpen(item.id);},'rv2-question-link');
        const titleClip=node('span','rv2-question-title');
        titleClip.append(node('span','rv2-question-title-text',title));
        open.append(titleClip);open.title=item.starterQuestion||title;
        if(item.id===conversation?.id)open.setAttribute('aria-current','page');
        const rename=()=>{
          const form=node('form','rv2-rename-form');
          const input=node('input','rv2-rename-input');input.type='text';input.maxLength=120;input.value=title;input.setAttribute('aria-label','Research conversation name');
          const save=action('Save',null),cancel=action('Cancel',()=>renderHistory());save.type='submit';
          const message=node('span','rv2-rename-status');message.setAttribute('role','status');
          form.append(input,save,cancel,message);li.replaceChildren(form);li.classList.add?.('is-renaming');input.focus();
          form.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();renderHistory();}});
          form.addEventListener('submit',async event=>{
            event.preventDefault();if(!isCurrent()||!root.isConnected)return;
            const next=input.value.replace(/\s+/g,' ').trim();
            if(!next){message.textContent='Enter a conversation name.';return;}
            input.disabled=save.disabled=cancel.disabled=true;message.textContent='Saving…';
            try{
              const updated=await options.onRename(item,next);
              if(!isCurrent()||!root.isConnected||!updated)return;
              Object.assign(item,updated);renderHistory();
            }catch(error){if(isCurrent()&&root.isConnected)message.textContent=error.message||'The name could not be saved.';}
            finally{input.disabled=save.disabled=cancel.disabled=false;}
          });
        };
        const pin=async()=>{
          if(busy||!isCurrent()||!root.isConnected)return;
          try{const updated=await options.onPin(item,item.isPinned!==true);
            if(isCurrent()&&root.isConnected&&updated){Object.assign(item,updated);renderHistory();}
          }catch(error){if(isCurrent()&&root.isConnected)notice(error.message||'The pin could not be updated.',true);}
        };
        li.append(open);rows.append(li);
        options.historyManagement?.bindRow(li,open,item,title,{...(options.onRename?{onRename:rename}:{}),...(options.onPin?{onPin:pin}:{})});
      }
      section.append(rows);list.append(section);
    }
    options.historyManagement?.setConversations(historyRecords);
    rail.scrollTop=scroll;
    historyTitles.refresh();
  }
  function appendQuestions(items){items.forEach(item=>{
    if(knownQuestions.has(item.id))return;knownQuestions.add(item.id);historyRecords.push(item);
  });renderHistory();}
  appendQuestions(history);
  if(!history.length)list.append(node('p','rv2-empty-history','Your questions will appear here.'));
  const newChat = options.onNew ? action('New Chat +',async()=>{
    if(busy||includeBusy||revealBusy||chatTransitionPending||operationPending()||!isCurrent()||!root.isConnected)return;
    // Lock synchronously, before the create request can yield. The old
    // conversation must never accept input that a new mount will discard.
    chatTransitionPending=true;update();
    try{await options.onNew();}
    catch(error){if(isCurrent()&&root.isConnected)notice(error.message||'Could not start Research',true);}
    finally{chatTransitionPending=false;if(isCurrent()&&root.isConnected)update();}
  },'rv2-new-chat') : null;
  const historyTop=node('div','rv2-rail-top-row');
  if(newChat)historyTop.append(newChat);
  if(options.historyManagement?.toolbar)historyTop.append(options.historyManagement.toolbar);
  const historyToggle=action('',null,'icon-button rv2-history-toggle');
  historyTop.append(historyToggle);rail.append(historyTop);
  if(options.historyManagement)rail.append(options.historyManagement.element);
  rail.append(list);
  if(options.hasMore&&options.onLoadMore){const more=action('More questions',async()=>{more.disabled=true;try{const page=await options.onLoadMore();if(!isCurrent()||!root.isConnected)return;appendQuestions(page.conversations||[]);more.hidden=!page.hasMore;}catch(error){notice(error.message,true);}finally{more.disabled=false;}},'rv2-text-action');rail.append(more);}
  const divider=node('div','rv2-rail-divider');
  const questionRail=attachResearchQuestionRail({root,divider,toggle:historyToggle,widthStore:options.railWidthStore,
    collapsedStore:options.railCollapsedStore,onCollapse:collapsed=>options.renderHistoryToggle?.(historyToggle,collapsed)});
  const chat=presentation?.chat || node('section','rv2-chat');chat.setAttribute('aria-label','Questions and answers');
  const mobileHistory=action('Questions',()=>{const expanded=root.classList.toggle('rv2-show-history');mobileHistory.setAttribute('aria-expanded',String(expanded));},'rv2-mobile-history');
  mobileHistory.setAttribute('aria-expanded','false');
  let thread=node('div','rv2-thread');thread.setAttribute('aria-label','Conversation');
  const status=node('p','rv2-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.hidden=true;
  let busy=false,controller=null,generation=0,lastRequest=options.requestStore?.read() || null,includeBusy=false,pendingTurn=null,revealBusy=false,revealEntry=null,revealController=null,chatTransitionPending=false;
  const revealTokens=[];
  function notice(text,error=false){if(disposed)return;status.hidden=!text;status.textContent=text;status.classList.toggle('is-error',error);onStatus?.(text);}
  function valid(attempt){return attempt===generation&&isCurrent()&&root.isConnected;}
  function paragraphText(parent,text,message,{reveal=false}={}){
    const appendText = (target,value) => {
      if (!reveal) { target.append(document.createTextNode(value)); return; }
      for (const part of value.split(/(\s+)/).filter(Boolean)) {
        if (/^\s+$/.test(part)) target.append(document.createTextNode(part));
        else { const word=node('span','rv2-reveal-token',part);target.append(word);revealTokens.push(word); }
      }
    };
    for (const run of researchInlineRuns(text)) {
      let target = parent;
      for (const [style,tag] of [['bold','strong'],['italic','em'],['code','code']]) {
        if (run[style]) {const wrapper=node(tag);target.append(wrapper);target=wrapper;}
      }
      if (run.code) {appendText(target,run.text);continue;}
      const expression=/\[(S[1-9]\d*)\]/g;let offset=0;
      for(const match of run.text.matchAll(expression)){
        appendText(target,run.text.slice(offset,match.index));
        const cite=action(match[0],()=>void onCitation(message,match[1]),'rv2-citation');cite.setAttribute('aria-label',`Open citation ${match[1]}`);if(reveal){cite.classList.add('rv2-reveal-token');revealTokens.push(cite);}target.append(cite);offset=match.index+match[0].length;
      }
      appendText(target,run.text.slice(offset));
    }
  }
  function answerBlocks(parent,blocks,message,reveal){
    for(const block of blocks){
      if(block.type==='paragraph'){
        const p=node('p');paragraphText(p,block.text,message,{reveal});parent.append(p);continue;
      }
      const list=node(block.ordered?'ol':'ul','rv2-answer-list');
      const start=block.items[0].number;
      if(block.ordered&&start!==1)list.setAttribute('start',String(start));
      const repeated=block.ordered&&block.items.every(item=>item.number===start);
      block.items.forEach(item=>{
        const li=node('li');
        if(block.ordered&&!repeated)li.setAttribute('value',String(item.number));
        answerBlocks(li,item.blocks,message,reveal);list.append(li);
      });
      parent.append(list);
    }
  }
  const messages=conversation?.messages||[];
  if(!messages.length){
    const welcome=node('div','rv2-welcome');welcome.append(node('h3','','What are you researching?'),node('p','','Ask a question or attach a passage from Reader.'));
    thread.append(welcome);
  }
  messages.forEach(message=>{
    if(message.role==='user'){
      const bubble=node('div','rv2-user',message.question||'');bubble.setAttribute('aria-label','Your question');thread.append(bubble);
      if(message.failure){const failure=node('div','rv2-answer');failure.append(node('p','',message.failure.message||'This question did not complete.'));
        const sameContext=Number(message.contextRevision||0)===Number(conversation.contextRevision||0);
        failure.append(action(sameContext?'Retry question':'Ask again',()=>{if(busy||includeBusy)return;input.value=message.question||'';onDraft(input.value);lastRequest={question:input.value.trim(),requestID:sameContext&&(message.requestID||message.researchRequestID)||crypto.randomUUID()};update();void sendQuestion();},'rv2-text-action'));thread.append(failure);}
    }else if(message.role==='assistant'){
      const bubble=node('article','rv2-answer');bubble.setAttribute('aria-label','Research answer');
      bubble.dataset.messageId=message.id || '';
      const text=researchAnswerText(message);
      answerBlocks(bubble,researchAnswerBlocks(text),message,Boolean(options.revealAnswerID&&message.id===options.revealAnswerID));
      const gapLists=[['Sources still needed',message.answer?.additionalEvidenceNeeded],['Project facts still needed',message.answer?.missingFacts]];
      if(gapLists.some(([,items])=>Array.isArray(items)&&items.some(item=>typeof item==='string'&&item.trim()))){
        const gaps=node('div','rv2-answer-gaps');gaps.setAttribute('aria-label','Unresolved information');
        const originalQuestion=message.question||messages[messages.indexOf(message)-1]?.question||'';
        for(const [label,items] of gapLists){
          const unique=[...new Set((Array.isArray(items)?items:[]).filter(item=>typeof item==='string'&&item.trim()))];
          if(!unique.length)continue;gaps.append(node('h4','',label));const list=node('ul');
          for(const item of unique){const li=node('li');paragraphText(li,item,message);
            const source=label==='Sources still needed';
            if(source&&onFind){const find=action('Find source',()=>void findPassages(originalQuestion,{focus:item}),'rv2-text-action');find.setAttribute('aria-label',`Find source: ${item}`);li.append(find);}
            if(!source){const respond=action('Add fact',()=>showFactEntry(item,originalQuestion),'rv2-text-action');respond.setAttribute('aria-label',`Add fact: ${item}`);li.append(respond);}
            list.append(li);
          }gaps.append(list);
        }
        bubble.append(gaps);
      }
      const references=message.answer?.referenceLookup?.added || [];
      if(references.length){
        const added=node('div','rv2-reference-sources');added.setAttribute('aria-label','Automatically retrieved references');
        added.append(node('p','rv2-detail-caption','References added from the same codebook and edition'));
        for(const reference of references){
          const label=`${reference.label} · ${String(reference.codeEdition || '').match(/(?:19|20)\d{2}/)?.[0] || reference.codeEdition}`;
          added.append(action(label,()=>void onCitation(message,reference.citationID),'rv2-text-action'));
        }
        bubble.append(added);
      }
      const footer=node('div','rv2-answer-footer');
      if(message.answer?.verification?.pass!==true)footer.append(node('span','',researchReviewLabel(message.answer)));
      footer.append(action('Sources used',()=>void showSnapshot(message),'rv2-text-action'));
      const actions=options.renderAnswerActions?.(message);
      if(actions) footer.append(actions);
      bubble.append(footer);
      const entry=node('div','rv2-answer-entry');entry.dataset.answerId=message.id||'';entry.append(bubble);
      if(options.revealAnswerID&&message.id===options.revealAnswerID){
        revealEntry=entry;revealBusy=true;entry.setAttribute('aria-live','polite');entry.setAttribute('aria-atomic','true');
      }
      const timing=researchAnswerTiming(message);
      if(timing){
        const stamp=node('div','rv2-answer-time');stamp.title=timing.description;stamp.setAttribute('aria-label',timing.description);
        if(timing.clock){const clock=node('time','',timing.clock);clock.setAttribute('datetime',timing.dateTime);stamp.append(clock);}
        if(timing.clock&&timing.duration){const separator=node('span','','·');separator.setAttribute('aria-hidden','true');stamp.append(separator);}
        if(timing.duration)stamp.append(node('span','rv2-answer-duration',timing.duration));
        entry.append(stamp);
      }
      thread.append(entry);
    }
  });
  const composer=node('form','rv2-composer');composer.setAttribute('aria-label','Research message');
  const chips=node('div','rv2-chips');chips.setAttribute('aria-label','Passages attached to this conversation');
  const passageSources=(conversation?.sources||[]).filter(source=>source.kind==='selection'&&source.selectedText);
  const passageControls=[];
  passageSources.forEach(source=>{
    const attachment=node('span','rv2-passage-attachment');
    const chip=action(passageChipLabel(source),()=>showPassage(source),'rv2-passage-chip');
    const remove=action('',()=>void removePassage(source),'rv2-passage-remove');
    remove.setAttribute('aria-label',`Remove ${passageChipLabel(source)} from next question`);
    remove.title='Remove passage from future questions';
    remove.innerHTML='<svg aria-hidden="true" focusable="false" data-lucide-icon="x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m18 6-12 12M6 6l12 12"/></svg>';
    passageControls.push(chip,remove);attachment.append(chip,remove);chips.append(attachment);
  });
  const input=node('textarea','rv2-input');input.setAttribute('aria-label','Research question');input.dataset.researchDraftKey=options.draftKey||'';input.placeholder='Message';input.rows=1;input.maxLength=2000;input.value=initialDraft;
  let measuredDraft=null,measuredWidth=0,composerResize=null;
  const resizeInput=()=>{
    const width=input.clientWidth;
    if(disposed||!width||width===measuredWidth&&input.value===measuredDraft)return;
    measuredWidth=width;measuredDraft=input.value;
    input.style.height='auto';
    input.style.height=`${input.scrollHeight}px`;
  };
  input.addEventListener('input',()=>{lastRequest=null;onDraft(input.value);update();});
  const controls=node('div','rv2-composer-controls');
  const send=action('↑',()=>void sendQuestion(),'rv2-send');send.setAttribute('aria-label','Send question');
  const cancel=action('Stop',()=>controller?.abort(),'rv2-text-action');cancel.hidden=true;
  controls.append(cancel,send);composer.append(chips,input,controls);
  composer.addEventListener('click',event=>{
    if(event.target===composer||event.target===controls)input.focus({preventScroll:true});
  });
  const projectContext = options.renderProjectContext?.(composer);
  const operationStatus=node('p','rv2-status');operationStatus.setAttribute('role','status');operationStatus.hidden=true;
  const detail=node('section','rv2-detail');detail.hidden=true;detail.setAttribute('aria-label','Passage details');
  const detailBody=node('div','rv2-detail-body');
  const closeDetail=action('Close',()=>{detail.hidden=true;thread.hidden=false;},'rv2-text-action');detail.append(closeDetail,detailBody);
  const operationPending=()=>chatTransitionPending||Boolean(options.operationGate?.status());
  function update(){if(disposed)return;resizeInput();const pending=operationPending();input.disabled=busy||chatTransitionPending||Boolean(options.operationGate?.blocksInput?.());send.disabled=busy||includeBusy||revealBusy||pending||!input.value.trim();cancel.hidden=!busy;root.setAttribute('aria-busy',String(busy||includeBusy||revealBusy||pending));
    if(newChat)newChat.disabled=busy||includeBusy||revealBusy||pending;
    passageControls.forEach(button=>{button.disabled=busy||includeBusy||revealBusy||pending;});
    operationStatus.textContent=chatTransitionPending?'Starting new chat…':options.operationGate?.status() || '';operationStatus.hidden=!pending;
    projectContext?.querySelectorAll('button').forEach(button=>{button.disabled=busy||includeBusy||revealBusy||pending;});}
  const stopObservingOperations=options.operationGate?.subscribe(update);
  function showDetail(){thread.hidden=true;detail.hidden=false;detailBody.replaceChildren();return detailBody;}
  function showFactEntry(fact,question){
    if(busy||includeBusy)return;const attempt=++generation,content=showDetail();
    content.append(node('h3','','Add a project fact'),node('p','',fact));
    const response=node('textarea','rv2-fact-input');response.setAttribute('aria-label','Your response to the missing fact');response.rows=3;response.maxLength=1500;
    content.append(response,node('p','rv2-detail-caption','State what you know, including any uncertainty. Your response will be added to the message draft.'));
    content.append(action('Add to draft',()=>{
      if(!valid(attempt)||busy||includeBusy)return;
      if(!response.value.trim()){notice('Enter your response before adding it to the draft.');return;}
      const addition=[question?`Regarding the earlier question: ${question}`:'',`Requested fact: ${fact}`,`My response: ${response.value.trim()}`].filter(Boolean).join('\n');
      const draft=[input.value.trim(),addition].filter(Boolean).join('\n\n');
      if(draft.length>input.maxLength){notice('This would exceed the message limit. Shorten the draft or your response; both are retained.',true);return;}
      input.value=draft;lastRequest=null;onDraft(draft);detail.hidden=true;thread.hidden=false;update();notice('Fact added to your draft. Send the message when ready.');input.focus({preventScroll:true});
    },'rv2-text-action'));response.focus({preventScroll:true});
  }
  async function removePassage(source){
    if(disposed||busy||includeBusy||revealBusy||operationPending()||!isCurrent()||!root.isConnected)return;
    includeBusy=true;update();
    try{await onRemove(source);if(!disposed&&isCurrent()){detail.hidden=true;thread.hidden=false;}}
    catch(error){if(!disposed&&isCurrent())notice(error.message||'The passage could not be removed.',true);}
    finally{includeBusy=false;update();}
  }
  function showPassage(source){const content=showDetail();content.append(node('h3','',passageChipLabel(source)),node('p','rv2-source-text',source.selectedText));
    content.append(action('Open in Reader',()=>void options.onOpenReader(source),'rv2-text-action'));
    content.append(action('Remove from next question',()=>void removePassage(source),'rv2-text-action'));
  }
  function snapshotRow(label,preview,className=''){
    const row=node('details',`rv2-snapshot-row ${className}`.trim());row.open=false;
    const summary=node('summary'),heading=node('span','rv2-snapshot-label',label);
    const text=node('span','rv2-snapshot-summary');text.append(heading);
    if(preview)text.append(node('span','rv2-snapshot-preview',preview));
    summary.append(text);
    const body=node('div','rv2-snapshot-body');row.append(summary,body);
    return {row,body};
  }
  function snapshotPreview(value){
    const text=String(value || '').replace(/\s+/g,' ').trim();
    return text.length>110?`${text.slice(0,109)}…`:text;
  }
  async function showSnapshot(message){if(busy||includeBusy)return;const attempt=++generation;notice('Loading original passages…');
    try{const saved=await onSnapshot(message);if(!valid(attempt))return;notice('');const content=showDetail();content.append(node('h3','rv2-snapshot-title','Sources used'));
      const sources=Array.isArray(saved)?saved:saved.sources||[];
      const snapshot=saved.projectContextSnapshot,information=snapshot?.projectInformation;
      if(information){
        const facts=information.facts||[];
        const preview=[snapshotPreview(information.address || information.description),facts.length?`${facts.length} ${facts.length===1?'fact':'facts'}`:''].filter(Boolean).join(' · ');
        const {row,body:context}=snapshotRow('Project context',preview,'rv2-project-snapshot');
        const capturedAt=snapshot.capturedAt||information.capturedAt||snapshot.reviewedAt||information.reviewedAt;
        if(capturedAt)context.append(node('p','rv2-detail-caption',`Captured ${new Date(capturedAt).toLocaleString()}`));
        if(information.address)context.append(node('p','rv2-source-text',information.address));
        if(information.description)context.append(node('p','rv2-source-text',information.description));
        for(const fact of facts)context.append(node('p','rv2-source-text',typeof fact==='string'?fact:JSON.stringify(fact)));
        content.append(row);
      }
      const sourceList=node('ol','rv2-snapshot-list');sourceList.setAttribute('role','list');sourceList.setAttribute('aria-label','Code sources');
      sources.forEach((source,index)=>{
        const text=source.passageText||source.selectedText||source.text||'';
        const automatic=source.provenance?.origin==='permitext_cross_reference';
        const preview=[automatic?'Automatically retrieved':'',snapshotPreview(text)].filter(Boolean).join(' · ');
        const {row,body}=snapshotRow(`${index+1}. ${passageChipLabel(source)}`,preview);
        if(automatic)body.append(node('p','rv2-detail-caption',source.provenance.retrievalReason || 'Automatically retrieved explicit reference'));
        body.append(node('p','rv2-source-text',text),action('Open in Reader',()=>void options.onOpenReader(source),'rv2-text-action'));
        const item=node('li');item.append(row);sourceList.append(item);
      });
      if(sources.length)content.append(sourceList);
    }catch(error){if(valid(attempt))notice(error.message,true);}}
  async function findPassages(discoveryQuestion,{focus=''}={}){
    if(busy||includeBusy)return;const question=typeof discoveryQuestion==='string'?discoveryQuestion:input.value.trim();
    if(!question&&!focus&&!passageSources.length){notice('Enter a topic to find passages.');return;}
    const attempt=++generation;notice('Finding passages…');
    try{const result=await onFind(question||focus,{focus});if(!valid(attempt))return;notice('');const content=showDetail();content.append(node('h3','','Candidate passages'));
      if(focus)content.append(node('p','rv2-detail-caption',`Source needed: ${focus}`));
      content.append(node('p','rv2-detail-caption','Review the exact text before including it. Relevance does not establish applicability.'));
      const candidates=Array.isArray(result)?result:result.candidates||[];
      const count=node('p','rv2-detail-caption');content.append(count);
      const updateCount=page=>{count.textContent=page.coverage?`Showing ${page.coverage.shownCount} of ${page.coverage.candidateCount} candidates.`:'';count.hidden=!count.textContent;};updateCount(result);
      if(result.searchQuery||result.sourceEditions?.length||result.queryExpansions?.length||result.unresolvedReferences?.length||result.coverageLimitations?.length){
        const notes=node('details','rv2-discovery-notes');notes.append(node('summary','',`Search scope${result.unresolvedReferences?.length?` · ${result.unresolvedReferences.length} unresolved references`:''}`));
        if(result.searchQuery)notes.append(node('p','rv2-detail-caption',`Search terms: ${result.searchQuery}`));
        if(result.queryExpansions?.length)notes.append(node('p','rv2-detail-caption',`Related terms: ${result.queryExpansions.join('; ')}`));
        if(result.sourceEditions?.length)notes.append(node('p','rv2-detail-caption',`Searched: ${[...new Set(result.sourceEditions.map(edition=>edition.codeEdition))].join('; ')}`));
        for(const missing of result.unresolvedReferences||[])notes.append(node('p','rv2-detail-caption',`Unresolved reference: ${missing.title}. ${missing.reason||''}`));
        for(const limitation of result.coverageLimitations||[])notes.append(node('p','rv2-detail-caption',limitation));
        content.append(notes);
      }
      if(!candidates.length)content.append(node('p','','No passages were found. Try another term or browse Reader.'));
      const rows=node('div','rv2-candidates'),seen=new Set();content.append(rows);
      function appendCandidates(items){for(const candidate of items){const identity=candidate.id||`${candidate.codeVersion}:${candidate.sectionID}:${candidate.suggestedText||''}`;if(seen.has(identity))continue;seen.add(identity);
        const row=node('article','rv2-candidate');row.append(node('h4','',passageChipLabel(candidate)),node('p','',candidate.title||''));
        const kind={provision:'Provision',definition:'Definition',table:'Table and notes',scope:'Scope',reference:'Cross-reference'}[candidate.kind];
        if(kind||candidate.reason)row.append(node('p','rv2-detail-caption',[kind,candidate.reason].filter(Boolean).join(' · ')));
        row.append(action('Review in Reader',async()=>{
          if(busy||includeBusy)return;includeBusy=true;update();try{await options.onOpenReader(candidate);if(!valid(attempt))return;
            if(candidate.requiresReaderSelection){notice('Select the complete table and its footnotes in Reader before attaching it.');return;}
            const preview=await onReview(candidate);if(!valid(attempt))return;
            if(preview.requiresVisualReview){notice('Select this passage and review its visuals in Reader before attaching it.');return;}
            row.querySelector('.rv2-review')?.remove();const review=node('div','rv2-review');review.append(node('p','rv2-source-text',preview.selection.selectedText));
            const include=action('Include passage',async()=>{if(busy||includeBusy)return;includeBusy=true;update();try{await onInclude(preview.selection);}catch(error){notice(error.message,true);}finally{includeBusy=false;update();}});
            review.append(include);row.append(review);
          }catch(error){if(valid(attempt))notice(error.message,true);}finally{includeBusy=false;update();}
        },'rv2-text-action'));rows.append(row);}}
      appendCandidates(candidates);
      let nextCursor=result.nextCursor,loadingMore=false;
      const more=action('More results',async()=>{
        if(busy||includeBusy||loadingMore||!nextCursor)return;loadingMore=true;more.disabled=true;
        try{const page=await onFind(question||focus,{focus,cursor:nextCursor});if(!valid(attempt))return;
          appendCandidates(page.candidates||[]);updateCount(page);nextCursor=page.nextCursor;more.hidden=!nextCursor;
        }catch(error){if(valid(attempt))notice(error.message,true);}finally{loadingMore=false;more.disabled=false;}
      },'rv2-text-action');more.hidden=!nextCursor;content.append(more);
    }catch(error){if(valid(attempt))notice(error.message,true);}
  }
  async function sendQuestion(){
    if(busy||includeBusy||revealBusy||operationPending()||!input.value.trim())return;
    if(!passageSources.length&&!projectContext?._projectContextOptions?.enabled()){await findPassages();return;}
    const submittedDraft=input.value,question=submittedDraft.trim();
    if(!lastRequest||lastRequest.question!==question)lastRequest={question,requestID:crypto.randomUUID()};
    options.requestStore?.write(lastRequest);
    const attempt=++generation;busy=true;detail.hidden=true;thread.hidden=false;controller=new AbortController();notice('');
    thread.querySelector('.rv2-welcome')?.setAttribute('hidden','');
    pendingTurn?.remove();pendingTurn=node('div','rv2-pending-turn');
    const turnStatus=node('p','rv2-status rv2-turn-status');
    turnStatus.setAttribute('role','status');turnStatus.setAttribute('aria-live','polite');
    const turnNotice=(text,error=false)=>{
      turnStatus.hidden=!text;turnStatus.textContent=text;turnStatus.classList.toggle('is-error',error);onStatus?.(text);
    };
    pendingTurn.append(node('div','rv2-user',question),turnStatus);thread.append(pendingTurn);
    // Clear the visible composer now; retain its durable draft/request until
    // success so failures, stops and interrupted sessions remain recoverable.
    input.value='';update();turnNotice('Preparing your answer…');thread.scrollTop=thread.scrollHeight;
    try{await onSend({...lastRequest,signal:controller.signal,onProgress:event=>{
      if(valid(attempt))turnNotice(event.stage==='checking_citation_support'?'Checking the answer against the sources…':/search|retriev|discover/.test(event.stage)?'Finding relevant code for your question…':'Developing your answer…');
    }});if(valid(attempt)){turnNotice('');onDraft('');lastRequest=null;options.requestStore?.write(null);}}
    catch(error){if(valid(attempt)){input.value=submittedDraft;update();turnNotice(error.name==='AbortError'?'Stopped. Your draft and passages are retained.':error.message,true);
      if((error.payload?.code||error.code)==='V2_REVIEW_FAILED'){
        // A definitive failed review is not an uncertain in-flight request.
        // An explicit retry gets a new identity and the same visible inputs.
        lastRequest=null;options.requestStore?.write(null);
        const retry=action('Retry answer',()=>{retry.remove();void sendQuestion();},'rv2-text-action');
        turnStatus.append(retry);
      }
    }}
    finally{busy=false;controller=null;update();}
  }
  composer.addEventListener('submit',event=>{event.preventDefault();void sendQuestion();});
  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();void sendQuestion();}});
  update();
  let initialScroll=null,committed=false;
  const positionThread=()=>{
    if(disposed||!root.isConnected||!(thread.clientHeight>0))return false;
    // Saved conversations appear at their final position before paint. The
    // thread's normal smooth scrolling is reserved for later user navigation.
    const behavior=thread.style.scrollBehavior;
    thread.style.scrollBehavior='auto';
    if(revealEntry)thread.scrollTop+=revealEntry.getBoundingClientRect().top-thread.getBoundingClientRect().top-70;
    else thread.scrollTop=messages.length?thread.scrollHeight:0;
    thread.style.scrollBehavior=behavior || '';
    initialScroll?.disconnect();
    return true;
  };
  const commit=()=>{
    if(committed||disposed)return;
    committed=true;
    if(presentation?.thread){
      presentation.thread.replaceChildren(...thread.childNodes);
      thread=presentation.thread;
    }
    thread.hidden=false;
    chat.replaceChildren(mobileHistory,thread,detail,status,operationStatus,composer);
    root.replaceChildren(rail,divider,chat);
    historyTitles.refresh();
    resizeInput();
    if(typeof ResizeObserver==='function'){composerResize=new ResizeObserver(resizeInput);composerResize.observe(input);}
    // First mounts can be detached; retained threads can be positioned now.
    if(messages.length){initialScroll=new ResizeObserver(positionThread);initialScroll.observe(thread);}
    positionThread();
    if(revealEntry)revealController=revealResearchAnswer({entry:revealEntry,tokens:revealTokens,isCurrent,
      onDone:()=>{revealBusy=false;update();}});
  };
  if(!presentation)commit();
  return {element:root,commit,capturePresentation:()=>({root,chat,thread}),dispose(){if(disposed)return;disposed=true;stopObservingOperations?.();options.historyManagement?.dispose();generation++;controller?.abort();initialScroll?.disconnect();composerResize?.disconnect();revealController?.dispose();questionRail.dispose();historyTitles.dispose();},focus(){input.focus({preventScroll:true});},
    focusAnswer(answerID){
      const answer=Array.from(thread.querySelectorAll('.rv2-answer')).find(entry=>entry.dataset.messageId===answerID);
      if(disposed || !answer || !root.isConnected)return false;
      // A saved-answer link takes precedence over the initial latest-message scroll.
      initialScroll?.disconnect();answer.tabIndex=-1;answer.focus({preventScroll:true});answer.scrollIntoView({block:'center'});return true;
    }};
}
