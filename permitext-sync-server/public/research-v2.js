// A small view with injected workspace/Reader adapters. No provider calls or
// evidence selection policy live in the presentation module.
const node = (tag, className = '', text = '') => {
  const el = document.createElement(tag); el.className = className; el.textContent = text; return el;
};
const action = (label, callback, className = '') => {
  const el = node('button', className, label); el.type = 'button'; el.addEventListener('click', callback); return el;
};
export const passageChipLabel = source => `${source.codePrefix || source.codeBook || 'Code'} § ${source.sectionNumber || source.sectionID} · ${String(source.codeEdition || source.edition || source.codeVersion || '').match(/(?:19|20)\d{2}/)?.[0] || 'Edition unavailable'}`;

export function createResearchV2View(options) {
  const { conversation, history = [], initialDraft = '', onDraft, onNew, onOpen, onSend,
    onBrowse, onFind, onReview, onInclude, onRemove, onCitation, onSnapshot,
    isCurrent = () => true, onStatus } = options;
  const root=node('section','research-v2');root.setAttribute('aria-label','Research');
  const rail=node('aside','rv2-rail');rail.setAttribute('aria-label','Numbered research questions');
  const railHead=node('div','rv2-rail-head');railHead.append(node('span','rv2-label','Questions'),action('+',()=>onNew(),'rv2-new'));
  railHead.lastChild.setAttribute('aria-label','New research question');
  const list=node('ol','rv2-questions');
  [...history].sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))||a.id.localeCompare(b.id)).forEach(item=>{
    const li=node('li');const open=action(item.title||item.starterQuestion||'New question',()=>onOpen(item.id),'rv2-question-link');
    if(item.id===conversation?.id)open.setAttribute('aria-current','page');li.append(open);list.append(li);
  });
  if(!history.length)list.append(node('li','rv2-empty-history','Your questions will appear here.'));
  rail.append(railHead,list);
  const chat=node('section','rv2-chat');chat.setAttribute('aria-label','Questions and answers');
  const mobileHistory=action('Questions',()=>{const expanded=root.classList.toggle('rv2-show-history');mobileHistory.setAttribute('aria-expanded',String(expanded));},'rv2-mobile-history');
  mobileHistory.setAttribute('aria-expanded','false');
  const thread=node('div','rv2-thread');thread.setAttribute('aria-label','Conversation');
  const status=node('p','rv2-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.hidden=true;
  let busy=false,controller=null,generation=0,lastRequest=options.requestStore?.read() || null,includeBusy=false,pendingBubble=null;
  function notice(text,error=false){status.hidden=!text;status.textContent=text;status.classList.toggle('is-error',error);onStatus?.(text);}
  function valid(attempt){return attempt===generation&&isCurrent()&&root.isConnected;}
  function paragraphText(parent,text,message){
    const expression=/\[(S[1-9]\d*)\]/g;let offset=0;
    for(const match of text.matchAll(expression)){
      parent.append(document.createTextNode(text.slice(offset,match.index)));
      const cite=action(match[0],()=>void onCitation(message,match[1]),'rv2-citation');cite.setAttribute('aria-label',`Open citation ${match[1]}`);parent.append(cite);offset=match.index+match[0].length;
    }
    parent.append(document.createTextNode(text.slice(offset)));
  }
  const messages=conversation?.messages||[];
  if(!messages.length){
    const welcome=node('div','rv2-welcome');welcome.append(node('h3','','What are you researching?'),node('p','','Ask a question or attach a passage from Reader.'));
    thread.append(welcome);
  }
  messages.forEach(message=>{
    if(message.role==='user'){
      const bubble=node('div','rv2-user',message.question||'');bubble.setAttribute('aria-label','Your question');thread.append(bubble);
    }else if(message.role==='assistant'){
      const bubble=node('article','rv2-answer');bubble.setAttribute('aria-label','Research answer');
      const text=message.answer?.answerText||message.answer?.conclusion||message.answer?.explanation||message.failure?.message||'This answer did not complete.';
      for(const paragraph of text.split(/\n\s*\n/)){const p=node('p');paragraphText(p,paragraph,message);bubble.append(p);}
      const footer=node('div','rv2-answer-footer');
      footer.append(node('span','',message.answer?.verification?.pass?'AI reviewed · Check cited text':message.answer?.verification?.status==='unreviewed'?'Unreviewed':'Incomplete'));
      footer.append(action('Sources used',()=>void showSnapshot(message),'rv2-text-action'));
      bubble.append(footer);thread.append(bubble);
    }
  });
  const composer=node('form','rv2-composer');composer.setAttribute('aria-label','Research message');
  const chips=node('div','rv2-chips');chips.setAttribute('aria-label','Passages attached to this conversation');
  const passageSources=(conversation?.sources||[]).filter(source=>source.kind==='selection'&&source.selectedText);
  passageSources.forEach(source=>{
    const chip=action(passageChipLabel(source),()=>showPassage(source),'rv2-passage-chip');chips.append(chip);
  });
  const input=node('textarea','rv2-input');input.setAttribute('aria-label','Research question');input.placeholder='Message';input.rows=2;input.maxLength=2000;input.value=initialDraft;
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
  chat.append(mobileHistory,thread,detail,status,composer);root.append(rail,chat);
  function update(){input.disabled=busy;attach.disabled=busy||includeBusy;send.disabled=busy||!input.value.trim();cancel.hidden=!busy;root.setAttribute('aria-busy',String(busy));}
  function showDetail(){thread.hidden=true;detail.hidden=false;detailBody.replaceChildren();return detailBody;}
  function showPassage(source){const content=showDetail();content.append(node('h3','',passageChipLabel(source)),node('p','rv2-source-text',source.selectedText));
    content.append(action('Open in Reader',()=>void options.onOpenReader(source),'rv2-text-action'));
    content.append(action('Remove from next question',async()=>{
      if(busy)return;try{await onRemove(source);}catch(error){notice(error.message,true);}
    },'rv2-text-action'));
  }
  async function showSnapshot(message){const attempt=++generation;notice('Loading original passages…');
    try{const saved=await onSnapshot(message);if(!valid(attempt))return;notice('');const content=showDetail();content.append(node('h3','','Sources used by this answer'));
      for(const source of saved){content.append(node('h4','',passageChipLabel(source)),node('p','rv2-source-text',source.passageText||source.selectedText||source.text||''));
        content.append(action('Open in Reader',()=>void options.onOpenReader(source),'rv2-text-action'));}
    }catch(error){if(valid(attempt))notice(error.message,true);}}
  async function findPassages(){
    if(busy)return;menu.hidden=true;attach.setAttribute('aria-expanded','false');const question=input.value.trim();
    if(!question&&!passageSources.length){notice('Enter a topic to find passages, or choose From Reader.');return;}
    const attempt=++generation;notice('Finding passages…');
    try{const result=await onFind(question);if(!valid(attempt))return;notice('');const content=showDetail();content.append(node('h3','','Candidate passages'));
      content.append(node('p','rv2-detail-caption','Review the exact text before including it. Relevance does not establish applicability.'));
      if(!result.length)content.append(node('p','','No passages were found. Try another term or browse Reader.'));
      for(const candidate of result){const row=node('article','rv2-candidate');row.append(node('h4','',passageChipLabel(candidate)),node('p','',candidate.title||''));
        row.append(action('Review in Reader',async()=>{
          if(includeBusy)return;includeBusy=true;update();try{await options.onOpenReader(candidate);const preview=await onReview(candidate);if(!valid(attempt))return;
            if(preview.requiresVisualReview){notice('Select this passage and review its visuals in Reader before attaching it.');return;}
            row.querySelector('.rv2-review')?.remove();const review=node('div','rv2-review');review.append(node('p','rv2-source-text',preview.selection.selectedText));
            const include=action('Include passage',async()=>{if(busy||includeBusy)return;includeBusy=true;update();try{await onInclude(preview.selection);}catch(error){notice(error.message,true);}finally{includeBusy=false;update();}});
            review.append(include);row.append(review);
          }catch(error){if(valid(attempt))notice(error.message,true);}finally{includeBusy=false;update();}
        },'rv2-text-action'));content.append(row);}
    }catch(error){if(valid(attempt))notice(error.message,true);}
  }
  async function sendQuestion(){
    if(busy||!input.value.trim())return;
    if(!passageSources.length){await findPassages();return;}
    const question=input.value.trim();
    if(!lastRequest||lastRequest.question!==question)lastRequest={question,requestID:crypto.randomUUID()};
    options.requestStore?.write(lastRequest);
    const attempt=++generation;busy=true;controller=new AbortController();update();notice('Preparing your answer…');
    thread.querySelector('.rv2-welcome')?.setAttribute('hidden','');
    pendingBubble?.remove();pendingBubble=node('div','rv2-user',question);thread.append(pendingBubble);thread.scrollTop=thread.scrollHeight;
    try{await onSend({...lastRequest,signal:controller.signal,onProgress:event=>{
      if(valid(attempt))notice(event.stage==='checking_citation_support'?'Checking the answer against your passages…':'Developing your answer…');
    }});if(isCurrent()){onDraft('');lastRequest=null;options.requestStore?.write(null);}}
    catch(error){if(valid(attempt)){pendingBubble?.remove();pendingBubble=null;thread.querySelector('.rv2-welcome')?.removeAttribute('hidden');notice(error.name==='AbortError'?'Stopped. Your draft and passages are retained.':error.message,true);}}
    finally{busy=false;controller=null;update();}
  }
  composer.addEventListener('submit',event=>{event.preventDefault();void sendQuestion();});
  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();void sendQuestion();}});
  update();
  if(messages.length)requestAnimationFrame(()=>{thread.scrollTop=thread.scrollHeight;});
  return {element:root,dispose(){generation++;controller?.abort();},focus(){input.focus({preventScroll:true});}};
}
