// Generated from the shared web definition components.
(()=>{
// Exact defined-term matching. Inflections and aliases must be supplied by the
// source index; do not silently turn a related word into a legal definition.
const word = /[\p{L}\p{N}_]/u;
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function createDefinitionMatcher(entries) {
  const byLabel = new Map();
  for (const entry of entries) {
    for (const label of [entry.term, ...(entry.aliases || [])]) {
      const key = String(label || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
      if (!key) continue;
      const list = byLabel.get(key) || [];
      if (!list.some(item => item === entry || (entry.id && item.id === entry.id))) list.push(entry);
      byLabel.set(key, list);
    }
  }
  const labels = [...byLabel.keys()].sort((a,b) => b.length - a.length);
  if (!labels.length) return () => [];
  const alternatives = labels.map(label => escape(label).replace(/\s+/g, '\\s+')).join('|');
  const expression = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${alternatives})(?![\\p{L}\\p{N}_])`, 'giu');
  return text => {
    const matches = [];
    expression.lastIndex = 0;
    for (const match of String(text).matchAll(expression)) {
      const start = match.index;
      const end = start + match[0].length;
      const before = Array.from(text.slice(Math.max(0,start-2),start)).at(-1) || '';
      const after = Array.from(text.slice(end,end+2))[0] || '';
      if (word.test(before) || word.test(after)) continue;
      const key = match[0].replace(/\s+/g,' ').toLocaleLowerCase('en-US');
      matches.push({start,end,text:match[0],entries:byLabel.get(key)});
    }
    return matches;
  };
}


const excluded = 'a,button,input,textarea,select,script,style,h1,h2,h3,h4,h5,h6,[contenteditable], [data-research-selection-exclude],.inline-comment-box';
let activeClose = null;
const matchers = new WeakMap();
const editionLabels = {
  '2014-construction-codes': '2014 edition',
  '2022-construction-codes': '2022 edition',
  '2025-specialty-codes': '2025 edition',
  '2026-enacted-administrative-code': 'Enacted collection',
  '2026-existing-building-code': '2026 enacted edition',
  '2026-zoning-resolution': 'Zoning Resolution',
};

function openDefinitionPopover(trigger, entries) {
  activeClose?.();
  const document = trigger.ownerDocument;
  const popup = document.createElement('section');
  popup.className = 'reader-definition-popover';
  popup.setAttribute('role','dialog');
  popup.setAttribute('aria-label',`Definition of ${trigger.textContent}`);
  popup.setAttribute('popover','auto');
  const closeButton = document.createElement('button');
  closeButton.type='button'; closeButton.className='reader-definition-close';
  closeButton.textContent='Close'; closeButton.setAttribute('aria-label','Close definition');
  popup.append(closeButton);
  for (const entry of entries) {
    const article=document.createElement('article');
    const title=document.createElement('h3'); title.textContent=entry.term;
    const body=document.createElement('p'); body.className='reader-definition-text'; body.textContent=entry.text;
    const source=document.createElement('p'); source.className='reader-definition-source';
    source.textContent=[entry.source?.code, editionLabels[entry.source?.bundle] || entry.source?.bundle, entry.source?.sectionNumber ? `§ ${entry.source.sectionNumber}` : entry.source?.chapter ? `Chapter ${entry.source.chapter}` : ''].filter(Boolean).join(' · ');
    article.append(title,body,source);
    if (entry.resolution === 'unresolved-reference' || entry.resolution === 'ambiguous-reference') {
      const status=document.createElement('p'); status.className='reader-definition-reference-state';
      status.textContent=entry.resolution === 'ambiguous-reference' ? 'This reference has more than one possible definition.' : 'This entry refers to another section. Its definition has not yet been resolved.';
      article.append(status);
    }
    popup.append(article);
  }
  document.body.append(popup);
  trigger.setAttribute('aria-expanded','true');
  const controller=new AbortController();
  const options={signal:controller.signal};
  let closed=false;
  const close=()=>{
    if(closed)return; closed=true;
    controller.abort(); observer.disconnect(); popup.remove();
    trigger.setAttribute('aria-expanded','false');
    if(trigger.isConnected)trigger.focus({preventScroll:true});
    if(activeClose===close)activeClose=null;
  };
  const observer=new MutationObserver(()=>{if(!trigger.isConnected)close();});
  observer.observe(document.body,{childList:true,subtree:true});
  activeClose=close;
  closeButton.addEventListener('click',close,options);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}},options);
  document.addEventListener('pointerdown',event=>{if(!popup.contains(event.target)&&!trigger.contains(event.target))close();},options);
  popup.addEventListener('toggle',event=>{if(event.newState==='closed')close();},options);
  const view=document.defaultView;
  const rect=trigger.getBoundingClientRect();
  const width=Math.min(380,view.innerWidth-24);
  popup.style.width=`${width}px`;
  popup.style.left=`${Math.max(12,Math.min(rect.left,view.innerWidth-width-12))}px`;
  popup.style.top=`${Math.min(rect.bottom+8,view.innerHeight-100)}px`;
  popup.showPopover?.();
  const height=popup.getBoundingClientRect().height;
  if(rect.bottom+8+height>view.innerHeight-12)popup.style.top=`${Math.max(12,rect.top-height-8)}px`;
  closeButton.focus({preventScroll:true});
  return close;
}

// Link within one prose block, including terms split by inline emphasis. Existing
// links, controls and excluded UI form boundaries and are never rewritten.
function installDefinitionLinks(root, entries) {
  const document=root.ownerDocument;
  let matcher=matchers.get(entries);
  if(!matcher){matcher=createDefinitionMatcher(entries);matchers.set(entries,matcher);}
  const walker=document.createTreeWalker(root,4);
  const nodes=[];
  let text='', node;
  while((node=walker.nextNode())) {
    if(node.parentElement.closest(excluded)) {text+='\u0000';continue;}
    nodes.push({node,start:text.length,end:text.length+node.data.length});text+=node.data;
  }
  const matches=matcher(text).filter(match=>!match.text.includes('\u0000'));
  for(const match of matches.reverse()) {
    const first=nodes.find(item=>item.start<=match.start&&item.end>match.start);
    const last=nodes.find(item=>item.start<match.end&&item.end>=match.end);
    if(!first||!last)continue;
    const range=document.createRange();
    range.setStart(first.node,match.start-first.start);range.setEnd(last.node,match.end-last.start);
    const button=document.createElement('button');button.type='button';button.className='reader-definition-term';
    button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');
    button.append(range.extractContents());range.insertNode(button);
    button.addEventListener('click',event=>{
      event.stopPropagation();
      if(!document.getSelection()?.isCollapsed)return;
      openDefinitionPopover(button,match.entries);
    });
  }
  return matches.length;
}

window.permitextInstallDefinitions=(entries,isDark)=>{
 const style=document.createElement('style');style.textContent=".reader-definition-term {\n  display: inline; padding: 0; margin: 0; border: 0; border-radius: 0;\n  background: transparent; color: inherit; font: inherit; line-height: inherit;\n  text-align: inherit; cursor: pointer; text-decoration: underline dotted;\n  text-underline-offset: .2em; text-decoration-color: currentColor;\n}\n.reader-definition-term:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }\n.reader-definition-popover {\n  position: fixed; inset: auto; margin: 0; box-sizing: border-box;\n  max-height: min(420px, calc(100vh - 24px)); overflow-y: auto;\n  padding: 18px; border: 1px solid #555; border-radius: 12px;\n  background: #151719; color: #f3f3f3; box-shadow: 0 8px 32px #0006;\n  font: 14px/1.5 system-ui, sans-serif; z-index: 10000;\n}\n.reader-definition-popover h3 { margin: 8px 0; font-size: 14px; }\n.reader-definition-popover article + article { border-top: 1px solid #555; margin-top: 16px; padding-top: 8px; }\n.reader-definition-text { white-space: pre-line; margin: 8px 0; }\n.reader-definition-source, .reader-definition-reference-state { color: #bfc2c6; font-size: 12px; overflow-wrap: anywhere; }\n.reader-definition-close { display: block; margin-left: auto; padding: 4px 8px; color: inherit; background: #303336; border: 0; border-radius: 6px; cursor: pointer; }\n"+(isDark?'':'.reader-definition-popover{background:#fff;color:#111;border-color:#ccc}.reader-definition-source,.reader-definition-reference-state{color:#555}.reader-definition-close{background:#eee}');document.head.append(style);
 const blocks=[...document.querySelectorAll('p,li,td,th,.rbox > div')].filter(node=>!node.querySelector('p,li,td,th,.rbox > div'));
 for(const block of blocks)installDefinitionLinks(block,entries);
};
})();
