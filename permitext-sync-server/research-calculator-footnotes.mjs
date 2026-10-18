const compact = value => String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const uncertain = value => /\b(?:unknown|unsure|not sure|uncertain|don't know|do not know|maybe|might|hypothetical|for example|assuming|assume|unconfirmed|not confirmed)\b/i.test(value);

export const calculatorFootnoteSchema = {type:'array',maxItems:5,items:{type:'object',additionalProperties:false,
  properties:{marker:{type:'string',enum:['a','b','c','d','e']},
    status:{type:'string',enum:['applies','not_applicable','needs_information']},reason:{type:'string'},
    factQuotes:{type:'array',maxItems:4,items:{type:'object',additionalProperties:false,
      properties:{origin:{type:'string',enum:['conversation','work']},quote:{type:'string'}},required:['origin','quote']}},
    question:{type:['string','null']}},required:['marker','status','reason','factQuotes','question']}};

export function calculatorSourceFootnotes(source) {
  const body = compact(source.text || source.canonicalText);
  const matches = [...body.matchAll(/(?:^|\s)([a-e])\.\s+(?=[A-Z])/g)];
  const notes = {};
  matches.forEach((match,index) => {
    const marker=match[1];
    if (Object.hasOwn(notes,marker)) {notes[marker]=null;return;}
    notes[marker]=compact(body.slice(match.index+match[0].length,matches[index+1]?.index ?? body.length));
  });
  return notes;
}

// The model chooses an interpretation. Code binds its source and factual quotes;
// the existing full-answer reviewer still decides substantive support.
export function normalizeCalculatorFootnotes(items, source, factor, context = {}) {
  if (!Array.isArray(items) || !factor) return [];
  const notes=calculatorSourceFootnotes(source);
  const markers=new Set(['a',...(factor.quote.match(/\b[a-e]\b/g)||[])]);
  const statements=[...(context.messages||[]).filter(m=>m.role==='user').map(m=>m.question),context.question]
    .filter(s=>typeof s==='string').map(compact);
  const work=(context.calculatorWorkFacts||[]).filter(s=>typeof s==='string').map(compact);
  const seen=new Set(),result=[];
  for(const item of items.slice(0,5)) {
    if (!item || seen.has(item.marker) || !markers.has(item.marker) || !notes[item.marker] ||
      !['applies','not_applicable','needs_information'].includes(item.status)) continue;
    const reason=compact(item.reason),question=compact(item.question);
    if (!reason || reason.length>600 || (item.status==='needs_information' && (!question || question.length>300))) continue;
    const facts=[];let invalid=false;
    for(const fact of Array.isArray(item.factQuotes)?item.factQuotes:[]) {
      const quote=compact(fact?.quote),origin=fact?.origin;
      const records=origin==='conversation'?statements:origin==='work'?work:[];
      const index=records.findLastIndex(s=>s.includes(quote));
      if (!quote || quote.length>500 || uncertain(quote) || index<0) {invalid=true;break;}
      if (item.status!=='needs_information' && origin==='conversation' && statements.slice(index+1)
        .some(s=>/\b(?:correction|actually|instead|no longer|not confirmed|not sure|unknown)\b/i.test(s))) {invalid=true;break;}
      facts.push({origin,quote});
    }
    if (invalid || facts.length>4 || (item.marker!=='a' && item.status!=='needs_information' && !facts.length)) continue;
    // Unit footnote a is not a project prerequisite.
    if (item.marker==='a' && item.status!=='applies') continue;
    seen.add(item.marker);
    result.push({marker:item.marker,sourceID:source.sourceID || `section-${source.sectionID}`,
      footnoteText:notes[item.marker],status:item.status,reason,factQuotes:facts,
      question:item.status==='needs_information'?question:null});
  }
  return result;
}

export const calculatorFootnoteInstruction = 'For occupantLoadDraft.footnoteChecks, assess only the footnotes actually attached to the selected factor row, including the unit note a. Include the footnote markers in the exact factor row quote. Return [] when the row or footnote text is unavailable. Reuse current explicit conversation statements and the separately supplied calculatorWorkFacts; never use a prior Assistant claim, missing information, an uncertain/hypothetical fact, or an existing-site record as proof of a proposed design. Respect later corrections and space identity. For each footnote use applies, not_applicable or needs_information, a short explanation, and verbatim factQuotes with origin conversation or work. Do not repeat the legal text: code attaches the canonical footnote. Non-unit resolved decisions need explicit supporting fact quotes. Applies means the footnote governs, not that its conditions or approval requirements are satisfied. Ask a short specific question only for genuinely missing facts that could affect this calculation or its applicability; put that question in question and in the ordinary followUpQuestions/missingFacts. For resolved notes question must be null. Do not ask again for facts already stated. Do not turn a unit definition or an unused optional deduction into a required question. Never automatically deduct area, change the table factor, declare compliance or assert DOB/professional approval. Explain any required professional judgment or approval in the ordinary cited answer. Arithmetic remains independent of these assessments.';
export const calculatorFootnoteReviewInstruction = 'Review every footnoteChecks item as part of the full answer. Check the exact cited edition, selected row and its actual footnote markers, canonical scope, supporting current user/Work quotes, later corrections and the identity of the space. Reject an invented source/fact, a not_applicable decision inferred from absent facts, stale or hypothetical support, existing-record facts transferred to proposed work, a necessary condition omitted from needs_information, an already-answered question, an unused optional deduction made mandatory, or a claim that applicability proves approval/compliance. Use the existing unsupported_requirement, misstated_provision and missed_material_conclusion findings. The calculator may show arithmetic while footnotes remain unresolved; never treat its arithmetic as a verified legal conclusion.';
