// Evidence positions count overlapping, case-sensitive occurrences in the provision,
// after collapsing whitespace. The native Reader uses the same coordinate system.
const boundaries = new Set('P DIV LI OL UL H1 H2 H3 H4 H5 H6 BLOCKQUOTE SECTION BR DT DD'.split(' '));
const excluded = "script,style,table,figure,.code-media,.authored-section-label,[hidden],[data-research-selection-exclude='true'],button:not(.reader-definition-term):not(.inline-code-reference)";

function passageMap(root, withPoints = false) {
  const chars = [], points = [];
  let space = false;
  function visit(node) {
    if (node.nodeType === 3) {
      for (let offset = 0; offset < node.length; ++offset) {
        const ch = node.data[offset];
        if (/\s/.test(ch)) { space = true; continue; }
        if (space && chars.length) {
          chars.push(' ');
          if (withPoints) points.push(null);
        }
        space = false;
        chars.push(ch);
        if (withPoints) points.push({node, offset});
      }
      return;
    }
    if (node.nodeType === 1 && node !== root && node.matches(excluded)) return;
    const boundary = boundaries.has(node.tagName);
    if (boundary) space = true;
    for (const child of node.childNodes) visit(child);
    if (boundary) space = true;
  }
  if (root && !root.matches?.('table,figure,.code-media')) visit(root);
  return {text:chars.join(''), points};
}

function occurrences(text, quote) {
  const starts = [];
  if (!quote) return starts;
  for (let pos = text.indexOf(quote); pos !== -1; pos = text.indexOf(quote, pos + 1)) starts.push(pos);
  return starts;
}

const highlightedParts = new WeakMap();
let highlight, registryObserver;
function clearPart(part) {
  const ranges = highlightedParts.get(part);
  if (!ranges) return;
  for (const range of ranges) highlight.delete(range);
  highlightedParts.delete(part);
  delete part.dataset.evidencePainted;
}

function ensureHighlight(doc) {
  if (highlight) return;
  highlight = new Highlight();
  CSS.highlights.set('reader-saved-evidence', highlight);
  // Definition links can replace text nodes after the chapter has rendered.
  // Rebind their ranges, and release ranges when a panel or a virtual row is removed.
  registryObserver = new MutationObserver(records => {
    const repaint = new Set();
    for (const record of records) {
      const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      const part = target?.closest('[data-evidence-painted]');
      if (part) repaint.add(part);
      for (const removed of record.removedNodes) {
        if (removed.nodeType !== 1 || removed.isConnected) continue;
        if (removed.hasAttribute('data-evidence-painted')) clearPart(removed);
        if (highlight.size) removed.querySelectorAll('[data-evidence-painted]').forEach(clearPart);
      }
    }
    for (const part of repaint) {
      if (part.isConnected) part.closest('.chapter-section')?._readerEvidence?.paint(part);
    }
  });
  registryObserver.observe(doc.documentElement, {subtree:true, childList:true, characterData:true});
}

export function readerExcerptFields(value = {}) {
  const read = raw => {
    if (typeof raw !== 'string') return raw;
    try { return JSON.parse(raw); } catch { return null; }
  };
  const quotes = read(value?.selectedExcerpts), ordinals = read(value?.selectedExcerptOccurrences);
  const selectedExcerpts = Array.isArray(quotes) ? [...new Set(quotes.filter(q => typeof q === 'string' && q.trim()))] : [];
  const selectedExcerptOccurrences = Object.create(null);
  for (const quote of selectedExcerpts) {
    const positions = Object.hasOwn(ordinals || {}, quote) ? ordinals[quote] : null;
    if (Array.isArray(positions)) {
      const valid = [...new Set(positions.filter(n => Number.isSafeInteger(n) && n >= 0))].sort((a,b) => a-b);
      if (valid.length) selectedExcerptOccurrences[quote] = valid;
    }
  }
  return {selectedExcerpts, selectedExcerptOccurrences};
}

export function mergeReaderExcerptFields(...records) {
  const selectedExcerpts = new Set(), selectedExcerptOccurrences = Object.create(null);
  for (const record of records) {
    const fields = readerExcerptFields(record);
    for (const quote of fields.selectedExcerpts) {
      selectedExcerpts.add(quote);
      if (fields.selectedExcerptOccurrences[quote]) {
        selectedExcerptOccurrences[quote] = [...new Set([...(selectedExcerptOccurrences[quote] || []),
          ...fields.selectedExcerptOccurrences[quote]])].sort((a,b) => a-b);
      }
    }
  }
  return {selectedExcerpts:[...selectedExcerpts], selectedExcerptOccurrences};
}

// The outbox keeps one mutation per canonical project link. Combine pending
// additions only. A deletion ends their lifetime, even if it has not uploaded yet.
export function coalesceQueuedReaderSelection(previous, incoming) {
  if (!previous || incoming.deletedAt) return incoming;
  const reset = previous.deletedAt || previous.selectionResetAt;
  const fields = mergeReaderExcerptFields(previous.deletedAt ? {} : previous, incoming);
  if (!fields.selectedExcerpts.length) return incoming;
  const result = {...incoming, ...fields};
  if (reset) {
    result.selectionResetAt = reset;
    if (Date.parse(result.updatedAt) <= Date.parse(reset)) {
      result.updatedAt = new Date(Date.parse(reset) + 1).toISOString();
    }
  }
  return result;
}

