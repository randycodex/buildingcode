// Report-owned display annotations. Anchor text never replaces canonical text.
export const sourceTextStyles = ['bold','italic','underline','strike','highlight'];
export function mergeFormattingRanges(ranges) {
  const result = [];
  for (const range of [...ranges].sort((a,b)=>a[0]-b[0] || a[1]-b[1])) {
    if (result.length && range[0] <= result.at(-1)[1]) result.at(-1)[1] = Math.max(result.at(-1)[1],range[1]);
    else result.push([...range]);
  }
  return result;
}
export function normalizeSourceFormatting(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 200) throw new Error('Invalid Report source formatting.');
  const parts = new Map(); let characters = 0, count = 0;
  for (const part of value) {
    if (!part || typeof part.key !== 'string' || !part.key || part.key.length > 512 ||
      typeof part.text !== 'string' || !part.text || part.text.length > 350000) throw new Error('Invalid Report formatting anchor.');
    const key = JSON.stringify([part.key,part.text]);
    if (!parts.has(key)) {characters += part.text.length; parts.set(key,{key:part.key,text:part.text,formats:{}});}
    const formats = part.formats || {};
    if (!formats || typeof formats !== 'object' || Array.isArray(formats)) throw new Error('Invalid Report source styles.');
    for (const [style,ranges] of Object.entries(formats)) {
      if (!sourceTextStyles.includes(style) || !Array.isArray(ranges)) throw new Error('Invalid Report source style.');
      count += ranges.length;
      if (characters > 500000 || count > 1000) throw new Error('Too much Report source formatting.');
      for (const range of ranges) {
        if (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isSafeInteger) ||
          range[0] < 0 || range[1] <= range[0] || range[1] > part.text.length) throw new Error('Invalid Report formatting range.');
      }
      const target = parts.get(key).formats;
      const merged = mergeFormattingRanges([...(target[style] || []),...ranges]);
      if (merged.length) target[style] = merged;
    }
  }
  if (characters > 500000) throw new Error('Too much Report source formatting.');
  return [...parts.values()].filter(part=>Object.keys(part.formats).length);
}
export function sourceFormattingRanges(part, formatting = [], style = 'highlight') {
  const ranges = [];
  for (const anchor of formatting) {
    const marks = anchor.formats?.[style] || [];
    if (anchor.key === part.key && anchor.text === part.text) ranges.push(...marks);
    // Covered saved paragraphs retain their styles in the whole-section export.
    // Rebase only when the entire anchored text occurs exactly once.
    else if (part.key.startsWith('evidence:text:') && anchor.key.startsWith('evidence:text:')) {
      const offset = part.text.indexOf(anchor.text);
      if (offset >= 0 && part.text.indexOf(anchor.text,offset+1) < 0) ranges.push(...marks.map(([a,b])=>[a+offset,b+offset]));
    }
  }
  return mergeFormattingRanges(ranges);
}
export function sourceFormattingRuns(part, formatting = []) {
  const styles = new Map(sourceTextStyles.map(style=>[style,sourceFormattingRanges(part,formatting,style)]));
  const boundaries = [...new Set([0,part.text.length,...[...styles.values()].flat(2)])].sort((a,b)=>a-b);
  return boundaries.slice(0,-1).map((start,index)=>{
    const end = boundaries[index+1], run = {text:part.text.slice(start,end)};
    for (const [style,ranges] of styles) if (ranges.some(([a,b])=>a<=start && b>=end)) run[style] = true;
    return run;
  }).filter(run=>run.text);
}
export function updateSourceFormatting(formatting,part,selection,style,remove=false) {
  if (!sourceTextStyles.includes(style)) throw new Error('Invalid Report source style.');
  const formats = {};
  for (const name of sourceTextStyles) {
    let ranges = sourceFormattingRanges(part,formatting,name);
    if (name === style) ranges = remove ? ranges.flatMap(([a,b])=>b<=selection[0] || a>=selection[1] ? [[a,b]] :
      [[a,Math.min(b,selection[0])],[Math.max(a,selection[1]),b]].filter(([x,y])=>y>x)) : mergeFormattingRanges([...ranges,selection]);
    if (ranges.length) formats[name] = ranges;
  }
  return normalizeSourceFormatting([...formatting.filter(anchor=>anchor.key !== part.key),{key:part.key,text:part.text,formats}]);
}
export function createReportSourceFormatting({onChange,isCurrent}) {
  const parts = new Set(); let selected = [], stopped = false;
  const available = entry => !stopped && isCurrent() && entry.element.isConnected && entry.element.getClientRects().length>0 && entry.element.textContent===entry.part.text;
  const paint = entry => {
    entry.element.replaceChildren(...sourceFormattingRuns(entry.part,entry.block.sourceFormatting).map(run=>{
      let node = document.createTextNode(run.text);
      for (const [style,tag] of [['bold','strong'],['italic','em'],['underline','u'],['strike','s'],['highlight','mark']]) {
        if (run[style]) {const wrapper=document.createElement(tag); wrapper.append(node); node=wrapper;}
      }
      return node;
    }));
  };
  const capture = () => {
    selected=[]; const selection=window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed || !isCurrent()) return;
    const range=selection.getRangeAt(0);
    if (![...parts].some(entry=>entry.element.contains(range.startContainer)) || ![...parts].some(entry=>entry.element.contains(range.endContainer))) return;
    for (const entry of parts) {
      if (!available(entry) || !range.intersectsNode(entry.element)) continue;
      const prefix=document.createRange(); prefix.selectNodeContents(entry.element);
      let from=0,to=entry.part.text.length;
      if (entry.element.contains(range.startContainer)) {prefix.setEnd(range.startContainer,range.startOffset); from=prefix.toString().length;}
      if (entry.element.contains(range.endContainer)) {prefix.selectNodeContents(entry.element); prefix.setEnd(range.endContainer,range.endOffset); to=prefix.toString().length;}
      if (to>from) selected.push({entry,range:[from,to]});
    }
    selected.sort((a,b)=>a.entry.element.compareDocumentPosition(b.entry.element)&Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
  };
  const covered=(item,style)=>sourceFormattingRanges(item.entry.part,item.entry.block.sourceFormatting,style).some(([a,b])=>a<=item.range[0] && b>=item.range[1]);
  const textPoint=(element,offset)=>{
    const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT); let node;
    while ((node=walker.nextNode())) {if (offset<=node.length) return [node,offset]; offset-=node.length;}
    return [element,element.childNodes.length];
  };
  return {
    register(block,element,part) {
      const entry={block,element,part}; parts.add(entry); paint(entry);
      element.classList.add('report-highlight-target'); element.tabIndex=0;
      element.setAttribute('role','textbox'); element.setAttribute('aria-readonly','true');
      element.setAttribute('aria-label',part.label ? `${part.label} source text` : 'Report source text');
      element.addEventListener('keydown',event=>{
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase()==='a') {
          event.preventDefault(); const range=document.createRange(); range.selectNodeContents(element);
          const selection=window.getSelection(); selection.removeAllRanges(); selection.addRange(range); capture();
        }
      });
    },
    unregister(container) {for (const entry of parts) if (container.contains(entry.element)) parts.delete(entry); selected=selected.filter(item=>parts.has(item.entry));},
    capture,
    snapshotRuns:(block,text)=>sourceFormattingRuns([...parts].find(entry=>entry.block===block && entry.part.text===text)?.part || {key:`${block.kind}:text::0`,text},block.sourceFormatting),
    hasSelection:()=>selected.length>0 && selected.every(item=>available(item.entry)),
    isActive:style=>selected.length>0 && selected.every(item=>covered(item,style)),
    toggle(style) {
      if (!sourceTextStyles.includes(style) || !selected.length || !selected.every(item=>available(item.entry))) return;
      const saved=[...selected],remove=saved.every(item=>covered(item,style)),changed=new Map();
      for (const {entry,range} of saved) changed.set(entry.block,updateSourceFormatting(changed.get(entry.block) || entry.block.sourceFormatting || [],entry.part,range,style,remove));
      changed.forEach((value,block)=>{if (value.length) block.sourceFormatting=value; else delete block.sourceFormatting;});
      for (const entry of parts) if (changed.has(entry.block)) paint(entry);
      const first=saved[0],last=saved.at(-1),range=document.createRange();
      range.setStart(...textPoint(first.entry.element,first.range[0])); range.setEnd(...textPoint(last.entry.element,last.range[1]));
      const selection=window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      changed.forEach((_value,block)=>onChange(block)); capture();
    },
    dispose() {stopped=true; parts.clear(); selected=[];}
  };
}
