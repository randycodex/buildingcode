import assert from 'node:assert/strict';
import {reportItemPreview} from '../report-presentation.mjs';
const rows=[['Use','Value'],['R','1']];
const tableText=rows.map(row=>row.join(' | ')).join('\n');
const evidence=reportItemPreview({kind:'evidence',passageText:`Before\n${tableText}\nFinal exception`,tables:[{text:tableText,rows}]});
assert.deepEqual(evidence,[{kind:'text',label:'',text:'Before'},{kind:'table',rows},{kind:'text',label:'',text:'Final exception'}]);
const research=reportItemPreview({kind:'researchAnswer',question:'A complete question',conclusion:'Conditional conclusion',
  assumptions:['Unverified assumption'],missingFacts:['Missing fact'],limitations:['Evidence limit'],
  additionalEvidenceNeeded:['Obtain records'],codeEdition:'2022',
  citations:[{sectionID:'s',sectionNumber:'1020.2',codePrefix:'BC'}],disclaimer:'Review required'});
for(const label of ['Question','Research basis','Conclusion','Assumptions','Project facts to verify','Limits of this answer','Additional evidence needed','Citations','Professional-use notice']) {
  assert(research.some(part=>part.label === label),`Missing preview boundary: ${label}`);
}
assert(research.find(part=>part.label === 'Citations').text.includes('1020.2'));
assert.equal(reportItemPreview({kind:'projectFacts',address:'A',facts:'F'.repeat(4000)})[1].text.length,4000);
console.log('Complete Report previews retain table columns, final conditions, long facts, Research boundaries and citations.');