export function createReaderEvidenceSection(root, title, blocks, renderBlock) {
  let projection, savedSignature = '', ranges = [], aliases = [];
  const normalized = text => text.replace(/\s+/g, ' ').trim();
  function content() {
    if (projection) return projection;
    // Include unmounted blocks when assigning or resolving an ordinal.
    const parts = [normalized(title), ...blocks.map(block => passageMap(renderBlock(block)).text)];
    let text = '', start = [];
    const firstBody = parts.findIndex((p, i) => i > 0 && p);
    const headingInBody = firstBody > 0 && parts[0] && (parts[firstBody] === parts[0] || parts[firstBody].startsWith(parts[0] + ' '));
    parts.forEach((part, i) => {
      if (i === 0 && headingInBody) { start.push(0); return; }
      if (part && text) text += ' ';
      start.push(text.length);
      text += part;
    });
    projection = {parts, start, text};
    return projection;
  }
  function mount(node, index) {
    node.dataset.evidencePart = String(index);
    if (ranges.length) paint(node);
  }
  function paint(node) {
    clearPart(node);
    if (!ranges.length || !globalThis.CSS?.highlights || typeof Highlight === 'undefined') return;
    const {parts, start} = content();
    const i = Number(node.dataset.evidencePart), base = start[i];
    const matched = ranges.filter(([from,to]) => from < base + parts[i].length && to > base);
    if (!matched.length) return;
    const {text, points} = passageMap(node, true);
    if (text !== parts[i]) return;
    const colored = [];
    for (const [from, to] of matched) {
      const at = Math.max(0, from-base), end = Math.min(points.length, to-base);
      // Keep each DOM range inside its text node. Buttons and layout-only
      // markup between two text nodes must not be colored.
      let first, last;
      const flush = () => {
        if (!first) return;
        const range = node.ownerDocument.createRange();
        range.setStart(first.node, first.offset);
        range.setEnd(last.node, last.offset+1);
        colored.push(range);
      };
      for (let pos=at; pos<end; pos++) {
        const point=points[pos];
        if (!point) continue;
        if (first?.node !== point.node) { flush(); first=point; }
        last=point;
      }
      flush();
    }
    if (!colored.length) return;
    ensureHighlight(node.ownerDocument);
    for (const range of colored) highlight.add(range);
    node.dataset.evidencePainted = '';
    highlightedParts.set(node, colored);
  }
  // Some web catalog rows only repeat a heading inside the preceding section's
  // authored body. Native saves still use the subsection ID of that heading.
  function provisions() {
    const {text} = content();
    const boundaries = [{from:0, source:null}];
    for (const alias of aliases) {
      const matches = occurrences(text, normalized(alias.label));
      if (matches.length === 1 && matches[0] > 0) boundaries.push({from:matches[0], source:alias});
    }
    boundaries.sort((a,b) => a.from-b.from);
    return boundaries.map((item,i) => ({...item,to:boundaries[i+1]?.from ?? text.length}));
  }
  function update(record, aliasRecords = []) {
    const fields = readerExcerptFields(record);
    aliases = aliasRecords;
    const signature = JSON.stringify([fields,...aliases.map(a=>[a.payload.sectionID,a.label,a.record])]);
    if (signature === savedSignature) return;
    savedSignature = signature;
    ranges = [];
    if (fields.selectedExcerpts.length || aliases.some(a=>a.record?.selectedExcerpts?.length)) {
      const {text} = content();
      for (const part of provisions()) {
        const evidence = part.source ? readerExcerptFields(part.source.record) : fields;
        const provisionText = text.slice(part.from,part.to);
        for (const quote of evidence.selectedExcerpts) {
          const exact = normalized(quote), matches = occurrences(provisionText,exact);
          const ordinals = evidence.selectedExcerptOccurrences[quote] || (matches.length === 1 ? [0] : []);
          for (const n of ordinals) {
            if (n < matches.length) {
              const from = part.from + matches[n];
              ranges.push([from, from + exact.length, String(part.source?.payload.sectionID ?? root.dataset.sectionId ?? '')]);
            }
          }
        }
      }
    }
    root.querySelectorAll('[data-evidence-part]').forEach(paint);
  }
  function capture(range, payload) {
    const {parts, start, text} = content();
    let from = Infinity, to = 0;
    for (const part of root.querySelectorAll('[data-evidence-part]')) {
      if (!range.intersectsNode(part)) continue;
      const i = Number(part.dataset.evidencePart), mapped = passageMap(part, true);
      if (mapped.text !== parts[i]) continue;
      for (let j=0; j<mapped.points.length; ++j) {
        const point = mapped.points[j];
        if (!point || range.comparePoint(point.node,point.offset) < 0 || range.comparePoint(point.node,point.offset+1) > 0) continue;
        from=Math.min(from,start[i]+j);
        to=Math.max(to,start[i]+j+1);
      }
    }
    if (from >= to) return [];
    const saves = [];
    for (const provision of provisions()) {
      const a = Math.max(from,provision.from), b = Math.min(to,provision.to);
      if (a >= b) continue;
      const span = text.slice(a,b), quote = span.trim();
      if (!quote) continue;
      const start = a + span.indexOf(quote) - provision.from;
      const ordinal = occurrences(text.slice(provision.from,provision.to),quote).indexOf(start);
      if (ordinal >= 0) {
        saves.push({...(provision.source?.payload || payload), selectedExcerpts:[quote], selectedExcerptOccurrences:{[quote]:[ordinal]}});
      }
    }
    return saves;
  }
  function firstTarget(sectionID) {
    const matching = sectionID == null ? ranges : ranges.filter(range => range[2] === String(sectionID));
    if (!matching.length) return null;
    const from = Math.min(...matching.map(range => range[0]));
    const {parts,start} = content();
    const i = parts.findIndex((part,index) => from >= start[index] && from < start[index]+part.length);
    if (i > 0) root._readerBlockWindow?.ensureMatching((block, index) => index === i - 1);
    return root.querySelector(`[data-evidence-part="${i}"]`);
  }
  return {mount, paint, update, capture, firstTarget};
}
