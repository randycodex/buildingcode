import { createHash } from 'node:crypto';
import { parse } from 'parse5';

export const definitionKey = value => String(value || '').normalize('NFKC')
  .replace(/[’‘]/g, "'").replace(/[‐‑‒–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
export const plainDefinitionText = value => String(value || '').replace(/\s+/g, ' ').trim();
const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value || '';
const classes = node => new Set(attr(node, 'class').split(/\s+/));
const nodeText = node => ['script', 'style', 'annotationdrawer', 'codeoptions'].includes(node.tagName) ? ''
  : node.tagName === 'br' ? '\n' : node.nodeName === '#text' ? node.value
    : (node.childNodes || []).map(nodeText).join(' ');
function walk(node, visit) { if (visit(node) === false) return; for (const child of node.childNodes || []) walk(child, visit); }
function sourceAnchor(node) {
  for (let current = node; current; current = current.parentNode) {
    const id = attr(current, 'id'); if (id) return id;
  }
  return '';
}

// Preserve paragraph boundaries for paragraph-based publications while also
// splitting PDF-imported paragraphs that contain multiple definition labels.
export function explicitDefinitionAliases(term) {
  const aliases=[];
  const acronym=term.match(/\(([A-Z]{2,12})\)$/)?.[1];
  if(acronym) {
    const words=term.slice(0,term.lastIndexOf('(')).match(/[A-Z]+/g) || [];
    const initials=words.map(word=>word[0]).join('');
    const significant=words.filter(word=>!['OF','THE','AND','OR','FOR','IN','TO','AT'].includes(word)).map(word=>word[0]).join('');
    if(acronym===initials||acronym===significant)aliases.push(acronym);
  }
  // Only single-word alternatives are unambiguous without grammatical inference.
  // "EXISTING BUILDING OR STRUCTURE" must not define ordinary "STRUCTURE".
  const alternatives=term.match(/^([A-Z]+) (?:OR|or) ([A-Z]+)$/);
  if(alternatives)aliases.push(alternatives[1],alternatives[2]);
  return [...new Set(aliases)];
}

export function splitDefinitionParagraph(value) {
  const raw = String(value || '').replace(/[^\S\n]+/g, ' ').trim();
  const label = /(?:^|\n|(?<=[.!?]) |(?<=[.!?][”"’']) )\s*\*?([A-Z0-9](?:[A-Z0-9 +,’'\/\-–—\n]|or(?= [A-Z]))*(?:\([^\n.]{1,80}\)(?:[A-Z0-9 +,’'\/\-–—\n]|or(?= [A-Z]))*)*(?:f\s*[’'′]\s*[a-z]|[a-z]\s*)?)\.[ \t]*(?=\S|\n|$)/g;
  const starts = [...raw.matchAll(label)].filter(match => (match[1].match(/[A-Z]/g) || []).length >= 2);
  return starts.map((match, i) => ({
    term: plainDefinitionText(match[1]),
    text: plainDefinitionText(raw.slice(match.index + match[0].length, starts[i + 1]?.index)),
    offset: match.index,
  }));
}

export function splitTitleCaseDefinitions(value) {
  const raw = String(value || '').replace(/[^\S\n]+/g, ' ').trim();
  const label = /(?:^|\n)\s*([A-Z][a-z]+(?: [A-Z][a-z]+)*(?: \([^\n.]+\))?)\.\s*/g;
  const starts = [...raw.matchAll(label)];
  return starts.map((match, i) => ({term: plainDefinitionText(match[1]),
    text: plainDefinitionText(raw.slice(match.index + match[0].length, starts[i + 1]?.index)), offset: match.index}));
}

export function extractDefinitionEntries(html, { definitionChapter = false, definitionSectionOnly = false, titleCaseLabels = false } = {}) {
  const document = parse(html);
  const records = [];
  walk(document, node => {
    if (classes(node).has('defined-term')) {
      const term = attr(node, 'id').replace(/^term-/, '');
      walk(node, child => {
        if (!classes(child).has('definition__definition')) return;
        const text = plainDefinitionText(nodeText(child));
        if (term && text) records.push({ type: 'term', term, text, anchor: attr(node, 'id'), sectionNumber: '12-10' });
        return false;
      });
      return false;
    }
    if (classes(node).has('rbox')) {
      let heading;
      walk(node, child => { if (/^h[1-6]$/.test(child.tagName || '')) heading = child; });
      const text = nodeText(heading || node);
      let hasBoldLabel = false;
      walk(node, child => { if (/font-weight:\s*bold/i.test(attr(child, 'style'))) hasBoldLabel = true; });
      const bareLabel = !heading && hasBoldLabel && /^[A-Z][A-Z0-9 +,’'()\/\-–— ]+$/.test(plainDefinitionText(text));
      records.push({ type: heading ? 'heading' : 'paragraph', text, bareLabel, anchor: sourceAnchor(node) });
      return false;
    }
    if (/^h[1-6]$/.test(node.tagName || '')) {
      records.push({ type: 'heading', text: nodeText(node), anchor: sourceAnchor(node) });
      return false;
    }
    if (['p', 'li'].includes(node.tagName)) {
      records.push({ type: 'paragraph', text: nodeText(node), anchor: sourceAnchor(node) });
      return false;
    }
  });
  const entries = [];
  let sectionNumber = '';
  let current = null;
  let listReference = '';
  let inDefinitionSection = false;
  for (const record of records) {
    if (record.type === 'term') { entries.push({ ...record, referenceOnly: false }); continue; }
    if (record.type === 'heading') {
      const heading = plainDefinitionText(record.text);
      inDefinitionSection = /definitions|defined terms/i.test(heading);
      const match = heading.match(/^(?:§\s*|Section\s+)?(?:[A-Z]+\s+)?((?:\d{2}-)?[A-Z]?\d+(?:\.\d+)*)\b/i);
      if (match) sectionNumber = match[1];
      if (definitionChapter && /terms not defined/i.test(heading)) sectionNumber = '';
      current = null;
      listReference = '';
      continue;
    }
    // Some imported historical HTML embeds the next section heading after a
    // line break inside the preceding section's paragraph.
    const inlineHeading = record.text.match(/(?:^|\n)\s*\*?§\s*((?:\d{2}-)?[A-Z]?\d+(?:\.\d+)*)\s+Definitions\./i);
    if (inlineHeading) {
      sectionNumber = inlineHeading[1];
      inDefinitionSection = true;
      current = null;
      listReference = '';
    }
    if (definitionSectionOnly && !inDefinitionSection) continue;
    const value = plainDefinitionText(record.text);
    const reference = value.match(/(?:The\s+)?(?:following terms|terms that follow).*?defined in ((?:Section|Chapter)\s+[^:]+):/i);
    if (reference) listReference = reference[0];
    const parts = record.bareLabel ? [{term: value, text: ''}]
      : titleCaseLabels ? splitTitleCaseDefinitions(record.text) : splitDefinitionParagraph(record.text);
    if (parts.length) {
      for (const part of parts) {
        // A bare all-caps list is a list of references, never a definition of
        // the next listed word. Retain an explicit reference when available.
        const body = part.text || listReference;
        if (body && !/[a-z]/.test(body)) { current = null; continue; }
        if (!definitionChapter && !sectionNumber) continue;
        const entry = { term: part.term, text: body, anchor: record.anchor,
          sectionNumber, referenceOnly: (!part.text && Boolean(listReference)) || /^See\b/i.test(body) };
        entries.push(entry);
        current = entry;
      }
    } else if (current && value && !reference) {
      current.text += `\n\n${value}`;
    }
  }
  return entries.filter(entry => entry.text.trim()).map(entry => ({ ...entry, text: entry.text.trim(), aliases: explicitDefinitionAliases(entry.term), key: definitionKey(entry.term) }));
}

// Reference resolution must never borrow a definition from another edition.
// Callers attach bundle/code identity when combining source chapters.
function sameDefinitionScope(term, entry, administrativeReference = false, appendix = null) {
  if (term.bundle !== entry.bundle) return false;
  if (administrativeReference) {
    if (!/^(?:GENERAL )?ADMINISTRATIVE (?:CODE|PROVISIONS)$/i.test(entry.code || '')) return false;
  } else if (term.code !== entry.code) return false;
  if (appendix ? entry.scope !== `appendix-${appendix}` : (term.scope || '') !== (entry.scope || '')) return false;
  return true;
}

export function resolveDefinitionReferences(terms, allEntries) {
  const byTerm = new Map();
  for (const entry of allEntries) {
    for (const key of new Set([entry.key, ...(entry.aliases || []).map(definitionKey)])) {
      if (!byTerm.has(key)) byTerm.set(key, []);
      byTerm.get(key).push(entry);
    }
  }
  function resolve(term, visited = new Set()) {
    if (visited.has(term) || visited.size >= 32) return { ...term, resolution: 'unresolved-reference' };
    const nextVisited = new Set(visited).add(term);
    if (!term.referenceOnly) return { ...term, resolution: 'direct' };
    const pairedSections = term.text.match(/^See Sections ([A-Z]?\d+(?:[.-]\d+)*) and ([A-Z]?\d+(?:[.-]\d+)*)\.$/i);
    const pairedCodes = term.text.match(/^See Section ([A-Z]?\d+(?:[.-]\d+)*) of this code and Section ((?:\d{2}-)?\d+(?:\.\d+)*) of the Administrative Code\.$/i);
    if (pairedSections || pairedCodes) {
      const pair = pairedSections || pairedCodes;
      const targets = [resolve({...term,text:`See Section ${pair[1]}.`},nextVisited),
        resolve({...term,text:`See Section ${pair[2]}${pairedCodes ? ' of the Administrative Code' : ''}.`},nextVisited)];
      if (targets.some(t=>t.resolution==='ambiguous-reference')) return {...term,resolution:'ambiguous-reference'};
      if (targets.some(t=>t.resolution!=='resolved-reference')) return {...term,resolution:'unresolved-reference'};
      if (new Set(targets.map(t=>definitionKey(t.definition.text))).size!==1) return {...term,resolution:'multiple-definitions',definitions:targets.map(t=>t.definition),referenceText:term.text};
      return {...term,resolution:'resolved-reference',definition:targets[1].definition,referenceText:term.text};
    }
    const quoted = term.text.match(/^See\s+(?:definition\s+for\s+)?[“"']([^”"']+)[”"']/i);
    const unquoted = term.text.split('\n')[0].match(/^See\s+(?!Sections?\b|Chapter\b|Appendix\b)([^.]+)\.?$/i);
    const targetKey = quoted || unquoted ? definitionKey((quoted || unquoted)[1].trim().replace(/\s+([,.])/g, '$1').replace(/\.$/, '')) : term.key;
    const section = term.text.match(/\b(?:See|defined in)\s+Section\s+((?:\d{2}-)?[A-Z]?\d+(?:\.\d+)*)/i)?.[1];
    const appendix = term.text.match(/^See Appendix ([A-Z])\.$/i)?.[1]?.toUpperCase();
    const chapter = term.text.match(/^See Chapter ([A-Z]?\d+)\b/i)?.[1];
    // Cross-code references remain explicit until the named source is mapped.
    const administrativeReference = /(?:of|in) the Administrative Code/i.test(term.text);
    const external = !administrativeReference && /(?:of|in) the .*(?:Code|Law)/i.test(term.text);
    let sourceCandidates = byTerm.get(targetKey) || [];
    const eligible = entry => entry !== term && sameDefinitionScope(term, entry, administrativeReference, appendix) && !external && (!chapter || String(entry.chapter)===chapter) && (!section ||
      entry.sectionNumber === section || String(entry.sectionNumber || '').startsWith(`${section}.`));
    if (section && !sourceCandidates.some(entry => eligible(entry) && !entry.referenceOnly)) {
      // A cited section may put the exact named child beneath a parent label.
      // Retain the complete parent body and its citation as context.
      const inverted = targetKey.includes(',') ? targetKey.split(',').map(s=>s.trim()).reverse().join(' ') : targetKey;
      sourceCandidates = [...sourceCandidates, ...allEntries.filter(entry => !entry.referenceOnly &&
        entry.text.split(/\n+|(?<=[.!?]) /).some(paragraph => {
          const label=definitionKey(paragraph).split('.')[0];
          return label===targetKey || label===inverted;
        }))];
    }
    // A published reference may name a child of a grouped definition. Keep the
    // full group as context, but only when that exact child label is present.
    if (!sourceCandidates.length && (quoted || unquoted) && targetKey.includes(',')) {
      for (let split = targetKey.lastIndexOf(','); split > 0; split = targetKey.lastIndexOf(',', split - 1)) {
        const parentKey = targetKey.slice(0, split).trim();
        const childKey = targetKey.slice(split + 1).trim();
        sourceCandidates = (byTerm.get(parentKey) || []).filter(entry =>
          entry.text.split(/\n+|(?<=[.!?]) /).some(paragraph => definitionKey(paragraph).startsWith(`${childKey}.`)));
        if (sourceCandidates.length) break;
      }
    }
    const candidates = sourceCandidates
      .filter(eligible);
    // Follow a reference chain only when no direct meaning exists at the
    // explicitly selected target. Keep unresolved/cyclic branches visible.
    let definitions = candidates.filter(entry => !entry.referenceOnly);
    if (!definitions.length && candidates.length && (section || chapter || appendix || targetKey !== term.key)) {
      const followed = candidates.map(entry => resolve(entry, nextVisited));
      if (followed.some(entry => entry.resolution === 'ambiguous-reference'))
        return { ...term, resolution: 'ambiguous-reference' };
      if (followed.some(entry => entry.resolution !== 'resolved-reference'))
        return { ...term, resolution: 'unresolved-reference' };
      definitions = followed.map(entry => entry.definition);
    }
    const unique = [...new Map(definitions.map(entry => [definitionKey(entry.text), entry])).values()];
    if (unique.length === 1) return { ...term, resolution: 'resolved-reference',
      definition: unique[0], referenceText: term.text };
    return { ...term, resolution: unique.length > 1 ? 'ambiguous-reference' : 'unresolved-reference' };
  }
  return terms.map(term => resolve(term));
}

export function definitionEntryID(bookID, term) {
  return createHash('sha256').update(`${bookID}|${term.key}|${term.anchor}|${term.text}`).digest('hex').slice(0, 20);
}
