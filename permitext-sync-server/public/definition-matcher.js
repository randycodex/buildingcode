// Exact defined-term matching. Inflections and aliases must be supplied by the
// source index; do not silently turn a related word into a legal definition.
const word = /[\p{L}\p{N}_]/u;
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function createDefinitionMatcher(entries) {
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
