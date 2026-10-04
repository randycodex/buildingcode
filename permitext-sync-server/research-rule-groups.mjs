import { createHash } from 'node:crypto';
import { researchCurrentRuleDetailScore, researchCurrentRuleDetails } from './research-rule-packets.mjs';
import { researchPassagesForSection } from './research-passage-index.mjs';

export const researchRuleGroupVersion = '20261004-enclosing-operative-parent-v5';
const fields = ['codePrefix', 'corpusID', 'codeVersion', 'codeEdition', 'jurisdiction'];
const identity = value => String(value?.sectionID || value?.id || '');
const compact = value => String(value || '').replace(/\s+/g, ' ').trim();
const sameAuthority = (left, right) => fields.every(key => left?.[key] && left[key] === right?.[key]);

const namedReferenceBooks = { 'existing building': 'EBC', building: 'BC', plumbing: 'PC', mechanical: 'MC',
  'fuel gas': 'FGC', fire: 'FC', administrative: 'AC' };
function referenceCodeQualifier(value, side, ownPrefix) {
  const text = compact(value).replace(/\b(?:New York City|NYC)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  const book = '(?:(?<name>existing[-\\s]+building|building|plumbing|mechanical|fuel[-\\s]+gas|fire|administrative)\\s+code|(?<prefix>AC|BC|EBC|FC|FGC|MC|PC|ZR)(?:\\s+code)?)';
  const qualified = `(?:(?<edition>(?:19|20)\\d{2})\\s+)?${book}`;
  const expression = side === 'before' ? `\\b${qualified}$` : `^of\\s+(?:the\\s+)?${qualified}\\b`;
  const match = text.match(new RegExp(expression, 'i'));
  if (match) return { codePrefix: match.groups.prefix?.toUpperCase() ||
      namedReferenceBooks[match.groups.name.toLowerCase().replace(/[-\s]+/g, ' ')], edition: match.groups.edition || '' };
  // An expressly named edition without a book retains the own-book locator,
  // but does not silently become a reference to the current edition.
  const edition = side === 'before' ? text.match(/\b((?:19|20)\d{2})\s+(?:code|edition)$/i)
    : text.match(/^of\s+(?:the\s+)?((?:19|20)\d{2})\s+(?:code|edition)\b/i);
  return edition ? { codePrefix: ownPrefix, edition: edition[1] } : null;
}

// A structural parent link must bind the actual current authority. Explicit
// book/edition qualifiers on a literal reference override an own-book default.
// This locator alone never supplies an obligation or establishes applicability.
function* parentChildReferenceClauses(parent, child) {
  const number = String(parent?.sectionNumber || '');
  const childNumber = String(child?.sectionNumber || '');
  if (!identity(parent) || !identity(child) || !sameAuthority(parent, child) ||
      !/^\d+(?:\.\d+)+$/.test(number) || !/^\d+(?:\.\d+){2,}$/.test(childNumber) ||
      childNumber.split('.').slice(0, -1).join('.') !== number ||
      !parent.body?.blocks?.length || parent.body.researchClaimEligible === false || parent.body.truncated ||
      parent.body.blocks.some(block => block.researchClaimEligible === false || block.truncated || !compact(block.plainText))) return;
  const bodyText = parent.body.blocks.map(block => block.plainText).join('\n\n');
  const sourceTextSHA256 = createHash('sha256').update(bodyText).digest('hex');
  const unquoted = bodyText.replace(/`[^`]*`|"[^"\n]*"|“[^”\n]*”/g, ' ');
  const clauses = unquoted.split(/(?<=[.!?])\s+(?=[A-Z])|[;\n]+/);
  for (const clause of clauses) {
    for (const match of clause.matchAll(/\b(?:(AC|BC|EBC|FC|FGC|MC|PC|ZR)\s+)?Sections?\s+(\d+(?:\.\d+)+)(?:\s+(?:through|to)\s+(\d+(?:\.\d+)+))?((?:\s*(?:,\s*|\s+(?:and|or)\s+)(?:Sections?\s+)?\d+(?:\.\d+)+){0,3})\b/gi)) {
      const prefix = match[1]?.toUpperCase() || parent.codePrefix;
      const start = match[2], end = match[3];
      if (prefix !== child.codePrefix) continue;
      const before = clause.slice(0, match.index).trim();
      const after = clause.slice(match.index + match[0].length);
      const qualifiers = [referenceCodeQualifier(`${before} ${match[1] || ''}`, 'before', parent.codePrefix),
        referenceCodeQualifier(after, 'after', parent.codePrefix)].filter(Boolean);
      if (qualifiers.some(qualifier => qualifier.codePrefix !== child.codePrefix ||
          qualifier.edition && !String(child.codeEdition).includes(qualifier.edition))) continue;
      const literalNumbers = [start, ...(match[4].match(/\d+(?:\.\d+)+/g) || [])];
      if (!end && literalNumbers.includes(childNumber)) yield { clause, before, after, kind: 'literal_child', sourceTextSHA256 };
      const first = start.split('.'), last = end?.split('.'), parts = childNumber.split('.');
      if (last && first.length === parts.length && last.length === parts.length &&
          first.slice(0, -1).join('.') === number && last.slice(0, -1).join('.') === number &&
          Number(first.at(-1)) <= Number(parts.at(-1)) && Number(parts.at(-1)) <= Number(last.at(-1)))
        yield { clause, before, after, kind: 'child_range', sourceTextSHA256 };
    }
  }
}

export function researchParentChildReferenceLink(parent, child) {
  const bound = parentChildReferenceClauses(parent, child).next().value;
  return bound ? { kind: bound.kind, sourceTextSHA256: bound.sourceTextSHA256 } : null;
}

// A complete indexed immediate child can add literal current-question detail
// missing from its parent. Hierarchy nominates advisory recall, not legal scope.
export function researchImmediateChildDetailGain(parent, child, question) {
  if (!identity(parent) || !identity(child) || identity(parent) === identity(child) || !sameAuthority(parent, child) ||
      !/^\d+(?:\.\d+)+$/.test(parent.sectionNumber || '') ||
      !/^\d+$/.test(String(child.sectionNumber || '').slice(String(parent.sectionNumber).length + 1)) ||
      !String(child.sectionNumber || '').startsWith(parent.sectionNumber + '.') ||
      [parent, child].some(value => value.subsectionNumber !== value.sectionNumber || value.scopeComplete !== true ||
        value.sourceOffsets?.start !== 0 || !value.sourceTextHash || !value.text)) return null;
  const covered = new Set(researchCurrentRuleDetails(parent, question));
  const childDetails = researchCurrentRuleDetails(child, question);
  const gained = childDetails.filter(term => !covered.has(term));
  return covered.size && childDetails.length >= 2 && gained.length ? gained : null;
}

// A fresh enacted immediate parent can supply the effect of classification.
// Reference and obligation must be grammatically connected in the raw clause;
// hierarchy/title alone is not scope evidence. The caller budgets whole bytes.
export function researchOperativeParentLink(parent, child) {
  for (const { clause, before, after, kind, sourceTextSHA256 } of parentChildReferenceClauses(parent, child)) {
    if (!/\b(?:shall|must)\b/i.test(clause) ||
        !/\b(?:comply|meet|require[sd]?|requiring|be provided|be equipped|be constructed|be installed|be protected|be tested|be maintained|conform)\b/i.test(clause) ||
        /\b(?:not|never)\s+(?:be\s+)?(?:required|requiring|subject|governed)\b/i.test(clause)) continue;
    const scopedSubject = /\b(?:specified|defined|classified|listed|regulated|identified|covered|described|governed)\s+(?:in|by|under)\s*$/i.test(before) ||
      /\b(?:in accordance with|subject to|under|within)\s*$/i.test(before) || !before;
    const scopedPredicate = /^[^,;.!?]{0,160}\b(?:shall|must)\b/i.test(after) &&
      !/^[^.!?]*?\b(?:and|but|while|whereas)\b[^.!?]*?\b(?:shall|must)\b/i.test(after);
    const directCompliance = /\b(?:shall|must)\b[^,;.!?]{0,100}\b(?:(?:comply|conform)\s+(?:with|to)|in accordance with)\s*$/i.test(before);
    if (scopedSubject && scopedPredicate || directCompliance) return { kind, sourceTextSHA256 };
  }
  return null;
}

export function boundCanonicalRulePassage(canonical, passage, wholeSection = false, completeSubtree = false) {
  if (!canonical?.body?.blocks || canonical.truncated || canonical.body.truncated || canonical.researchClaimEligible === false ||
      !passage?.text || (!completeSubtree && passage.scopeComplete !== true) ||
      (passage.sectionID && String(passage.sectionID) !== identity(canonical)) ||
      fields.some(key => passage[key] && passage[key] !== canonical[key])) return false;
  const block = canonical.body.blocks.find(block => String(block.id || '') === String(passage.sourceOffsets?.blockID || ''));
  const { start, end } = passage.sourceOffsets || {};
  if (!block || block.truncated || block.researchClaimEligible === false || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start ||
      createHash('sha256').update(String(block.plainText || '')).digest('hex') !== passage.sourceTextHash ||
      String(block.plainText).slice(start, end) !== passage.text) return false;
  if (passage.completeSubsectionText && String(block.plainText).slice(start,
      start + passage.completeSubsectionText.length) !== passage.completeSubsectionText) return false;
  if (completeSubtree && !researchPassagesForSection(canonical, canonical.body).some(fresh =>
      fresh.id === passage.id && fresh.subsectionNumber === passage.subsectionNumber &&
      fresh.sourceTextHash === passage.sourceTextHash && fresh.completeSubsectionText &&
      fresh.completeSubsectionText === passage.completeSubsectionText)) return false;
  if (wholeSection && (canonical.body.blocks.length !== 1 || start !== 0 || end !== block.plainText.length ||
      passage.subsectionNumber !== canonical.sectionNumber)) return false;
  return [passage.completeSubsectionText || passage.text, ...(passage.contextTexts || [])]
    .every(text => compact(canonical.text || canonical.canonicalText || block.plainText).includes(compact(text)));
}

// This selects an existing exact source scope, not a new catalog neighbor.
export function nearestCompleteIndexedRuleGroup(canonical, primary, alternatives, maximumCharacters, question) {
  if (!/^\d+(?:\.\d+)+$/.test(primary?.subsectionNumber || '') || !boundCanonicalRulePassage(canonical, primary)) return null;
  return (alternatives || []).filter(parent => parent.id !== primary.id &&
    /^\d+(?:\.\d+)+$/.test(parent.subsectionNumber || '') &&
    primary.subsectionNumber.startsWith(parent.subsectionNumber + '.') &&
    boundCanonicalRulePassage(canonical, parent, false, true) && parent.sourceOffsets.blockID === primary.sourceOffsets.blockID &&
    parent.sourceOffsets.start <= primary.sourceOffsets.start &&
    parent.sourceOffsets.start + (parent.completeSubsectionText || parent.text).length >=
      primary.sourceOffsets.start + (primary.completeSubsectionText || primary.text).length &&
    researchCurrentRuleDetailScore(parent, question) >= 2 &&
    [...new Set([...(parent.contextTexts || []), parent.completeSubsectionText || parent.text].map(compact))]
      .join('\n\n').length <= maximumCharacters)
    .sort((left, right) => right.subsectionNumber.split('.').length - left.subsectionNumber.split('.').length)[0] || null;
}

// Search's small alternative pools are not a completeness inventory. A selected
// responsive child can locate its nearest fitting parent in the same authorized
// index, using the body discovery already read. This adds no source/read or legal
// applicability claim; assembly still freshly binds the returned exact record.
export function nominateNearestCompleteIndexedRuleGroup(candidate, index, question, { maximumCharacters = 12000 } = {}) {
  const anchor = candidate?.section || candidate;
  const primary = candidate?.indexedPassage;
  const body = candidate?.body || anchor?.body;
  const cap = Math.min(12000, Number(maximumCharacters));
  if (!Number.isFinite(cap) || cap <= 0 || !index?.passagesByID?.get || !index?.sections?.get || !Array.isArray(index.passages) ||
      !body?.blocks || candidate.useSelectedPassageOnly || candidate.signals?.useSelectedPassageOnly ||
      candidate.contextualReference || candidate.contextualAuthorityReference || candidate.inheritedReference || candidate.inheritedAuthorityReference ||
      anchor?.truncated || anchor?.researchClaimEligible === false || !primary?.id ||
      researchCurrentRuleDetailScore(primary, question) < 2) return null;
  const sectionID = String(candidate?.section ? identity(anchor) : candidate?.sectionID || '');
  const registered = index.sections.get(sectionID);
  const indexed = index.passagesByID.get(primary.id);
  if (!registered || identity(registered) !== sectionID || !sameAuthority(anchor, registered) ||
      !indexed || indexed.sectionID !== sectionID ||
      ['text', 'subsectionNumber', 'sourceTextHash', 'scopeComplete'].some(key => primary[key] !== indexed[key]) ||
      ['blockID', 'start', 'end'].some(key => primary.sourceOffsets?.[key] !== indexed.sourceOffsets?.[key]) ||
      (primary.completeSubsectionText && primary.completeSubsectionText !== indexed.completeSubsectionText) ||
      fields.some(key => (primary[key] && primary[key] !== registered[key]) ||
        (indexed[key] && indexed[key] !== registered[key]))) return null;
  const canonical = { ...registered, body, text: body.blocks.map(block => String(block.plainText || '')).join('\n\n') };
  const parents = index.passages.filter(parent => parent.sectionID === sectionID &&
    parent.kind === 'numbered_subsection' && index.passagesByID.get(parent.id) === parent &&
    fields.every(key => !parent[key] || parent[key] === registered[key]));
  return nearestCompleteIndexedRuleGroup(canonical, indexed, parents, cap, question);
}

export function canonicalRuleDelegatesToChildren(parent) {
  const text = String(parent?.text || parent?.canonicalText || '');
  return fields.every(key => parent?.[key]) && identity(parent) && !parent.truncated &&
    /^\d+(?:\.\d+)+$/.test(parent.sectionNumber || '') && text.length <= 1200 &&
    /\bin accordance with this section\b/i.test(text) &&
    !/\b\d+(?:\.\d+)?\s*(?:inches?|feet|foot|mm|meters?|metres?|percent)\b|\d\s*%/i.test(text);
}

export function registeredDelegatedRuleChildren(parent, passages, registered, question, maximumCharacters = 12000) {
  if (!canonicalRuleDelegatesToChildren(parent)) return [];
  const registration = new Map((registered || []).map(section => [identity(section), section]));
  return [...new Map((passages || []).flatMap(passage => {
    const section = registration.get(String(passage.sectionID));
    if (!section || !sameAuthority(parent, section) || !fields.every(key => !passage[key] || passage[key] === section[key]) ||
        !String(section.sectionNumber).startsWith(parent.sectionNumber + '.') ||
        !/^\d+$/.test(String(section.sectionNumber).slice(parent.sectionNumber.length + 1)) ||
        passage.subsectionNumber !== section.sectionNumber || passage.scopeComplete !== true ||
        passage.sourceOffsets?.start !== 0 || !passage.sourceTextHash || !passage.text ||
        passage.text.length > maximumCharacters || researchCurrentRuleDetailScore(passage, question) < 2) return [];
    return [[identity(section), { ...section, sectionID: identity(section), boundChildPassage: passage }]];
  })).values()].sort((left, right) => researchCurrentRuleDetailScore(right.boundChildPassage, question) -
    researchCurrentRuleDetailScore(left.boundChildPassage, question)).slice(0, 2);
}

export function freshDelegatedRuleChildren(parent, group, question, maximumCharacters = 12000) {
  if (!group || !sameAuthority(parent, group.parent) || identity(parent) !== identity(group.parent) ||
      parent.sectionNumber !== group.parent.sectionNumber || !canonicalRuleDelegatesToChildren(parent) ||
      !boundCanonicalRulePassage(parent, group.parentPassage, true)) return [];
  return registeredDelegatedRuleChildren(parent, (group.children || []).map(child => child.boundChildPassage),
    group.children, question, maximumCharacters);
}

// Only a selected responsive rule can nominate a structural parent. The
// registered hierarchy and exact index bindings are rechecked after resolution.
export function nominateDelegatedRuleGroups(selected, catalog, index, question, references) {
  if (!index?.passages || typeof references !== 'function') return [];
  const byID = new Map(catalog.map(section => [identity(section), section]));
  const bySection = new Map();
  for (const passage of index.passages) {
    if (!bySection.has(String(passage.sectionID))) bySection.set(String(passage.sectionID), []);
    bySection.get(String(passage.sectionID)).push(passage);
  }
  const groups = new Map();
  for (const item of selected) {
    if (!item.indexedPassage || item.useSelectedPassageOnly || item.contextualAuthorityReference ||
        item.inheritedAuthorityReference || researchCurrentRuleDetailScore(item.indexedPassage, question) < 2) continue;
    const anchor = item.section;
    const linked = references(item.indexedPassage.text).filter(reference =>
      reference.codePrefix === '*' || reference.codePrefix === anchor.codePrefix);
    for (const parent of [anchor, ...catalog.filter(section => sameAuthority(anchor, section) &&
      linked.some(reference => reference.sectionNumber === section.sectionNumber))]) {
      if (!sameAuthority(anchor, parent) || !byID.has(identity(parent))) continue;
      const parentPassage = (bySection.get(identity(parent)) || []).find(passage =>
        passage.subsectionNumber === parent.sectionNumber && passage.sourceOffsets?.start === 0 && passage.scopeComplete === true);
      if (!parentPassage || !canonicalRuleDelegatesToChildren({ ...parent, text: parentPassage.text })) continue;
      const registeredChildren = catalog.filter(section => sameAuthority(parent, section) &&
        String(section.sectionNumber).startsWith(parent.sectionNumber + '.') &&
        /^\d+$/.test(String(section.sectionNumber).slice(parent.sectionNumber.length + 1)));
      const children = registeredDelegatedRuleChildren({ ...parent, text: parentPassage.text },
        registeredChildren.flatMap(section => bySection.get(identity(section)) || []), registeredChildren, question);
      if (children.length) groups.set(identity(parent), { parent: { ...parent, sectionID: identity(parent) }, parentPassage, children });
    }
  }
  return [...groups.values()].sort((left, right) => researchCurrentRuleDetailScore(right.children[0].boundChildPassage, question) -
    researchCurrentRuleDetailScore(left.children[0].boundChildPassage, question)).slice(0, 1);
}
