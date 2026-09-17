import {createHash} from 'node:crypto';
import {auditZoningApplicability} from '../audit-zoning-definition-applicability.mjs';

export const reviewedZoningApplicationSHA256='1d319b4f9d1c94cfe416d5b97ba529774ae0d22582c311e700a8016a1c719b83';

// Explicit singular/plural labels attested in the reviewed II-3 source.
export const reviewedZoningTerms = Object.freeze({
  'floor area ratio':['floor area ratios'],
  'building':['buildings'],
  'building or other structure':['buildings or other structures'],
  'lot area':[], 'lot width':[], 'lot coverage':['lot coverages'],
  'street wall':['street walls'], 'street line':['street lines'],
  'story':['stories'], 'yard':['yards'], 'base plane':['base planes'],
  'curb level':[], 'dwelling unit':['dwelling units'],
});

// Retain every authored applicability container, including identical meanings
// printed in different scopes. Unknown/excluded scopes are evidence, not grants.
export function bindZoningApplicability(book, definitionHTML, applicationHTML) {
  if(book.bundle!=='2026-zoning-resolution'||book.codeSectionID!==1||book.chapter!=='I-2')
    throw Error('Reviewed Zoning source identity changed');
  const audit=auditZoningApplicability(definitionHTML);
  if(createHash('sha256').update(applicationHTML).digest('hex')!==reviewedZoningApplicationSHA256)
    throw Error('Reviewed Zoning II-3 application source changed; review required');
  if(!definitionHTML.includes('words used in the singular number shall include the plural'))
    throw Error('Zoning singular/plural source rule changed; review required');
  const covered=new Set();
  const terms=book.terms.map(term=>{
    const containers=audit.definitions.filter(d=>d.term===term.term&&d.bodies.some(body=>body.text===term.text));
    if(!containers.length)throw Error('Zoning definition lost its applicability source: '+term.term);
    containers.forEach(d=>covered.add(d.index));
    const sourceApplicability=containers.map(d=>({containerIndex:d.index,scopeType:d.scopeType,
      labels:d.applicability,excludedBySourceClass:d.excludedBySourceClass,sourceLine:d.sourceLine}));
    const scoped={...term,sourceApplicability};
    if(!Object.hasOwn(reviewedZoningTerms,term.term))return scoped;
    if(containers.length!==1||containers[0].scopeType!=='global'||containers[0].excludedBySourceClass
      ||containers[0].applicability.join('')!=='General Definition')
      throw Error('Reviewed Zoning applicability changed: '+term.term);
    // §12-10 limits defined meanings to authored italic uses. §12-01(d)
    // permits singular/plural equivalence; only the reviewed II-3 uses are enabled.
    return {...scoped,applicability:'definition-chapter',requiresItalic:true,
      applicableChapters:['II-3'],aliases:[...new Set([...(term.aliases||[]),...reviewedZoningTerms[term.term]])]};
  });
  if(covered.size!==audit.definitions.length)throw Error('Zoning applicability containers were omitted');
  for(const label of Object.keys(reviewedZoningTerms)) {
    if(terms.filter(t=>t.term===label).length!==1)throw Error('Reviewed Zoning identity changed: '+label);
  }
  return terms;
}
