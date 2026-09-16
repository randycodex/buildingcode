import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const registryText=await readFile(new URL('../public/reader-definition-registry.json',import.meta.url),'utf8');
const registry=JSON.parse(registryText);
const audit=JSON.parse(await readFile(process.argv[2] || '/tmp/permitext-definition-occurrences.json','utf8'));
const hash=createHash('sha256').update(registryText).digest('hex');
if(audit.registrySHA256!==hash) throw new Error('Occurrence audit is stale or lacks registry identity; regenerate it before reporting coverage.');
const cell=value=>String(value??'').replace(/\|/g,'\\|').replace(/\s+/g,' ').trim();
const count=(entries,resolution)=>entries.filter(e=>e.resolution===resolution).length;
const measured=new Map(audit.unresolvedTerms.map(e=>[e.id,e.candidateOccurrences]));
const unresolved=registry.books.flatMap(b=>b.entries.filter(e=>['unresolved-reference','ambiguous-reference'].includes(e.resolution)).map(e=>({...e,bundle:b.bundle,code:b.code,scope:b.scope,candidateOccurrences:measured.get(e.id)||0}))).sort((a,b)=>b.candidateOccurrences-a.candidateOccurrences||a.id.localeCompare(b.id));
const lines=[
 '# Definition coverage review', '',
 'This is a local implementation inventory, not a claim that all definitions are complete or applicable in every context. Source wording is preserved; no meaning is invented for unresolved references.', '',
 `Registry SHA-256: \`${hash}\`.`, '',
 'Reproduce with `node scripts/audit-definition-occurrences.mjs` followed by `node scripts/report-definition-coverage.mjs` from `permitext-sync-server`.', '',
 '## Indexed definition sources', '',
 '| Collection | Code | Scope | Entries | Direct | Resolved | Alternatives | Unresolved |',
 '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |',
 ...registry.books.map(b=>`| ${cell(b.bundle)} | ${cell(b.code)} | ${cell(b.scope)} | ${b.entries.length} | ${count(b.entries,'direct')} | ${count(b.entries,'resolved-reference')} | ${count(b.entries,'multiple-definitions')} | ${count(b.entries,'unresolved-reference')+count(b.entries,'ambiguous-reference')} |`), '',
 '## Occurrence coverage and limits', '',
 `- ${audit.chapters.length} chapters mapped; ${audit.unmappedChapters.length} unmapped. Combined appendices are sliced by chapter.`,
 `- ${audit.chapters.reduce((n,c)=>n+c.candidateOccurrences,0).toLocaleString('en-US')} exact-term candidate occurrences outside definition chapters/sections. These are not verified rendered links or semantic applicability decisions.`,
 `- ${audit.unmatchedTerms.length} eligible entries have no measured occurrence. This can mean the term does not recur, a spelling/inflection differs, or matching remains incomplete.`,
 '- Exact terms, explicit aliases and labels without MDL source-citation annotations are matched. Arbitrary plurals, abbreviations and grammatical variants are not inferred.',
 '- Existing links, source formatting, and definition chapters/sections are preserved. Occurrence counts can include text the UI deliberately leaves inside existing links.',
 '- Only explicit chapter restrictions currently encoded by the compiler are enforced. Other contextual limitations require review.',
 '- Section-specific administrative collections, external standards, and cross-collection edition currency remain incomplete. A code absent from the table is not covered by this index.',
 '- Native visual/touch and signed-in lifecycle acceptance remain separate from corpus and parser checks.', '',
 '## Unresolved references', '',
 'Sorted by candidate frequency. Frequency is a prioritization aid, not a justification for substituting another meaning. The references below retain their published wording until an exact applicable source is established.', '',
 '| Collection / code / scope | Term | Candidate uses | Published reference | Source |',
 '| --- | --- | ---: | --- | --- |',
 ...unresolved.map(e=>`| ${cell(`${e.bundle} / ${e.code} / ${e.scope}`)} | ${cell(e.term)} | ${e.candidateOccurrences} | ${cell(e.referenceText||e.text)} | ${cell(e.source.file)} § ${cell(e.source.sectionNumber)} |`), '',
 '## Acceptance still required', '',
 '- Review unmatched terms and scope restrictions against each definition chapter; extend matching only where source wording supports it.',
 '- Resolve available exact references; separately list unavailable external or mismatched-edition sources.',
 '- Verify pop-ups, source labels, dismissal and reading-position retention across web and native renderers, including tables and long definitions.',
 '- Verify first-load performance and physical-device touch behavior before declaring complete.', '',
];
const output=process.argv[3] || new URL('../../docs/PERMITEXT_DEFINITION_COVERAGE.md',import.meta.url);
await writeFile(output,lines.join('\n'));
console.log(`Wrote definition coverage report: ${registry.books.length} sources, ${unresolved.length} unresolved entries.`);
