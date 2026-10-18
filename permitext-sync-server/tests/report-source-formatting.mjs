import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {getDocument, OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {normalizeSourceFormatting, sourceFormattingRuns, sourceFormattingRanges, sourceTextStyles, updateSourceFormatting} from '../public/report-source-formatting.js';
import {immutableReportManifest, normalizeReportDraftBlock, normalizeReportManifestItem} from '../report-contract.mjs';
import {uniqueReportItems} from '../public/project-workflow.js';
import {reportItemPreview} from '../report-presentation.mjs';
import {renderReportPDF} from '../report-pdf.mjs';

const part={key:'evidence:text::0',text:'Original code text. Exception: retain this condition.'};
let formatting=[];
for (const style of sourceTextStyles) formatting=updateSourceFormatting(formatting,part,[0,8],style);
assert.deepEqual(sourceFormattingRuns(part,formatting)[0],{text:'Original',bold:true,italic:true,underline:true,strike:true,highlight:true});
assert.equal(sourceFormattingRuns(part,formatting).map(run=>run.text).join(''),part.text);
const removed=updateSourceFormatting(formatting,part,[2,6],'bold',true);
assert.deepEqual(sourceFormattingRanges(part,removed,'bold'),[[0,2],[6,8]]);
assert.deepEqual(sourceFormattingRanges(part,removed,'highlight'),[[0,8]],'Removing Bold retains other styles');
assert.deepEqual(sourceFormattingRanges({...part,text:'Completely revised words'},formatting),[]);
const whole={...part,text:`Introduction. ${part.text} Tail.`};
assert.deepEqual(sourceFormattingRanges(whole,formatting),[[14,22]],'Covered passages can safely rebase into their complete section');
assert.deepEqual(sourceFormattingRanges({...whole,text:`${part.text} ${part.text}`},formatting),[],'Ambiguous anchors never choose a guessed occurrence');
assert.deepEqual(sourceFormattingRanges({key:'notebookCard:text::0',text:whole.text},formatting),[],'Formatting cannot cross source kinds');
for (const range of [[-1,2],[0,999],[2,1],[1.5,2]]) assert.throws(()=>normalizeSourceFormatting([{...part,formats:{bold:[range]}}]),/range/);
assert.throws(()=>normalizeSourceFormatting([{...part,formats:{color:[[0,1]]}}]),/style/);
assert.throws(()=>normalizeSourceFormatting(Array(201).fill({...part,formats:{bold:[[0,1]]}})),/formatting/);
assert.throws(()=>normalizeSourceFormatting([{...part,formats:{bold:Array(1001).fill([0,1])}}]),/Too much/);
const draft=normalizeReportDraftBlock({id:'block',kind:'evidence',sourceID:'saved',label:'Saved passage',sourceFormatting:formatting});
assert.deepEqual(normalizeReportDraftBlock(JSON.parse(JSON.stringify(draft))),draft,'All five styles persist with the draft');

const evidence={id:'code',kind:'evidence',sectionID:'s',sectionNumber:'101.2',chapter:'1',title:'Scope',codeBook:'Building Code',codeEdition:'2022',
  sourceLibraryVersion:'2022',passageText:part.text,passageTextHash:createHash('sha256').update(part.text).digest('hex')};
const original=structuredClone(evidence);
const frozen=normalizeReportManifestItem({...evidence,sourceFormatting:formatting});
for (const key of ['passageText','passageTextHash','sourceLibraryVersion','codeEdition']) assert.equal(frozen[key],evidence[key]);
assert.deepEqual(evidence,original,'Report formatting must not mutate a source');
assert.deepEqual(frozen.sourceFormatting,formatting);
const overlap=uniqueReportItems([
  {id:'paragraph',kind:'evidence',sourceID:'paragraph',sourceFormatting:formatting},
  {id:'whole',kind:'evidence',sourceID:'whole'}
],[{id:'paragraph',kind:'evidence',sectionID:'s',sourceLibraryVersion:'2022',selectionBlockID:'p'},
  {id:'whole',kind:'evidence',sectionID:'s',sourceLibraryVersion:'2022',selectionBlockID:''}],block=>[{...evidence,id:block.id,passageText:block.id==='whole' ? whole.text : part.text}]);
assert.equal(overlap.length,1);
assert.deepEqual(sourceFormattingRanges(reportItemPreview(overlap[0])[0],overlap[0].sourceFormatting),[[14,22]]);

const rows=[['Use','Value'],...Array.from({length:80},(_,i)=>[`Row ${i+1}`,'same'])];
const tableText=rows.map(row=>row.join(' | ')).join('\n');
const tableEvidence={...evidence,id:'table',title:'Table test',passageText:`Before table.\n${tableText}\nFinal table condition.`,tables:[{text:tableText,rows,headerRowCount:1}]};
const tablePart=reportItemPreview(tableEvidence).find(part=>part.kind==='table');
const cell={key:`${tablePart.key}:1:1`,text:'same'};
let tableFormatting=[];
for (const style of sourceTextStyles) tableFormatting=updateSourceFormatting(tableFormatting,cell,[0,4],style);
assert(sourceFormattingRuns(cell,tableFormatting)[0].highlight);
assert(!sourceFormattingRuns({key:`${tablePart.key}:2:1`,text:'same'},tableFormatting)[0].highlight,'Matching cell text never spreads formatting to another cell');
const changedTable=reportItemPreview({...tableEvidence,tables:[{...tableEvidence.tables[0],rows:[...rows,['New','Row']]}]}).find(part=>part.kind==='table');
assert.notEqual(changedTable.key,tablePart.key,'Table content changes invalidate its cell anchors');
const repeated=reportItemPreview({...evidence,passageText:`${tableText}\n${tableText}`,tables:[{text:tableText,rows},{text:tableText,rows}]}).filter(part=>part.kind==='table');
assert.notEqual(repeated[0].key,repeated[1].key,'Identical repeated tables retain separate anchors');

const research={id:'research',kind:'researchAnswer',answerID:'answer',conversationID:'conversation',question:'Synthetic question?',conclusion:'Conditional conclusion.',
  assumptions:['Unverified assumption.'],missingFacts:['Missing project fact.'],limitations:['Evidence limitation.'],additionalEvidenceNeeded:['Obtain records.'],
  citations:[{sectionID:'s',sectionNumber:'101.2',codePrefix:'BC'}],codeEdition:'2022',authorityLabel:'Selected evidence',disclaimer:'Professional review required.',
  codeBasis:{disclosure:'Selected basis.',limitation:'Applicability unverified.',searchedCorpora:[{id:'bc',label:'Construction corpus',codeEdition:'2022',applicabilityStatus:'unverified'}]}};
const researchPart=reportItemPreview(research).find(part=>part.label==='Conclusion');
const researchFormatting=updateSourceFormatting([],researchPart,[0,11],'bold');
const note={id:'note',kind:'notebookCard',cardID:'note',cardType:'note',title:'Synthetic Note',plainText:'Complete Note text.'};
const notePart=reportItemPreview(note)[0];
const noteFormatting=updateSourceFormatting([],notePart,[0,8],'underline');
const facts={id:'facts',kind:'projectFacts',sourceID:'facts',title:'Synthetic facts',address:'Synthetic address',facts:'Project facts retained.'};
const factPart=reportItemPreview(facts).find(part=>part.label==='Project facts');
const factsFormatting=updateSourceFormatting([],factPart,[0,7],'italic');
const manifest=immutableReportManifest({id:'formatting',project:{id:'qa',name:'Source formatting verification'},draftID:'draft',title:'Source styles',reportDate:'2026-10-18',
  author:{userID:'qa',displayName:'Local verification'},codeEdition:'2022',reportVersion:1,disclaimers:[],items:[frozen,
    {...tableEvidence,sourceFormatting:tableFormatting},{...research,sourceFormatting:researchFormatting},
    {...note,sourceFormatting:noteFormatting},{...facts,sourceFormatting:factsFormatting}]});
assert.equal(manifest.items[0].passageText,evidence.passageText);
const serialized=JSON.stringify(manifest);
const pdf=await renderReportPDF(manifest);
assert.equal(JSON.stringify(manifest),serialized,'Export cannot rewrite its frozen manifest');
const doc=await getDocument({data:new Uint8Array(pdf),disableFontFace:true,useSystemFonts:false}).promise;
let text='',highlight=false,headers=0;
for (let i=1;i<=doc.numPages;i++) {
  const page=await doc.getPage(i),content=await page.getTextContent(),ops=await page.getOperatorList();
  text+=content.items.map(item=>item.str).join(' ')+' ';
  headers+=content.items.filter(item=>item.str==='Value').length;
  highlight ||=ops.argsArray.some(value=>value?.some?.(entry=>entry==='#f4d35e'));
  for (const item of content.items) if (item.str?.startsWith('Row ')) assert(item.transform[5]>30,'Styled table rows remain on the printable page');
}
text=text.replace(/\s+/g,' ');
for (const required of ['Original','Exception: retain this condition.','Row 80','Final table condition.','Conditional','Unverified assumption.','Missing project fact.',
  'Evidence limitation.','Obtain records.','BC','101.2','Construction corpus','Applicability: unverified','Professional review required.','Complete','Note text.','Project facts retained.']) assert(text.includes(required),`Lost source content: ${required}`);
assert(highlight,'PDF includes actual printed source highlighting');
assert(headers>1,'Styled table repeats headers when it crosses pages');
await doc.destroy();
const tablePDF=await getDocument({data:new Uint8Array(await renderReportPDF({...manifest,items:[manifest.items[1]]})),disableFontFace:true,useSystemFonts:false}).promise;
let tableHighlight=false;
const cellFonts=new Set();
for(let i=1;i<=tablePDF.numPages;i++) {
  const page=await tablePDF.getPage(i),ops=await page.getOperatorList();
  tableHighlight ||=ops.argsArray.some(value=>value?.some?.(entry=>entry==='#f4d35e'));
  for(const item of (await page.getTextContent()).items) if(item.str === 'same') cellFonts.add(item.fontName);
}
assert(tableHighlight,'A cell-only selection prints its highlight even without any marked paragraph');
assert(cellFonts.size>1,'Only the selected repeated table cell becomes bold');
await tablePDF.destroy();
// Verify underline/strike are printed even without a highlight mark.
const strokes=async styles=>{
  const item={...evidence,sourceFormatting:[{...part,formats:styles}]};
  const bytes=await renderReportPDF({...manifest,items:[normalizeReportManifestItem(item)]});
  const pdf=await getDocument({data:new Uint8Array(bytes),disableFontFace:true,useSystemFonts:false}).promise;
  let count=0;
  for(let i=1;i<=pdf.numPages;i++) count+=(await (await pdf.getPage(i)).getOperatorList()).fnArray.filter(op=>op===OPS.constructPath).length;
  await pdf.destroy(); return count;
};
assert((await strokes({underline:[[0,8]],strike:[[0,8]]}))>(await strokes({})), 'Underline and strikethrough print without requiring Highlight');
if(process.env.PERMITEXT_SOURCE_FORMATTING_PDF) await writeFile(process.env.PERMITEXT_SOURCE_FORMATTING_PDF,pdf);
console.log('Report source formatting passed: five styles, independent toggles, persistence, safe anchors, exact source identity, whole-section dedup, tables, Note/Research/facts and complete styled PDF export.');
