import { createDefinitionMatcher, inlineDefinitionHeading } from './definition-matcher.js?v=20260917-definitions-v79';

const excluded = 'a,button,input,textarea,select,script,style,h1,h2,h3,h4,h5,h6,[contenteditable], [data-research-selection-exclude],.inline-comment-box';
let activeClose = null;
const matchers = new WeakMap();
const editionLabels = {
  'new-york-state-public-service-law': 'New York State',
  '2014-construction-codes': '2014 edition',
  '2022-construction-codes': '2022 edition',
  '2025-specialty-codes': '2025 edition',
  '2026-enacted-administrative-code': 'Enacted collection',
  '2026-existing-building-code': '2026 enacted edition',
  '2026-zoning-resolution': 'Zoning Resolution',
};

export function openDefinitionPopover(trigger, entries) {
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
  const controls = document.createElement('div');
  controls.className = 'reader-definition-controls';
  controls.append(closeButton); popup.append(controls);
  for (const entry of entries) {
    const article=document.createElement('article');
    const title=document.createElement('h3'); title.textContent=entry.source?.term || entry.term;
    const body=document.createElement('p'); body.className='reader-definition-text'; body.textContent=entry.text;
    const source=document.createElement('p'); source.className='reader-definition-source';
    source.textContent=[entry.source?.code, entry.source?.publication, editionLabels[entry.source?.bundle] || entry.source?.bundle, entry.source?.sectionNumber ? `§ ${entry.source.sectionNumber}` : entry.source?.chapter ? `Chapter ${entry.source.chapter}` : ''].filter(Boolean).join(' · ');
    article.append(title,body,source);
    if (entry.resolution === 'unresolved-reference' || entry.resolution === 'ambiguous-reference' || entry.resolution === 'multiple-definitions') {
      const status=document.createElement('p'); status.className='reader-definition-reference-state';
      status.textContent=entry.resolution === 'multiple-definitions' ? 'This term refers to several definitions. Check each source for applicability.' : entry.resolution === 'ambiguous-reference' ? 'This reference has more than one possible definition.' : 'This entry refers to another section. Its definition has not yet been resolved.';
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
export function installDefinitionLinks(root, entries, context = {}) {
  const document=root.ownerDocument;
  let scoped=matchers.get(entries);
  if(!scoped){scoped=new Map();matchers.set(entries,scoped);}
  const section=String(context.sectionNumber || '');
  let matcher=scoped.get(section);
  if(!matcher){matcher=createDefinitionMatcher(entries,context);scoped.set(section,matcher);}
  const walker=document.createTreeWalker(root,5);
  const nodes=[];
  let text='', fullText='', node;
  while((node=walker.nextNode())) {
    if(node.nodeType===1){if(node.tagName==='BR'){text+='\n';fullText+='\n';}continue;}
    fullText+=node.data;
    if(node.parentElement.closest(excluded)) {text+='\u0000'.repeat(node.data.length);continue;}
    nodes.push({node,start:text.length,end:text.length+node.data.length});text+=node.data;
  }
  const definitionStart=fullText.search(inlineDefinitionHeading);
  const matches=matcher(text,fullText)
    .filter(match=>!match.text.includes('\u0000') && (definitionStart<0||match.end<=definitionStart))
    .map(match=>{
      // Eligibility follows enacted markup, never computed or generated styling.
      // Whitespace may separate italic wrappers; every non-whitespace character
      // of the term must still belong to an authored em/i ancestor.
      const authoredItalic=!match.entries.some(entry=>entry.requiresItalic) || nodes.filter(item=>item.start<match.end&&item.end>match.start).every(item=>{
        const part=item.node.data.slice(Math.max(0,match.start-item.start),Math.min(item.node.data.length,match.end-item.start));
        return !part.trim() || Boolean(item.node.parentElement.closest('em,i'));
      });
      return {...match,entries:match.entries.filter(entry=>!entry.requiresItalic||authoredItalic)};
    }).filter(match=>match.entries.length);
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
      // Reader panels can be decorated inside an inert template document before
      // mounting. Resolve selection from the button's current adopted document.
      if(!button.ownerDocument.getSelection()?.isCollapsed)return;
      openDefinitionPopover(button,match.entries);
    });
  }
  return matches.length;
}
