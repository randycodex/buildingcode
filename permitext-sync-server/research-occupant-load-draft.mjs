import { occupantLoadSource } from './public/occupant-load-calculation.js';
import {calculatorFootnoteSchema,normalizeCalculatorFootnotes,calculatorFootnoteInstruction,calculatorFootnoteReviewInstruction} from './research-calculator-footnotes.mjs';

const humanFields = ['spaceFunction', 'area', 'areaBasis', 'seating'];
const valuesFor = {areaBasis: ['gross', 'net'], seating: ['without-fixed-seating', 'fixed-seating']};
const text = value => String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const decimal = value => /^(?:\d{1,10})(?:\.\d{1,6})?$/.test(value) && Number(value) > 0;
const containsNumber = (quote, value) => (quote.match(/\d[\d,]*(?:\.\d+)?/g) || [])
  .some(number => Number(number.replaceAll(',', '')) === Number(value));
const uncertain = quote => /\b(?:unknown|unsure|not sure|uncertain|don't know|do not know|maybe|might|hypothetical|for example|assuming|assume|not confirmed|unconfirmed)\b/i.test(quote);
const squareFeet = quote => /(?:\bsq\.?\s*(?:ft|feet)\b|\bsquare\s*(?:feet|foot)\b|\bft(?:2|²)\b)/i.test(quote);

export function occupantLoadDraftSchema(evidence = []) {
  const sourceIDs = evidence.filter(occupantLoadSource).map(source => source.sourceID || `section-${source.sectionID}`);
  if (!sourceIDs.length) return null;
  const field = key => ({anyOf: [{type: 'null'}, {type: 'object', additionalProperties: false,
    properties: {value: valuesFor[key] ? {type: 'string', enum: valuesFor[key]} : ['area', 'factor'].includes(key)
      ? {type: 'string', pattern: '^\\d{1,10}(?:\\.\\d{1,6})?$', description: 'Positive decimal digits only, e.g. 1500 or 100. Do not include commas, units or gross/net wording. Preserve those in the quote.'}
      : {type: 'string'}, quote: {type: 'string'}},
    required: ['value', 'quote']}]});
  return {anyOf: [{type: 'null'}, {type: 'object', additionalProperties: false,
    properties: {sourceID: {type: 'string', enum: sourceIDs},
      ...Object.fromEntries([...humanFields, 'factor'].map(key => [key, field(key)])),footnoteChecks:calculatorFootnoteSchema},
    required: ['sourceID', ...humanFields, 'factor','footnoteChecks']}]};
}

export const occupantLoadDraftInstruction = 'When the schema includes occupantLoadDraft, return null unless this answer actually discusses an occupant-load calculation under supplied 2022 BC 1004.1.3. Otherwise propose one space only. Copy spaceFunction, area in square feet, areaBasis and seating ONLY from explicit user statements in this conversation or the current calculatorWorkFacts, each with a short verbatim quote. Respect later corrections, negations, hypotheticals and which space each fact describes; do not fill ambiguous, conflicting, example-only, unknown or unstated inputs. Do not infer that a user area is gross or net from a code table. A factor is a suggestion from an exact cited enacted row: supply its exact sourceID and a verbatim row quote containing the function, factor and gross/net basis; preserve all applicable footnotes in the answer. A user-supplied factor or a prior assistant claim cannot substitute for this code evidence. Use null for each missing field. Never propose a reviewed/confirmed state, a computed result or compliance in the draft. The draft supplements, and never replaces, the fully cited and qualified answer. '+calculatorFootnoteInstruction;

export const occupantLoadDraftReviewInstruction = 'Also review occupantLoadDraft as proposed inputs, not confirmed facts. Check every human quote against the stated space and actual user conversation or separately supplied current Work facts, including later corrections, unknowns, negations and hypothetical scope. Check the factor quote against the exact bound enacted row, its function, units, gross/net basis and material footnotes. Reject an unsupported, stale, ambiguous or mismatched input using the existing unsupported_requirement or misstated_provision issue types. A review checkbox is never inferred. Apply all ordinary answer and citation checks unchanged. '+calculatorFootnoteReviewInstruction;

// Optional suggestions fail closed field by field. A bad suggestion cannot
// manufacture a project fact, source confirmation, or a calculator result.
export function normalizeOccupantLoadDraft(value, evidence, citations, context = {}) {
  if (!value || typeof value !== 'object') return null;
  const source = evidence.find(item => occupantLoadSource(item) &&
    String(item.sourceID || `section-${item.sectionID}`) === value.sourceID);
  if (!source || !citations.some(citation => String(citation.sectionID) === String(source.sectionID) &&
    citation.sourceIDs?.includes(value.sourceID))) return null;
  const statements = [...(context.calculatorWorkFacts || []), ...(context.messages || []).filter(message => message.role === 'user').map(message => message.question), context.question]
    .filter(item => typeof item === 'string').map(text);
  const result = {sourceID: value.sourceID, ...Object.fromEntries([...humanFields, 'factor'].map(key => [key, null]))};
  for (const key of humanFields) {
    const candidate = value[key];
    if (!candidate || typeof candidate.value !== 'string' || typeof candidate.quote !== 'string') continue;
    const quote = text(candidate.quote), input = candidate.value.trim();
    const statementIndex = statements.findLastIndex(statement => statement.includes(quote));
    if (!input || input.length > 300 || !quote || quote.length > 500 || uncertain(quote) || statementIndex < 0) continue;
    if (valuesFor[key] && !valuesFor[key].includes(input)) continue;
    if (key === 'spaceFunction' && !quote.toLowerCase().includes(text(input).toLowerCase())) continue;
    if (key === 'area' && (!decimal(input) || !containsNumber(quote, input) || !squareFeet(quote) || /\bnot\b[^.!?]{0,40}\d/i.test(quote))) continue;
    const later = statements.slice(statementIndex + 1);
    if (key === 'area' && later.some(statement => uncertain(statement) && /\b(?:area|size)\b/i.test(statement))) continue;
    if (key === 'areaBasis' && later.some(statement => uncertain(statement) && /\b(?:gross|net|basis)\b/i.test(statement))) continue;
    if (key === 'seating' && later.some(statement => uncertain(statement) && /\b(?:seats|seating)\b/i.test(statement))) continue;
    if (key === 'area' && later.some(statement => squareFeet(statement) && !containsNumber(statement, input))) continue;
    if (key === 'areaBasis' && later.some(statement => /\b(?:gross|net)\b/i.test(statement) && !new RegExp(`\\b${input}\\b`, 'i').test(statement))) continue;
    if (key === 'seating' && later.some(statement => /\bfixed (?:seats|seating)\b/i.test(statement))) continue;
    if (key === 'areaBasis' && !new RegExp(`\\b${input}\\b`, 'i').test(quote)) continue;
    if (key === 'seating' && !(input === 'without-fixed-seating' ? /\b(?:without|no) fixed (?:seats|seating)\b/i : /\b(?:has|with|have) fixed (?:seats|seating)\b/i).test(quote)) continue;
    result[key] = {value: input, quote};
  }
  const factor = value.factor;
  if (factor && typeof factor.value === 'string' && typeof factor.quote === 'string') {
    const quote = text(factor.quote), input = factor.value.trim();
    if (result.spaceFunction && result.seating?.value !== 'fixed-seating' && decimal(input) && quote && quote.length <= 500 && text(source.text).includes(quote) &&
      containsNumber(quote, input) && /\b(?:gross|net)\b/i.test(quote) && (!result.areaBasis || new RegExp(`\\b${result.areaBasis.value}\\b`, 'i').test(quote))) result.factor = {value: input, quote};
  }
  const footnotes=normalizeCalculatorFootnotes(value.footnoteChecks,source,result.factor,context);
  if(footnotes.length) {result.footnoteChecks=footnotes;result.footnoteWorkFacts=[...(context.calculatorWorkFacts||[])];}
  return [...humanFields, 'factor'].some(key => result[key]) ? result : null;
}
