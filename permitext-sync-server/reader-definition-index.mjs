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
export function splitDefinitionParagraph(value) {
  const raw = String(value || '').replace(/[^\S\n]+/g, ' ').trim();
  const label = /(?:^|\n|(?<=[.!?]) )\s*([A-Z0-9][A-Z0-9 ,’'()\/\-–—\n]{1,120})\.[ \t]*(?=\S|\n|$)/g;
  const starts = [...raw.matchAll(label)].filter(match => /[A-Z]/.test(match[1]));
  return starts.map((match, i) => ({
    term: plainDefinitionText(match[1]),
    text: plainDefinitionText(raw.slice(match.index + match[0].length, starts[i + 1]?.index)),
    offset: match.index,
  }));
}

export function extractDefinitionEntries(html, { definitionChapter = false } = {}) {
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
      records.push({ type: heading ? 'heading' : 'paragraph', text: nodeText(heading || node), anchor: sourceAnchor(node) });
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
  for (const record of records) {
    if (record.type === 'term') { entries.push({ ...record, referenceOnly: false }); continue; }
    if (record.type === 'heading') {
      const heading = plainDefinitionText(record.text);
      const match = heading.match(/^(?:§\s*|Section\s+)?(?:[A-Z]+\s+)?((?:\d{2}-)?[A-Z]?\d+(?:\.\d+)*)\b/i);
      if (match) sectionNumber = match[1];
      current = null;
      listReference = '';
      continue;
    }
    // Some imported historical HTML embeds the next section heading after a
    // line break inside the preceding section's paragraph.
    const inlineHeading = record.text.match(/(?:^|\n)\s*\*?§\s*((?:\d{2}-)?[A-Z]?\d+(?:\.\d+)*)\s+Definitions\./i);
    if (inlineHeading) {
      sectionNumber = inlineHeading[1];
      current = null;
      listReference = '';
    }
    const value = plainDefinitionText(record.text);
    const reference = value.match(/(?:following terms|terms that follow).*?defined in (Section\s+[^:]+):/i);
    if (reference) listReference = `See ${reference[1].trim()}.`;
    const parts = splitDefinitionParagraph(record.text);
    if (parts.length) {
      for (const part of parts) {
        // A bare all-caps list is a list of references, never a definition of
        // the next listed word. Retain an explicit reference when available.
        const body = part.text || listReference;
        if (!body || !/[a-z]/.test(body)) { current = null; continue; }
        if (!definitionChapter && !sectionNumber) continue;
        const entry = { term: part.term, text: body, anchor: record.anchor,
          sectionNumber, referenceOnly: /^See\b/i.test(body) };
        entries.push(entry);
        current = entry;
      }
    } else if (current && value && !reference) {
      current.text += `\n\n${value}`;
    }
  }
  return entries.map(entry => ({ ...entry, key: definitionKey(entry.term) }));
}

// Reference resolution must never borrow a definition from another edition.
// Callers attach bundle/code identity when combining source chapters.
function sameDefinitionScope(term, entry, administrativeReference = false) {
  if (term.bundle !== entry.bundle) return false;
  if (administrativeReference) {
    if (!/^(?:GENERAL )?ADMINISTRATIVE (?:CODE|PROVISIONS)$/i.test(entry.code || '')) return false;
  } else if (term.code !== entry.code) return false;
  if ((term.scope || '') !== (entry.scope || '')) return false;
  return true;
}

export function resolveDefinitionReferences(terms, allEntries) {
  const byTerm = new Map();
  for (const entry of allEntries) {
    if (!byTerm.has(entry.key)) byTerm.set(entry.key, []);
    byTerm.get(entry.key).push(entry);
  }
  return terms.map(term => {
    if (!term.referenceOnly) return { ...term, resolution: 'direct' };
    const quoted = term.text.match(/^See\s+[“"']([^”"']+)[”"']/i);
    const section = term.text.match(/^See\s+Section\s+((?:\d{2}-)?[A-Z]?\d+(?:\.\d+)*)/i)?.[1];
    // Cross-code references remain explicit until the named source is mapped.
    const administrativeReference = /(?:of|in) the Administrative Code/i.test(term.text);
    const external = !administrativeReference && /(?:of|in) the .*(?:Code|Law)/i.test(term.text);
    const candidates = (byTerm.get(quoted ? definitionKey(quoted[1].replace(/\.$/, '')) : term.key) || [])
      .filter(entry => sameDefinitionScope(term, entry, administrativeReference) && !entry.referenceOnly && !external && (!section ||
        entry.sectionNumber === section || entry.sectionNumber.startsWith(`${section}.`)));
    const unique = [...new Map(candidates.map(entry => [definitionKey(entry.text), entry])).values()];
    if (unique.length === 1) return { ...term, resolution: 'resolved-reference',
      definition: unique[0], referenceText: term.text };
    return { ...term, resolution: unique.length > 1 ? 'ambiguous-reference' : 'unresolved-reference' };
  });
}

export function definitionEntryID(bookID, term) {
  return createHash('sha256').update(`${bookID}|${term.key}|${term.anchor}|${term.text}`).digest('hex').slice(0, 20);
}
