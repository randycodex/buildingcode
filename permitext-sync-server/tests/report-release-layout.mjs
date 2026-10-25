import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {renderReportPDF} from '../report-pdf.mjs';
import {reportItemPreview} from '../report-presentation.mjs';
import {updateSourceFormatting} from '../public/report-source-formatting.js';

const items=[];
for(let index=0;index<12;index++) {
  items.push({kind:'paragraph',text:('Existing project analysis. '.repeat(4+index%4)+'\n\n').repeat(2),sourceClassification:'user-authored'});
  items.push({kind:'heading',text:`Verification heading ${index}`,headingLevel:2});
  items.push({kind:'paragraph',text:`Verification body ${index}. Confirm the occupancy record and stated assumptions before any design conclusion.`});
  items.push({kind:'notebookCard',cardType:'calculation',title:`Office calculation ${index}`,sourceClassification:'user-authored',plainText:
    `Business area\n4500 gross sq ft\n100 gross sq ft per person\n4500 ÷ 100 = 45 people\nCalculation result ${index}\nNo fixed seating; verify the selected function and footnotes.`});
}
items.push({kind:'researchAnswer',reportTitle:'Indoor office footnote review',question:'A full original question that should remain in the saved manifest but be omitted from the concise export. '.repeat(3),
  includeResearchMetadata:false,sourceClassification:'ai-assisted',conclusion:'The stated calculation concerns an indoor office.',
  explanation:'The stated calculation concerns an indoor office.',assumptions:['Indoor office use is user-stated.'],
  limitations:['This does not establish approved occupancy.'],missingFacts:['Obtain the occupancy record.'],additionalEvidenceNeeded:['Review the full footnotes.'],
  codeBasis:{disclosure:'Included passages only; no additional sources searched',pinnedCorpora:[{label:'2022 Building Code',codeEdition:'2022 NYC Building Code'}]},citations:[]});
const compact=items.at(-1);
compact.sourceFormatting=updateSourceFormatting([],reportItemPreview(compact).find(part=>part.label==='Conclusion'),[0,10],'bold');
const detailed={...compact,reportTitle:'Styled detailed finding',includeResearchMetadata:true,question:'Detailed question preservation marker. Retain this full question when details are selected.',
  conclusion:'Different full-detail conclusion.',explanation:'Additional explanation preserved.'};
detailed.sourceFormatting=updateSourceFormatting([],reportItemPreview(detailed).find(part=>part.label==='Conclusion'),[0,9],'bold');
items.push(detailed);
items.push({kind:'paragraph',reportTitle:'Corridor rating — provisional analysis',text:'Retained Note wording, qualifications and original evidence links.',
  derivedFrom:{kind:'notebookCard',id:'note',title:'Corridor rating — provisional analysis',version:1},evidenceLinks:[]});
const manifest={id:'synthetic-layout-proof',title:'Release layout verification',project:{name:'Synthetic office renovation'},reportDate:'2026-10-24T12:00:00Z',
  author:{displayName:'Synthetic tester'},reportVersion:1,createdAt:'2026-10-24T12:00:00Z',codeEdition:'2022 NYC Building Code',
  disclaimers:['Verify enacted text and project applicability before professional use.'],items};
manifest.contentHash=createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
const before=JSON.stringify(manifest),bytes=await renderReportPDF(manifest);
assert.equal(JSON.stringify(manifest),before,'Pagination and display never rewrite the saved manifest.');
const pdf=await getDocument({data:new Uint8Array(bytes),useSystemFonts:true}).promise;
const pages=[];
for(let page=1;page<=pdf.numPages;page++) pages.push((await(await pdf.getPage(page)).getTextContent()).items.map(item=>item.str).join(' '));
for(let index=0;index<12;index++) {
  const heading=pages.findIndex(page=>page.includes(`Verification heading ${index} `));
  const body=pages.findIndex(page=>page.includes(`Verification body ${index}.`));
  assert.equal(heading,body,`Heading ${index} stays with its first paragraph.`);assert(heading>0);
  const title=pages.findIndex(page=>page.includes(`Office calculation ${index} `));
  const result=pages.findIndex(page=>page.includes(`Calculation result ${index} `));
  assert.equal(title,result,`Compact calculation ${index} stays together.`);assert(title>0);
}
const all=pages.join(' ').replace(/\s+/g,' ');
assert.match(all,/Indoor office footnote review/);assert.match(all,/no additional sources searched/);
assert.match(all,/does not establish approved occupancy/);assert.match(all,/Corridor rating/);
assert(!all.includes('A full original question'),'Concise export preserves the question only in the manifest.');
assert.match(all,/Detailed question preservation marker/,'A custom title must not hide the full question when details and source formatting are selected.');
assert.equal(all.match(/The stated calculation concerns an indoor office\./g).length,1,'Only an exact duplicate block is omitted.');
await pdf.destroy();
if(process.env.PERMITEXT_LAYOUT_PROOF_DIR){await mkdir(process.env.PERMITEXT_LAYOUT_PROOF_DIR,{recursive:true});await writeFile(`${process.env.PERMITEXT_LAYOUT_PROOF_DIR}/report-layout.pdf`,bytes);}
console.log(`Report layout passed across ${pages.length} rendered PDF pages: 12 heading/body pairs, 12 complete calculations, concise finding, exact-duplicate display and immutable source manifest.`);
