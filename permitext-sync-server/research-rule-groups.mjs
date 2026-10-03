import { createHash } from 'node:crypto';
import { researchCurrentRuleDetailScore } from './research-rule-packets.mjs';
import { researchPassagesForSection } from './research-passage-index.mjs';

export const researchRuleGroupVersion = '20261003-bounded-canonical-rule-groups-v2';
const fields = ['codePrefix', 'corpusID', 'codeVersion', 'codeEdition', 'jurisdiction'];
const identity = value => String(value?.sectionID || value?.id || '');
const compact = value => String(value || '').replace(/\s+/g, ' ').trim();
const sameAuthority = (left, right) => fields.every(key => left?.[key] && left[key] === right?.[key]);

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
