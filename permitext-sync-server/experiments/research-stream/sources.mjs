import { parseFragment } from 'parse5';
import { allSectionCatalogByID, researchBodyForCatalogSection, openAIResearchWebSupport } from '../../app.mjs';
import { researchWebSupportTrigger, defaultResearchOfficialDomains } from '../../research-source-policy.mjs';
import { bindResearchWebSupportToOfficialDocuments } from '../../research-official-html-attribution.mjs';

function plain(node) {
  if (['script', 'style', 'annotationdrawer'].includes(node.nodeName)) return '';
  if (node.nodeName === '#text') return node.value;
  const text = (node.childNodes || []).map(plain).join('');
  if (['td', 'th'].includes(node.nodeName)) return `${text}\t`;
  if (['div', 'p', 'tr', 'br', 'li'].includes(node.nodeName)) return `${text}\n`;
  return text;
}
export async function catalog() {
  return [...new Map([...(await allSectionCatalogByID()).values()].filter(s => s.codePrefix === 'BC' && /^\d+$/.test(String(s.id)) && Number(s.id) < 100000).map(s => [String(s.id), s])).values()];
}
export async function librarySources(sectionIDs) {
  if (!Array.isArray(sectionIDs) || !sectionIDs.length || sectionIDs.length > 3) throw new Error('Select one to three library passages.');
  const byID = new Map((await catalog()).map(s => [String(s.id), s]));
  return Promise.all([...new Set(sectionIDs.map(String))].map(async (id, i) => {
    const section = byID.get(id);
    if (!section) throw new Error('The passage is outside this prototype’s 2022 NYC Building Code library.');
    const body = await researchBodyForCatalogSection(section);
    if (body.truncated || (body.blocks || []).some(b => b.truncated || b.researchClaimEligible === false)) throw new Error('The complete passage is unavailable.');
    if ((body.blocks || []).some(b => b.kind === 'image' || /<img\b/i.test(b.html || ''))) throw new Error('This passage includes visual evidence; the text-only prototype cannot interpret it completely.');
    const text = (body.blocks || []).map(b => b.html ? plain(parseFragment(b.html)) : b.plainText || '').join('\n\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!text || text.length > 80000) throw new Error('This passage exceeds the prototype’s complete-text limit.');
    return { id: `S${i + 1}`, sectionID: id, title: `BC ${section.title}`, edition: '2022 NYC Building Code',
      authority: 'enacted', url: `https://permitext.com/open/section/${encodeURIComponent(id)}`, text };
  }));
}
export async function prepareSources({ question, sectionIDs, facts = '', live, signal, emit }) {
  const started = performance.now();
  const sources = await librarySources(sectionIDs);
  await emit({ type: 'sources', sources, stage: 'library' });
  const decision = researchWebSupportTrigger({ question, pinnedEvidenceCount: sources.length,
    enactedEvidence: sources, projectFactsApplied: Boolean(facts.trim()) });
  const web = { requested: decision.useWeb, searched: false, reasons: decision.reasons, sources: 0 };
  if (decision.useWeb) {
    if (!live) throw new Error('Official website retrieval requires Live mode; the offline demonstration does not simulate it.');
    await emit({ type: 'status', text: 'Reading official supporting sources…' });
    const workflow = decision.workflow;
    let support = workflow?.directDocumentRetrieval
      ? { sources: workflow.sources, searched: true, retrievalMethod: 'official_workflow_catalog' }
      : await openAIResearchWebSupport(question, 'local-stream-prototype', {
          model: 'gpt-6-luna', requireAttributableSources: true, signal });
    web.searched = support.searched === true;
    web.retrievalMethod = support.retrievalMethod || 'official_web_search';
    support = await bindResearchWebSupportToOfficialDocuments(support, {
      question, officialDomains: defaultResearchOfficialDomains,
      ...(workflow?.directDocumentRetrieval ? { requiredPassageTerms: workflow.passageTerms } : {}),
      maximumSources: 3, signal });
    for (const source of support.sources || []) {
      const text = (source.attributedClaims || []).map(c => c.verbatimText || c.text || '').filter(Boolean).join('\n\n');
      if (!text) continue;
      sources.push({ id: `W${++web.sources}`, title: source.title || source.url, edition: 'Retrieved official guidance',
        authority: 'supporting_guidance_not_enacted_code', url: source.url, text });
    }
    if (!web.sources) throw Object.assign(new Error('No attributable official passage was retrieved. Add the needed source or narrow the question.'), {
      retrieval: { ...web, validation: support.sourceValidation || null } });
    await emit({ type: 'sources', sources, stage: 'official_web' });
  }
  return { sources, web, retrievalMs: Math.round(performance.now() - started) };
}
