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
  // MDL subsection citations identify the source; they are not part of the
  // word a reader encounters. Keep all other parenthetical qualifiers intact.
  const withoutCitation=term.replace(/\s+\(MDL\s+\d+(?:\([0-9a-z]+\))+\)$/i, '');
  if(withoutCitation!==term) aliases.push(withoutCitation, ...explicitDefinitionAliases(withoutCitation));
  const acronym=term.match(/\(([A-Z]{2,12})\)$/)?.[1];
  if(acronym) {
    const words=term.slice(0,term.lastIndexOf('(')).match(/[A-Z]+/g) || [];
    const initials=words.map(word=>word[0]).join('');
    const significant=words.filter(word=>!['OF','THE','AND','OR','FOR','IN','TO','AT'].includes(word)).map(word=>word[0]).join('');
    if(acronym===initials||acronym===significant) {
      // The printed acronym names this same phrase; its expanded form is also
      // an exact name, unlike a parenthetical scope qualifier.
      aliases.push(acronym, term.slice(0,term.lastIndexOf('(')).trim());
    }
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

// Administrative publications use quoted sentence-case labels. This is opt-in:
// quoted prose outside an explicit definition section is never a label.
export function splitQuotedLegalDefinition(value) {
  const raw = plainDefinitionText(value);
  const match = raw.match(/^(?:[a-z](?:-\d+)?\.|\d+\.)?\s*[“"]([^”"]+)[”"](?:\s+or\s+[“"]([^”"]+)[”"])?\s+(?:shall\s+)?means?\s+([\s\S]+)$/i)
    || raw.match(/^(?:[a-z](?:-\d+)?\.|\d+\.)?\s*[“"]([^”"]+\.)[”"]()(?:\s+([\s\S]*))?$/i);
  if (!match) return [];
  const term = match[1].replace(/\.$/, '').trim();
  if (!term) return [];
  return [{term, text:(match[3] || '').trim(), aliases:match[2] ? [match[2].replace(/\.$/, '').trim()] : []}];
}

// Opt-in for repeated legal labels, never ordinary "X means" prose. Both
// printed names must agree; retain the declaration and its qualifications.
export function splitSentenceLegalDefinition(value) {
  const raw = plainDefinitionText(value);
  const match = raw.match(/^([^.!?]{1,120})\.\s+The term\s+[“"]([^”"]+)[”"]\s+((?:shall\s+)?means?\b|(?:shall have|has)\s+(?:the\s+)?(?:same\s+)?(?:meaning|definition)\b)[\s\S]+$/i);
  if (!match || definitionKey(match[1]) !== definitionKey(match[2])) return [];
  return [{term:match[1].trim(), text:raw, aliases:[], referenceOnly:/^(?:has|shall have)\b/i.test(match[3])}];
}

export function extractDefinitionEntries(html, { definitionChapter = false, definitionSectionOnly = false, titleCaseLabels = false, quotedLegalLabels = false, sentenceLegalLabels = false, numberedLegalLabels = null, sentenceDefinitionTargets = [], citedSectionRanges = [] } = {}) {
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
  // Reviewed prose referrals can name an entire subsection rather than a
  // definition label. Both printed boundaries are required; never take an
  // arbitrary first sentence or the rest of a chapter on a missing boundary.
  for (const target of citedSectionRanges) {
    const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const startPattern = new RegExp(`(?:^|\\n)\\s*${escape(target.sectionNumber)}\\s+${escape(target.heading)}\\s*`);
    const endPattern = new RegExp(`(?:^|\\n)\\s*${escape(target.nextSection)}\\s+`);
    const matches = records.flatMap(record => {
      if (record.type !== 'paragraph') return [];
      const start = startPattern.exec(record.text);
      if (!start) return [];
      const tail = record.text.slice(start.index + start[0].length);
      const end = endPattern.exec(tail);
      if (!end) return [];
      return [{term:target.term, text:plainDefinitionText(tail.slice(0,end.index)),
        anchor:record.anchor, sectionNumber:target.sectionNumber, referenceOnly:false}];
    });
    if (matches.length !== 1 || !matches[0].text) throw Error(`Cited prose boundaries require review: ${target.sectionNumber}`);
    entries.push(matches[0]);
  }
  let sectionNumber = '';
  let current = null;
  let listReference = '';
  let inDefinitionSection = false;
  // Imported HTML sometimes embeds section headings on a new line within a
  // paragraph. Treat each as a real boundary so the last definition cannot
  // absorb the following section's requirements.
  const boundedRecords = records.flatMap(record => {
    if (record.type !== 'paragraph') return [record];
    const headings = [...record.text.matchAll(/(?:^|\n)\s*\*{0,2}(§\s*(?:\d{2}-)?[A-Z]?\d+(?:\.\d+)*\s+[^\n]+)/g)];
    if (!headings.length) return [record];
    const parts = [];
    let start = 0;
    for (const heading of headings) {
      if (heading.index > start) parts.push({...record, text:record.text.slice(start, heading.index)});
      parts.push({...record, type:'heading', text:heading[1]});
      start = heading.index + heading[0].length;
    }
    if (start < record.text.length) parts.push({...record, text:record.text.slice(start)});
    return parts;
  });
  for (const record of boundedRecords) {
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
    if (definitionSectionOnly && !inDefinitionSection) continue;
    const value = plainDefinitionText(record.text);
    if (sentenceLegalLabels && /^\(L\.L\./.test(value)) { current = null; continue; }
    // Only accept a prose definition when the definition chapter explicitly
    // names this exact term and section. Do not turn arbitrary "X is" prose
    // or a numbered child of the cited section into a definition.
    const sentenceTarget=sentenceDefinitionTargets.find(target=>target.sectionNumber===sectionNumber
      && ([' is ', ' means '].some(verb=>definitionKey(value).startsWith(definitionKey(target.term)+verb))
        || definitionKey(value).replace(/[“”]/g, '"').startsWith(`${definitionKey(target.term)}. the term "${definitionKey(target.term)}" means `)));
    if(sentenceTarget && /[.!?]$/.test(value) && !value.includes(':')) {
      entries.push({term:sentenceTarget.term,text:value,anchor:record.anchor,sectionNumber,referenceOnly:false});
      current=null;
      continue;
    }
    // Explicit numbered-source configuration prevents arbitrary numbered prose
    // from becoming definitions. Preserve each complete numbered paragraph group.
    if (numberedLegalLabels && sectionNumber === numberedLegalLabels.sectionNumber) {
      const numbered = value.match(/^(\d+)\.\s*([\s\S]*)$/);
      if (numbered) {
        current = null;
        const term = numberedLegalLabels.terms[numbered[1]];
        if (term) {
          current = {term, text:numbered[2], aliases:[], anchor:record.anchor,
            sectionNumber, referenceOnly:false};
          entries.push(current);
        }
      } else if (current && value) current.text += `\n\n${value}`;
      continue;
    }
    const reference = value.match(/(?:The\s+)?(?:following terms|terms that follow).*?defined in ((?:Section|Chapter)\s+[^:]+):/i);
    if (reference) listReference = reference[0];
    const sentenceParts = sentenceLegalLabels && inDefinitionSection ? splitSentenceLegalDefinition(record.text) : [];
    // An unsupported repeated label is a boundary, never continuation text for
    // the previous supported definition. The audit must expose the missing term.
    if (sentenceLegalLabels && inDefinitionSection && !sentenceParts.length && /^[^.!?]{1,120}\.\s+The term\b/i.test(value)) { current = null; continue; }
    const parts = sentenceParts.length ? sentenceParts : quotedLegalLabels && inDefinitionSection ? splitQuotedLegalDefinition(record.text)
      : record.bareLabel ? [{term: value, text: ''}]
      : titleCaseLabels ? splitTitleCaseDefinitions(record.text) : splitDefinitionParagraph(record.text);
    if (parts.length) {
      // An imported paragraph can finish a preceding definition before it
      // starts the next uppercase label. Keep that leading continuation.
      // A list referral must not absorb prose as if it supplied a meaning.
      if (current && !current.referenceOnly && !reference && parts[0].offset > 0) {
        const raw = String(record.text || '').replace(/[^\S\n]+/g, ' ').trim();
        const continuation = plainDefinitionText(raw.slice(0, parts[0].offset));
        if (continuation) current.text += `${current.text ? '\n\n' : ''}${continuation}`;
      }
      for (const part of parts) {
        // A bare all-caps list is a list of references, never a definition of
        // the next listed word. Retain an explicit reference when available.
        const body = part.text || listReference;
        if (body && !/[a-z]/.test(body)) { current = null; continue; }
        if (!definitionChapter && !sectionNumber) continue;
        const entry = { term: part.term, text: body, aliases:part.aliases || [], anchor: record.anchor,
          sectionNumber, referenceOnly: Boolean(part.referenceOnly) || (!part.text && Boolean(listReference)) || /^See\b/i.test(body) };
        entries.push(entry);
        current = entry;
      }
    } else if (current && value && !reference) {
      current.text += `\n\n${value}`;
    }
  }
  return entries.filter(entry => entry.text.trim()).map(entry => ({ ...entry, text: entry.text.trim(), aliases: [...new Set([...(entry.aliases || []), ...explicitDefinitionAliases(entry.term)])], key: definitionKey(entry.term) }));
}

// No implicit cross-edition resolution. Callers attach the lookup collection
// and code; reviewed external bindings separately retain their sourceBundle.
function sameDefinitionScope(term, entry, administrativeReference = false, appendix = null, buildingReference = false) {
  if (term.bundle !== entry.bundle) return false;
  if (administrativeReference) {
    if (!/^(?:(?:GENERAL )?ADMINISTRATIVE (?:CODE|PROVISIONS)|ADMINISTRATIVE CODE TITLE 28)$/i.test(entry.code || '')) return false;
  } else if (buildingReference) {
    if (entry.code !== 'BUILDING CODE') return false;
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
    // The audit's appendix pass may reach an already resolved, reviewed
    // cross-code target. Preserve its terminal source rather than discarding
    // that evidence when the second pass no longer contains support entries.
    if (term.resolution === 'resolved-reference' && term.definition && !term.definition.referenceOnly) return term;
    const nextVisited = new Set(visited).add(term);
    if (!term.referenceOnly) return { ...term, resolution: 'direct' };
    const namedList = /^See\s+(.+)$/i.exec(term.text);
    const namedTargets = namedList ? [...namedList[1].matchAll(/[“"]([^”"]+)[”"]/g)] : [];
    const connectors = namedList?.[1].replace(/[“"][^”"]+[”"]/g, '').replace(/\band\b/gi, '').replace(/[\s,.]+/g, '');
    if (namedTargets.length > 1 && connectors === '') {
      const targets = namedTargets.map(match => resolve({...term,text:`See "${match[1].replace(/[,.]$/, '').trim()}".`},nextVisited));
      if (targets.some(t=>t.resolution==='ambiguous-reference')) return {...term,resolution:'ambiguous-reference'};
      if (targets.some(t=>!['resolved-reference','multiple-definitions'].includes(t.resolution))) return {...term,resolution:'unresolved-reference'};
      const definitions = targets.flatMap(t=>t.definitions || [t.definition]);
      return {...term,resolution:'multiple-definitions',definitions,referenceText:term.text};
    }
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
    let section = term.text.match(/\b(?:See|defined in)\s+Section\s+((?:\d{2}-)?[A-Z]?\d+(?:\.\d+)*)/i)?.[1];
    // These printed Administrative Code referrals omit the Title 28 prefix.
    // The 2022 source includes an explicit editor correction; the 2014 targets
    // were reviewed in that edition's administrative chapter. Preserve the
    // original referral as referenceText and publish the actual target citation.
    if (/(?:of|in) the Administrative Code/i.test(term.text) && term.code === 'BUILDING CODE') {
      if (term.bundle === '2014-construction-codes' && term.key === 'floor surface area' && section === '101.4.5.2') section = '28-101.4.5.2';
      if (term.bundle === '2014-construction-codes' && term.key === 'minor alterations' && section === '105.4.2') section = '28-105.4.2';
      if (term.bundle === '2022-construction-codes' && ['minor alterations','ordinary repairs'].includes(term.key) &&
          section === '105.4.2' && /correct reference should be Section 28-105\.4\.2/i.test(term.text)) section = '28-105.4.2';
    }
    const appendix = term.text.match(/^See Appendix ([A-Z])\.$/i)?.[1]?.toUpperCase()
      || ((term.scope || 'general') === 'general' ? section?.match(/^([A-Z])\d/i)?.[1]?.toUpperCase() : null);
    const chapter = term.text.match(/^See Chapter ([A-Z]?\d+)\b/i)?.[1];
    // Cross-code references remain explicit until the named source is mapped.
    const administrativeReference = /(?:of|in) the Administrative Code/i.test(term.text);
    const buildingReference = /(?:of|in) the New York city building code\b/i.test(term.text);
    const external = !administrativeReference && !buildingReference && /(?:of|in) the .*(?:Code|Law)/i.test(term.text);
    let sourceCandidates = byTerm.get(targetKey) || [];
    const eligible = entry => entry !== term && sameDefinitionScope(term, entry, administrativeReference, appendix, buildingReference) && !external && (!chapter || String(entry.chapter)===chapter) && (!section ||
      entry.sectionNumber === section || String(entry.sectionNumber || '').startsWith(`${section}.`));
    // §28-101.5 prints this cross-reference in singular form but labels its
    // target in plural form. Map only this reviewed reference, in that same
    // section and collection; do not introduce generic singular/plural guessing.
    if (targetKey === '1968 or prior code building or structure (prior code building)' &&
        term.sectionNumber === '28-101.5' &&
        ['2014-construction-codes','2022-construction-codes','2026-enacted-administrative-code'].includes(term.bundle) &&
        /^(?:(?:GENERAL )?ADMINISTRATIVE PROVISIONS|ADMINISTRATIVE CODE TITLE 28)$/.test(term.code || '') &&
        !sourceCandidates.some(eligible)) {
      sourceCandidates = (byTerm.get('1968 or prior code buildings or structures (prior code buildings)') || [])
        .filter(entry => entry.sectionNumber === '28-101.5');
    }
    // Reviewed printed-label variations at their expressly cited sections.
    // These affect reference resolution only, never general Reader aliases.
    const reviewedSectionLabels = [
      ['2014-construction-codes','BUILDING CODE','902.1','value (of alterations, to determine required fire protection)','value (of alterations to determine required fire protection)'],
      ['2014-construction-codes','BUILDING CODE','308.3.1','mental hospitals','hospitals and mental hospitals'],
      ['2014-construction-codes','BUILDING CODE','1602.1','required strength','strength, required'],
      ['2014-construction-codes','BUILDING CODE','721.1.1','concrete carbonate aggregate','concrete, carbonate aggregate'],
      ['2014-construction-codes','BUILDING CODE','3302.1','single-point adjustable suspension scaffold','single-point adjustable suspended scaffold'],
      ['2022-construction-codes','BUILDING CODE','28-401.3','high-pressure boiler','boiler, high-pressure'],
      ['2022-construction-codes','BUILDING CODE','410.2.2','platform (special use)','platform'],
    ];
    const reviewedLabel = reviewedSectionLabels.find(([bundle,code,citation,label]) =>
      term.bundle===bundle && term.code===code && section===citation && targetKey===label);
    if (reviewedLabel && !sourceCandidates.some(eligible)) {
      sourceCandidates = byTerm.get(reviewedLabel[4]) || [];
    }
    // The cited administrative heading explicitly gives this alternate name.
    // Keep the mapping limited to the two reviewed Building Code referrals.
    if (targetKey === 'superintendent of construction' && term.code === 'BUILDING CODE' &&
        administrativeReference &&
        ((term.bundle === '2014-construction-codes' && section === '28-101.5') ||
         (term.bundle === '2022-construction-codes' && chapter === '1')) &&
        !sourceCandidates.some(eligible)) {
      sourceCandidates = (byTerm.get('superintendent of construction (construction superintendent)') || [])
        .filter(entry => entry.sectionNumber === '28-101.5');
    }
    // Chapter 2 qualifies these flood definitions; the explicitly cited
    // Appendix G labels omit those qualifiers. This is a reference mapping,
    // not an alias for matching unqualified words throughout the Reader.
    const floodReferenceLabels = {
      'existing construction (for flood zone purposes)': 'existing construction',
      'existing structure (for flood zone purposes)': 'existing structure',
      'historic structure (flood-resistant construction)': 'historic structure',
    };
    if (term.bundle === '2022-construction-codes' && term.code === 'BUILDING CODE' &&
        section === 'G201.1.2' && !sourceCandidates.some(eligible) && floodReferenceLabels[targetKey]) {
      sourceCandidates = byTerm.get(floodReferenceLabels[targetKey]) || [];
    }
    if (section && !sourceCandidates.some(eligible)) {
      // A printed section citation disambiguates typographic joined/hyphenated
      // labels (PREFIRM / PRE-FIRM, PARTICLE BOARD / PARTICLEBOARD).
      // Preserve letter order, punctuation and parenthetical qualifiers.
      const joined = value => definitionKey(value).replace(/(?<=[a-z])[-\s]+(?=[a-z])/g,'');
      sourceCandidates = allEntries.filter(entry => eligible(entry) && joined(entry.key) === joined(targetKey));
    }
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
    // A reciprocal printed label identifies an alternate name: HOLD-DOWN
    // refers to TIE-DOWN, whose heading is TIE-DOWN (HOLD-DOWN). Do not
    // discard arbitrary parenthetical scope qualifiers or infer aliases.
    if ((quoted || unquoted) && !sourceCandidates.some(eligible)) {
      sourceCandidates = byTerm.get(`${targetKey} (${term.key})`) || sourceCandidates;
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
      if (followed.some(entry => !['resolved-reference','multiple-definitions'].includes(entry.resolution)))
        return { ...term, resolution: 'unresolved-reference' };
      if (followed.length===1 && followed[0].resolution==='multiple-definitions')
        return {...term,resolution:'multiple-definitions',definitions:followed[0].definitions,referenceText:term.text};
      definitions = followed.flatMap(entry => entry.definitions || [entry.definition]);
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
