// A working model window is separate from the complete, account-scoped archive.
// Nothing here mutates saved messages, evidence or their citation identities.
const bytes=value=>Buffer.byteLength(JSON.stringify(value),'utf8');
const ignored=new Set('the and for with from this that which where when what whether required requirements code codes does must shall how can their its may are was were will would could should have has had been into also only our your you about did said tell know please'.split(' '));
const words=text=>[...new Set((String(text||'').toLowerCase().match(/[a-z0-9]+(?:\.[a-z0-9]+)*/g)||[]).filter(w=>w.length>2&&!ignored.has(w)).map(w=>w.slice(0,7)))];
function score(text,query){const terms=new Set(words(query));return words(text).reduce((n,w)=>n+(terms.has(w)?1:0),0);}
function excerpt(text,query,length=500){text=String(text||'');const lower=text.toLowerCase();const hits=words(query).map(w=>lower.indexOf(w)).filter(n=>n>=0);const start=hits.length?Math.max(0,Math.min(...hits)-100):0;return {text:text.slice(start,start+length),offset:start,complete:start===0&&text.length<=length};}
function fit(items,budget){const result=[];let size=2;for(const item of items){const length=bytes(item)+1;if(size+length>budget)continue;result.push(item);size+=length;}return result;}
export function createConversationMemory(conversation,sourceCatalog){
 const messages=conversation.map((message,index)=>({...message,id:`H${index+1}`,position:index}));
 const sources=sourceCatalog.map((source,index)=>({...source,position:index}));
 const card=(source,query)=>({id:source.id,sectionID:source.sectionID,title:source.title,codeVersion:source.codeVersion,
  ...(source.url?{url:source.url,kind:'historical_web_reference'}:{}),summary:excerpt(source.searchText||source.summary,query,240).text,priorQuestion:source.priorQuestion});
 const rankMessages=(query,primary=query)=>messages.map(m=>({m,weight:score(m.content,primary)*4+score(m.content,query)+(m.role==='user'&&/\b(?:correct|confirm|actually|changed|instead|no longer)\b/i.test(m.content)?1:0)})).filter(x=>x.weight>0).sort((a,b)=>b.weight-a.weight||b.m.position-a.m.position).map(x=>x.m);
 const rankSources=(query,primary=query)=>sources.map(s=>({s,weight:score(`${s.title} ${s.priorQuestion} ${s.searchText||s.summary}`,primary)*4+score(`${s.title} ${s.priorQuestion} ${s.searchText||s.summary}`,query)})).filter(x=>x.weight>0).sort((a,b)=>b.weight-a.weight||b.s.position-a.s.position).map(x=>x.s);
 return {
  totals:{messages:messages.length,sources:sources.length},
  context(question,scale=1){
   const query=[question,...messages.slice(-2).map(m=>m.content.slice(0,1000))].join(' ');
   const ordered=[],added=new Set();const add=m=>{if(m&&!added.has(m.id)){added.add(m.id);ordered.push(m);}};
   // Prioritize the live subject; relevance search can reach any older turn.
   messages.slice(-6).reverse().forEach(add);
   if(/\b(?:first|earliest|beginning|started|originally)\b/i.test(question))messages.slice(0,4).forEach(add);
   for(const m of rankMessages(query,question)){add(m);if(m.role==='user')add(messages[m.position+1]);else add(messages[m.position-1]);}
   const selected=fit(ordered,Math.floor(30000*scale)).sort((a,b)=>a.position-b.position);
   const sourceWindow=fit(rankSources(query,question).map(s=>card(s,question)),Math.floor(14000*scale));
   return {conversation:selected.map(({id,position,...m})=>m),priorEvidence:sourceWindow,
    archive:{...this.totals,workingMessages:selected.length,workingSources:sourceWindow.length,
     notice:'Complete earlier messages and sources remain saved. Search/read the conversation archive to resolve earlier facts, corrections or source references; this working window is not the entire chat.'}};
  },
  search(query,offset=0){
   if(typeof query!=='string'||!query.trim()||query.length>1500||!Number.isSafeInteger(offset)||offset<0)throw new Error('Use a concise conversation search query.');
   let ranked=rankMessages(query);
   if(/\b(?:first|earliest|beginning|started|originally)\b/i.test(query))ranked=[...messages.slice(0,4),...ranked.filter(m=>m.position>3)];
   const matchedSources=rankSources(query);
   return {totals:this.totals,offset,nextOffset:offset+12<Math.max(ranked.length,matchedSources.length)?offset+12:null,matchingMessages:ranked.length,matchingSources:matchedSources.length,messages:ranked.slice(offset,offset+12).map(m=>({id:m.id,role:m.role,...excerpt(m.content,query,700)})),
    sourceCandidates:matchedSources.slice(offset,offset+12).map(s=>card(s,query)),
    notice:'Message excerpts are conversation history, not verified legal authority. Read source IDs to reload evidence before citing it.'};
  },
  read(messageIDs,offset=0){
   if(!Array.isArray(messageIDs)||messageIDs.length>8||!Number.isSafeInteger(offset)||offset<0)throw new Error('Read up to eight conversation message IDs at a time, with a nonnegative offset.');
   return messageIDs.map(id=>{const m=messages.find(m=>m.id===id);if(!m)return {id,unavailable:true};const text=m.content.slice(offset,offset+12000);return {id,role:m.role,text,offset,complete:offset===0&&text.length===m.content.length,nextOffset:offset+text.length<m.content.length?offset+text.length:null};});
  }
 };
}
export function isAssistantContextError(error){return error?.providerStatus===413||/context_length_exceeded|context_window_exceeded|context_limit_exceeded|max_context_length|too_many_tokens|request_too_large|payload_too_large|input_too_large/.test([error?.providerCause,error?.code,error?.cause?.code].join(' '));}
export function smallerAssistantRequest(body,scale=1){
 const pack=data=>{
  const result={...data};
  if(result.earlierConversation){const ranked=result.earlierConversation.map((m,index)=>({m,index,weight:score(m.content,result.currentQuestion||result.question)})).sort((a,b)=>b.weight-a.weight||b.index-a.index);result.earlierConversation=fit(ranked,Math.floor(8000*scale)).sort((a,b)=>a.index-b.index).map(x=>x.m);}
  if(result.priorEvidence)result.priorEvidence=fit(result.priorEvidence,Math.floor(7000*scale));
  if(result.libraryGuide)result.libraryGuide=result.libraryGuide.map(({id,title,code,chapter})=>({id,title,code,chapter}));
  const deferred=[];
  for(const key of ['attachedPassages','earlierEvidence','readEvidence'])if(Array.isArray(result[key])){
   const kept=fit(result[key].slice().reverse(),Math.floor(24000*scale)).reverse();
   deferred.push(...result[key].filter(s=>!kept.includes(s)).map(({id,title,sectionID})=>({id,title,sectionID})));
   result[key]=kept;
  }
  if(deferred.length)result.availableEvidence=deferred;
  result.recoveryNotice='The model request was compacted automatically. Full history and sources remain available through conversation and library tools; reopen deferred evidence when needed. Do not infer legal requirements from a title or a historical answer.';
  return result;
 };
 if(typeof body.input==='string'){try{return {...body,input:JSON.stringify(pack(JSON.parse(body.input)))};}catch{return body;}}
 if(!Array.isArray(body.input))return body;
 const first=body.input.find(e=>e.role==='user'),last=body.input.findLast(e=>e.role==='user');
 if(!first)return body;
 try{return {...body,input:[{role:'user',content:JSON.stringify(pack(JSON.parse(first.content)))},...(last&&last!==first?[last]:[])]};}catch{return body;}
}
export async function callWithAssistantContextRecovery(call,body,options,state={}){
 try{return await call(state.level?smallerAssistantRequest(body,2**(-state.level)):body,options);}catch(error){
  if(!isAssistantContextError(error))throw error;
  state.level=(state.level||0)+1;
  try{return await call(smallerAssistantRequest(body,2**(-state.level)),options);}catch(retry){
   if(!isAssistantContextError(retry))throw retry;
   throw Object.assign(new Error("The Assistant couldn't fit the material needed for this answer after reducing the request. Your complete conversation and sources are saved. Retry this question; you don't need to start a new chat."),{code:'ASSISTANT_CONTEXT_CAPACITY',cause:retry});
  }
 }
}
