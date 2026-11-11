import assert from 'node:assert/strict';
import {constructionHTMLBodyForSection} from '../construction-html-content.mjs';
import {prepareSavedEvidenceItems} from '../report-evidence.mjs';
import PDFDocument from 'pdfkit';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {drawReportTable,renderReportPDF} from '../report-pdf.mjs';
import {immutableReportManifest} from '../report-contract.mjs';
import {writeFile} from 'node:fs/promises';
import {reportItemPreview,reportResearchPlainText,reportEvidenceDisplayText} from '../report-presentation.mjs';

assert.equal(reportResearchPlainText('## Conditions\n\n**Verify** occupancy.\n### Limits ###\nKeep section #1020.'),
  'Conditions\n\nVerify occupancy.\nLimits\nKeep section #1020.');
const research=reportItemPreview({kind:'researchAnswer',explanation:'## Conditions\n**Verify** occupancy.'});
assert.equal(research[0].text,'Conditions\nVerify occupancy.');
const facts=reportItemPreview({kind:'projectFacts',facts:['Stories: 14','Units: 175'].map(value =>
  `Building / Code Fact — ${value} (unverified; obtain records). Original user/source wording: Same inventory source.`).join('\n\n')});
assert.equal(facts.map(part=>part.text).join('\n').match(/Same inventory source/g).length,1);
assert.match(facts[0].text,/Stories: 14 \[1\] \[2\]/);
assert.match(facts[0].text,/Units: 175 \[1\] \[2\]/);
const evidence='intervening rooms.Where the path of egress travel';
assert.equal(reportEvidenceDisplayText(evidence),'intervening rooms. Where the path of egress travel');
assert.equal(reportItemPreview({kind:'evidence',passageText:evidence})[0].text,reportEvidenceDisplayText(evidence));

const section={id:1,chapterID:1,chapterNumber:'10',codePrefix:'BC',sectionNumber:'1020.1.1',title:'Interior corridors'};
const body=await constructionHTMLBodyForSection(section);
const prepared=await prepareSavedEvidenceItems({selections:[{sectionID:'1',codeVersion:'2022'}],
 resolveSource:async()=>({section,body,source:{canonicalEdition:'2022',editionLabel:'2022'}})});
assert.equal(prepared.items[0].tables[0].headerRowCount,2,'Both actual interior-corridor header rows survive extraction');
const regressionItems=[];
for(const number of ['1006.2.1','1104.3.1']){
 const sourceSection={id:regressionItems.length+2,chapterID:1,chapterNumber:number.startsWith('11')?'11':'10',codePrefix:'BC',sectionNumber:number,title:number==='1006.2.1'?'Spaces with one exit':'Employee work areas'};
 const sourceBody=await constructionHTMLBodyForSection(sourceSection);
 const extracted=await prepareSavedEvidenceItems({selections:[{sectionID:String(sourceSection.id),codeVersion:'2022'}],resolveSource:async()=>({section:sourceSection,body:sourceBody,source:{canonicalEdition:'2022',editionLabel:'2022'}})});
 regressionItems.push(extracted.items[0]);
}
assert(regressionItems[0].tables[0].cellSpans.some(span=>span.colSpan===3));
assert(regressionItems[0].tables[0].cellSpans.some(span=>span.rowSpan===4));
assert.match(regressionItems[1].passageText,/27\.9 m²\)/);
assert.doesNotMatch(regressionItems[1].passageText,/m\n|m ²/);
const manifest=immutableReportManifest({project:{id:'qa',name:'TEST ONLY — eleven production fixes'},draftID:'qa',title:'Merged source headers and superscript verification',reportDate:new Date().toISOString(),createdAt:new Date().toISOString(),author:{userID:'qa',displayName:'Workflow QA'},codeEdition:'2022 NYC Building Code',items:regressionItems,reportVersion:1});
const realPDF=await renderReportPDF(manifest);
if(process.env.PERMITEXT_SOURCE_QA_PDF)await writeFile(process.env.PERMITEXT_SOURCE_QA_PDF,realPDF);
const realParsed=await getDocument({data:new Uint8Array(realPDF),useSystemFonts:true}).promise;
let realText='';for(let n=1;n<=realParsed.numPages;n++)realText+=(await(await realParsed.getPage(n)).getTextContent()).items.map(item=>item.str).join(' ')+'\n';
assert.match(realText,/27\.9 m²\)/);
assert.equal(realText.replace(/\s+/g,' ').match(/Maximum Common Path of Egress Travel Distance/g)?.length,1,'A merged header prints once, rather than once per covered column');
await realParsed.destroy();

const doc=new PDFDocument({size:'LETTER',margins:{top:54,bottom:54,left:54,right:54}});
const chunks=[];doc.on('data',chunk=>chunks.push(chunk));
const done=new Promise(resolve=>doc.on('end',resolve));
doc.font('Helvetica').fontSize(8);doc.y=600;
const rows=[['OCCUPANCY','RATING'],['Use group','Without sprinklers'],
 ...Array.from({length:65},(_,i)=>[`ROW-${String(i).padStart(3,'0')} ${'Long description '.repeat(i%5)}`,String(i)])];
drawReportTable(doc,{rows,headerRowCount:2},54,504);
doc.end();await done;
const pdf=await getDocument({data:new Uint8Array(Buffer.concat(chunks)),useSystemFonts:true}).promise;
assert(pdf.numPages>=3,'Exercise multiple continuation pages');
const texts=[];
for(let page=1;page<=pdf.numPages;page++) {
 const text=(await (await pdf.getPage(page)).getTextContent()).items.map(item=>item.str).join(' ');
 assert.match(text,/OCCUPANCY/);assert.match(text,/Without sprinklers/,'Both header levels repeat');
 texts.push(text);
}
const all=texts.join(' ');
for(let i=0;i<65;i++)assert.equal(all.match(new RegExp(`ROW-${String(i).padStart(3,'0')}`,'g'))?.length,1,'Every body row occurs exactly once');
await pdf.destroy();
console.log('Report polish passed: clean Markdown, shared fact provenance, whitespace-only display correction, repeated multi-row PDF headers and complete unique data rows.');
