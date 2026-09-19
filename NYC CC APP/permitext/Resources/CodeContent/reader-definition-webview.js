// Generated from the shared web definition components.
(()=>{
// Exact defined-term matching. Inflections and aliases must be supplied by the
// source index; do not silently turn a related word into a legal definition.
const word = /[\p{L}\p{N}_]/u;
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const inlineDefinitionHeading = /\*{0,2}§\s*(?:\d{2}-)?[A-Z]?\d+(?:\.\d+)*\s+Definitions\./i;

function createDefinitionMatcher(entries, {sectionNumber} = {}) {
  const section = String(sectionNumber || '').trim().toUpperCase();
  const exclusions = new Map(entries.filter(entry=>entry.excludedOccurrences?.length).map(entry => [entry, (entry.excludedOccurrences || [])
    .filter(rule => section && (section === rule.section.toUpperCase() || section.startsWith(rule.section.toUpperCase() + '.')))
    .flatMap(rule => rule.phrases.map(phrase => ({occurrence:phrase.occurrence, expression:new RegExp(`(?<![\\p{L}\\p{N}_])${phrase.text.trim().split(/\s+/).map(escape).join('\\s+')}(?![\\p{L}\\p{N}_])`, 'giu')})))]));
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
  return (text, contextText = text) => {
    const matches = [];
    if (/^(?:[^.!?\n]{1,120}\.\s*)?The term [“"][^”"]+[”"] (?:shall )?means?\b/i.test(String(text).trim())) return matches;
    const definitionStart=String(text).search(inlineDefinitionHeading);
    expression.lastIndex = 0;
    const candidates=[...String(text).matchAll(expression)];
    expression.lastIndex=0;
    const contextCandidates=exclusions.size ? [...String(contextText).matchAll(expression)] : [];
    const excludedRanges=new Map([...exclusions].filter(([,rules])=>rules.length).map(([entry,rules])=>[entry,new Set(rules.flatMap(rule=>{
      rule.expression.lastIndex=0;
      return [...String(contextText).matchAll(rule.expression)].flatMap(context=>{
        const terms=contextCandidates.filter(candidate=>candidate.index>=context.index && candidate.index+candidate[0].length<=context.index+context[0].length && byLabel.get(candidate[0].replace(/\s+/g,' ').toLocaleLowerCase('en-US'))?.includes(entry));
        const target=Number.isInteger(rule.occurrence)&&rule.occurrence>=0?terms[rule.occurrence]:null;
        return target?[target.index]:[];
      });
    }))]));
    for (const match of candidates) {
      const start = match.index;
      if(definitionStart>=0 && start>=definitionStart)continue;
      const end = start + match[0].length;
      const before = Array.from(text.slice(Math.max(0,start-2),start)).at(-1) || '';
      const after = Array.from(text.slice(end,end+2))[0] || '';
      if (word.test(before) || word.test(after)) continue;
      const key = match[0].replace(/\s+/g,' ').toLocaleLowerCase('en-US');
      const applicable = byLabel.get(key).filter(entry => !excludedRanges.get(entry)?.has(start));
      if(applicable.length) matches.push({start,end,text:match[0],entries:applicable});
    }
    return matches;
  };
}

// Prefix scopes include numbered descendants; exact scopes include only that identity.
// Positive scopes form a union, and exclusions always take precedence.
// Unknown section identity cannot establish that a restricted meaning applies.
function definitionAppliesToSection(entry, sectionNumber) {
  if (!entry.applicableSections && !entry.applicableExactSections && !entry.excludedSections && !entry.excludedExactSections) return true;
  const section = String(sectionNumber || '').trim().toUpperCase();
  if (!section) return false;
  const matches = value => {
    const scope = String(value).trim().toUpperCase();
    return Boolean(scope) && (section === scope || section.startsWith(scope + '.'));
  };
  const exact = value => String(value).trim().toUpperCase() === section;
  const unrestricted = !entry.applicableSections && !entry.applicableExactSections;
  return (unrestricted || (entry.applicableSections || []).some(matches) || (entry.applicableExactSections || []).some(exact))
    && !(entry.excludedSections || []).some(matches)
    && !(entry.excludedExactSections || []).some(value => String(value).trim().toUpperCase() === section);
}


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
function installDefinitionLinks(root, entries, context = {}) {
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

window.permitextInstallDefinitions=(entries,isDark)=>{
 const style=document.createElement('style');style.textContent=".reader-definition-term {\n  display: inline; padding: 0; margin: 0; border: 0; border-radius: 0;\n  background: transparent !important; color: #8e8e93 !important; font: inherit; line-height: inherit;\n  text-align: inherit; cursor: pointer; text-decoration: none !important;\n}\n.reader-definition-term:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }\n.reader-definition-popover {\n  position: fixed; inset: auto; margin: 0; box-sizing: border-box;\n  max-height: min(420px, calc(100vh - 24px)); overflow-y: auto;\n  padding: 18px; border: 1px solid #555; border-radius: 12px;\n  background: #151719; color: #f3f3f3; box-shadow: 0 8px 32px #0006;\n  font: 14px/1.5 system-ui, sans-serif; z-index: 10000;\n}\n.reader-definition-popover h3 { margin: 8px 0; font-size: 14px; }\n.reader-definition-popover article + article { border-top: 1px solid #555; margin-top: 16px; padding-top: 8px; }\n.reader-definition-text { white-space: pre-line; margin: 8px 0; }\n.reader-definition-source, .reader-definition-reference-state { color: #bfc2c6; font-size: 12px; overflow-wrap: anywhere; }\n.reader-definition-close { display: block; margin-left: auto; padding: 4px 8px; color: inherit; background: #303336; border: 0; border-radius: 6px; cursor: pointer; }\n\n.reader-definition-controls { position: sticky; top: -18px; z-index: 1; background: inherit; margin-top: -18px; padding: 18px 0 8px; }\n"+(isDark?'':'.reader-definition-term{color:#6e6e73 !important}.reader-definition-popover{background:#fff;color:#111;border-color:#ccc}.reader-definition-source,.reader-definition-reference-state{color:#555}.reader-definition-close{background:#eee}');document.head.append(style);
 const blocks=[...document.querySelectorAll('p,li,td,th,.rbox > div')].filter(node=>!node.querySelector('p,li,td,th,.rbox > div'));
 const headings=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
 for(const block of blocks){
  const heading=headings.filter(h=>Boolean(h.compareDocumentPosition(block)&Node.DOCUMENT_POSITION_FOLLOWING)).at(-1);
  if(heading&&/\bdefinitions[.:]?\s*$/i.test(heading.textContent))continue;
  const sectionNumber=heading?.textContent.trim().match(/^(?:§\s*|Section\s+)?(?:[A-Z]+\s+)?((?:\d{2}-)?[A-Z]?\d+(?:\.\d+)*)\b/i)?.[1];
  installDefinitionLinks(block,entries.filter(entry=>definitionAppliesToSection(entry,sectionNumber)),{sectionNumber});
 }
};
})();
