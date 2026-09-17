import {parse} from 'parse5';
import {inlineDefinitionHeading} from '../public/definition-matcher.js';

// Mirror the Reader's definition-section boundary while retaining other prose
// from combined chapter files. Never exclude an entire file just because it
// also contains a definition source.
export function definitionAuditProse(html) {
  const excluded = new Set(['script', 'style', 'head', 'annotationdrawer', 'codeoptions']);
  let inDefinitions = false;
  const text = node => node.tagName === 'br' ? '\n' : node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join('');
  function walk(node) {
    if (excluded.has(node.tagName)) return '';
    if (node.tagName === 'br') return '\n';
    if (['p','li'].includes(node.tagName)) {
      const value=text(node);
      const boundary=value.search(inlineDefinitionHeading);
      if(boundary>=0)return inDefinitions ? '' : value.slice(0,boundary);
    }
    if (/^h[1-6]$/.test(node.tagName || '')) {
      inDefinitions = /\bdefinitions[.:]?\s*$/i.test(text(node).trim());
      return '\n';
    }
    if (node.nodeName === '#text') return inDefinitions ? '' : node.value;
    return (node.childNodes || []).map(walk).join(['p', 'li', 'td', 'th', 'div', 'section'].includes(node.tagName) ? '\n' : '');
  }
  return walk(parse(html));
}

// Used when a chapter contains section-limited meanings. Keep passage scope
// while excluding definition headings and their body, as the Reader does.
export function definitionAuditScopedPassages(html) {
  const passages=[];
  let sectionNumber, inDefinitions=false;
  const text=node=>node.tagName==='br'?'\n':node.nodeName==='#text'?node.value:(node.childNodes||[]).map(text).join('');
  function append(value) {
    if(inDefinitions||!value)return;
    const previous=passages.at(-1);
    if(previous&&previous.sectionNumber===sectionNumber)previous.text+=value;
    else passages.push({sectionNumber,text:value});
  }
  function walk(node) {
    if(['script','style','head','annotationdrawer','codeoptions'].includes(node.tagName))return;
    if(node.tagName==='br'){append('\n');return;}
    if(/^h[1-6]$/.test(node.tagName||'')) {
      const heading=text(node).trim();
      sectionNumber=heading.match(/^(?:§\s*|Section\s+)?(?:[A-Z]+\s+)?((?:\d{2}-)?[A-Z]?\d+(?:\.\d+)*)\b/i)?.[1];
      inDefinitions=/\bdefinitions[.:]?\s*$/i.test(heading);
      return;
    }
    if(['p','li'].includes(node.tagName)) {
      const value=text(node), boundary=value.search(inlineDefinitionHeading);
      if(boundary>=0){append(value.slice(0,boundary));return;}
    }
    if(node.nodeName==='#text'){append(node.value);return;}
    for(const child of node.childNodes||[])walk(child);
    if(['p','li','td','th','div','section'].includes(node.tagName))append('\n');
  }
  walk(parse(html));
  return passages;
}
