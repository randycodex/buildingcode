import {attachResearchQuestionRail} from "./research-question-rail.js?v=1";
import {revealResearchAnswer} from "./research-answer-reveal.js?v=1";
// A small view with injected workspace/Reader adapters. No provider calls or
// evidence selection policy live in the presentation module.
const node = (tag, className = '', text = '') => {
  const el = document.createElement(tag); el.className = className; el.textContent = text; return el;
};
const action = (label, callback, className = '') => {
  const el = node('button', className, label); el.type = 'button'; el.addEventListener('click', callback); return el;
};
export const passageChipLabel = source => `${source.codePrefix || source.codeBook || 'Code'} § ${source.sectionNumber || source.sectionID} · ${String(source.codeEdition || source.edition || source.codeSource?.editionLabel || source.codeVersion || '').match(/(?:19|20)\d{2}/)?.[0] || 'Edition unavailable'}`;

export {researchDiscoveryQuery} from './research-discovery-query.js?v=2';

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
  const { conversation, history = [], initialDraft = '', onDraft, onOpen, onSend,
    onBrowse, onFind, onReview, onInclude, onRemove, onCitation, onSnapshot,
    isCurrent = () => true, onStatus } = options;
  const root=node('section','research-v2');root.setAttribute('aria-label','Research');
  const rail=node('aside','rv2-rail');rail.setAttribute('aria-label','Numbered research questions');
  const list=node('ol','rv2-questions');
  const knownQuestions=new Set();
  function appendQuestions(items){items.forEach(item=>{
    if(knownQuestions.has(item.id))return;knownQuestions.add(item.id);
    const li=node('li');const title=item.title||item.starterQuestion||'New question';
    const open=action('',()=>onOpen(item.id),'rv2-question-link');open.append(node('span','rv2-question-title',title));open.title=title;
    if(item.id===conversation?.id)open.setAttribute('aria-current','page');li.append(open);list.append(li);
  });}
  appendQuestions(history);
  if(!history.length)list.append(node('li','rv2-empty-history','Your questions will appear here.'));
  rail.append(list);
  if(options.onOriginal)rail.append(action("Original Research",options.onOriginal,"rv2-text-action"));
  if(options.hasMore&&options.onLoadMore){const more=action('More questions',async()=>{more.disabled=true;try{const page=await options.onLoadMore();if(!isCurrent()||!root.isConnected)return;appendQuestions(page.conversations||[]);more.hidden=!page.hasMore;}catch(error){notice(error.message,true);}finally{more.disabled=false;}},'rv2-text-action');rail.append(more);}
  const divider=node('div','rv2-rail-divider');
  const questionRail=attachResearchQuestionRail({root,divider,widthStore:options.railWidthStore});
  const chat=node('section','rv2-chat');chat.setAttribute('aria-label','Questions and answers');
  const mobileHistory=action('Questions',()=>{const expanded=root.classList.toggle('rv2-show-history');mobileHistory.setAttribute('aria-expanded',String(expanded));},'rv2-mobile-history');
  mobileHistory.setAttribute('aria-expanded','false');
  const thread=node('div','rv2-thread');thread.setAttribute('aria-label','Conversation');
  const status=node('p','rv2-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.hidden=true;
  let busy=false,controller=null,generation=0,lastRequest=options.requestStore?.read() || null,includeBusy=false,pendingBubble=null,revealBusy=false,revealEntry=null,revealController=null;
  const revealTokens=[];
  function notice(text,error=false){status.hidden=!text;status.textContent=text;status.classList.toggle('is-error',error);onStatus?.(text);}
  function valid(attempt){return attempt===generation&&isCurrent()&&root.isConnected;}
  function paragraphText(parent,text,message,{reveal=false}={}){
    const appendText = value => {
      if (!reveal) { parent.append(document.createTextNode(value)); return; }
      for (const part of value.split(/(\s+)/).filter(Boolean)) {
        if (/^\s+$/.test(part)) parent.append(document.createTextNode(part));
        else { const word=node('span','rv2-reveal-token',part);parent.append(word);revealTokens.push(word); }
      }
    };
    const expression=/\[(S[1-9]\d*)\]/g;let offset=0;
    for(const match of text.matchAll(expression)){
      appendText(text.slice(offset,match.index));
      const cite=action(match[0],()=>void onCitation(message,match[1]),'rv2-citation');cite.setAttribute('aria-label',`Open citation ${match[1]}`);if(reveal){cite.classList.add('rv2-reveal-token');revealTokens.push(cite);}parent.append(cite);offset=match.index+match[0].length;
    }
    appendText(text.slice(offset));
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
      const text=researchAnswerText(message);
      for(const paragraph of text.split(/\n\s*\n/)){const p=node('p');paragraphText(p,paragraph,message,{reveal:Boolean(options.revealAnswerID&&message.id===options.revealAnswerID)});bubble.append(p);}
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
      const footer=node('div','rv2-answer-footer');
      footer.append(node('span','',researchReviewLabel(message.answer)));
      footer.append(action('Sources used',()=>void showSnapshot(message),'rv2-text-action'));
      const actions=options.renderAnswerActions?.(message);
      if(actions){const disclosure=node('details','rv2-saved-actions');disclosure.append(node('summary','','Save or share'),actions);footer.append(disclosure);}
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
  passageSources.forEach(source=>{
    const chip=action(passageChipLabel(source),()=>showPassage(source),'rv2-passage-chip');chips.append(chip);
  });
  const input=node('textarea','rv2-input');input.setAttribute('aria-label','Research question');input.dataset.researchDraftKey=options.draftKey||'';input.placeholder='Message';input.rows=2;input.maxLength=2000;input.value=initialDraft;
  input.addEventListener('input',()=>{lastRequest=null;onDraft(input.value);update();});
  const controls=node('div','rv2-composer-controls');
  const attach=action('+',()=>{menu.hidden=!menu.hidden;attach.setAttribute('aria-expanded',String(!menu.hidden));},'rv2-attach');attach.setAttribute('aria-label','Attach passages');attach.setAttribute('aria-expanded','false');
  const menu=node('div','rv2-attach-menu');menu.hidden=true;
  menu.append(action('From Reader',async()=>{menu.hidden=true;attach.setAttribute('aria-expanded','false');await onBrowse();}),action('Find passages',()=>void findPassages()));
  const send=action('↑',()=>void sendQuestion(),'rv2-send');send.setAttribute('aria-label','Send question');
  const cancel=action('Stop',()=>controller?.abort(),'rv2-text-action');cancel.hidden=true;
  controls.append(attach,cancel,send);composer.append(chips,input,controls,menu);
  const detail=node('section','rv2-detail');detail.hidden=true;detail.setAttribute('aria-label','Passage details');
  const detailBody=node('div','rv2-detail-body');
  const closeDetail=action('Close',()=>{detail.hidden=true;thread.hidden=false;},'rv2-text-action');detail.append(closeDetail,detailBody);
  chat.append(mobileHistory,thread,detail,status,composer);root.append(rail,divider,chat);
  function update(){input.disabled=busy;attach.disabled=busy||includeBusy||revealBusy;send.disabled=busy||includeBusy||revealBusy||!input.value.trim();cancel.hidden=!busy;root.setAttribute('aria-busy',String(busy));}
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
  function showPassage(source){const content=showDetail();content.append(node('h3','',passageChipLabel(source)),node('p','rv2-source-text',source.selectedText));
    content.append(action('Open in Reader',()=>void options.onOpenReader(source),'rv2-text-action'));
    content.append(action('Remove from next question',async()=>{
      if(busy)return;try{await onRemove(source);}catch(error){notice(error.message,true);}
    },'rv2-text-action'));
  }
  async function showSnapshot(message){if(busy||includeBusy)return;const attempt=++generation;notice('Loading original passages…');
    try{const saved=await onSnapshot(message);if(!valid(attempt))return;notice('');const content=showDetail();content.append(node('h3','','Sources used by this answer'));
      for(const source of saved){content.append(node('h4','',passageChipLabel(source)),node('p','rv2-source-text',source.passageText||source.selectedText||source.text||''));
        content.append(action('Open in Reader',()=>void options.onOpenReader(source),'rv2-text-action'));}
    }catch(error){if(valid(attempt))notice(error.message,true);}}
  async function findPassages(discoveryQuestion,{focus=''}={}){
    if(busy||includeBusy)return;menu.hidden=true;attach.setAttribute('aria-expanded','false');const question=typeof discoveryQuestion==='string'?discoveryQuestion:input.value.trim();
    if(!question&&!focus&&!passageSources.length){notice('Enter a topic to find passages, or choose From Reader.');return;}
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
    if(busy||includeBusy||revealBusy||!input.value.trim())return;
    if(!passageSources.length){await findPassages();return;}
    const question=input.value.trim();
    if(!lastRequest||lastRequest.question!==question)lastRequest={question,requestID:crypto.randomUUID()};
    options.requestStore?.write(lastRequest);
    const attempt=++generation;busy=true;detail.hidden=true;thread.hidden=false;controller=new AbortController();update();notice('Preparing your answer…');
    thread.querySelector('.rv2-welcome')?.setAttribute('hidden','');
    pendingBubble?.remove();pendingBubble=node('div','rv2-user',question);thread.append(pendingBubble);thread.scrollTop=thread.scrollHeight;
    try{await onSend({...lastRequest,signal:controller.signal,onProgress:event=>{
      if(valid(attempt))notice(event.stage==='checking_citation_support'?'Checking the answer against your passages…':'Developing your answer…');
    }});if(valid(attempt)){onDraft('');lastRequest=null;options.requestStore?.write(null);}}
    catch(error){if(valid(attempt)){pendingBubble?.remove();pendingBubble=null;thread.querySelector('.rv2-welcome')?.removeAttribute('hidden');notice(error.name==='AbortError'?'Stopped. Your draft and passages are retained.':error.message,true);}}
    finally{busy=false;controller=null;update();}
  }
  composer.addEventListener('submit',event=>{event.preventDefault();void sendQuestion();});
  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();void sendQuestion();}});
  update();
  // The workspace can mount this pane after an animation frame has already
  // passed. Wait for its first real layout before revealing the latest answer.
  let initialScroll=null;
  if(messages.length){initialScroll=new ResizeObserver(()=>{if(root.isConnected&&thread.clientHeight>0){
    if(revealEntry)thread.scrollTop+=revealEntry.getBoundingClientRect().top-thread.getBoundingClientRect().top-70;
    else thread.scrollTop=thread.scrollHeight;
    initialScroll.disconnect();}});initialScroll.observe(thread);}
  if(revealEntry)revealController=revealResearchAnswer({entry:revealEntry,tokens:revealTokens,isCurrent,
    onDone:()=>{revealBusy=false;update();}});
  return {element:root,dispose(){generation++;controller?.abort();initialScroll?.disconnect();revealController?.dispose();questionRail.dispose();},focus(){input.focus({preventScroll:true});}};
}
