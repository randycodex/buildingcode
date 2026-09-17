// Exact defined-term matching. Inflections and aliases must be supplied by the
// source index; do not silently turn a related word into a legal definition.
const word = /[\p{L}\p{N}_]/u;
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const inlineDefinitionHeading = /\*{0,2}§\s*(?:\d{2}-)?[A-Z]?\d+(?:\.\d+)*\s+Definitions\./i;

export function createDefinitionMatcher(entries, {sectionNumber} = {}) {
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
export function definitionAppliesToSection(entry, sectionNumber) {
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
