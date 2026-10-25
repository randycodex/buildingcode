import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {renderReportPDF} from '../report-pdf.mjs';
import {createHash} from 'node:crypto';
// Inspect the printed graphics as well as text: an opaque path can erase glyphs
// even though PDF text extraction still reports every citation correctly.
async function inspect(bytes) {
 const pdf=await getDocument({data:new Uint8Array(bytes),useSystemFonts:true}).promise;
 let overlaps=0,citations=0;
 for(let n=2;n<=pdf.numPages;n++) {
  const page=await pdf.getPage(n),height=page.view[3],content=await page.getTextContent(),ops=await page.getOperatorList();
  const text=content.items.filter(t=>t.str.startsWith('- BC'));
  for(const [index,item] of content.items.entries()) if(item.str.startsWith('Evidence linked to '))
   assert(content.items.slice(index+1).some(t=>t.str.startsWith('- BC')),'An evidence-list heading must stay with at least its first citation.');
  citations+=text.length;
  for(let i=0;i<ops.fnArray.length-1;i++) {
   if(ops.fnArray[i]!==OPS.setFillRGBColor||ops.argsArray[i][0]!=='#ffffff'||ops.fnArray[i+1]!==OPS.constructPath)continue;
   const bounds=ops.argsArray[i+1][2];if(!bounds)continue;
   for(const t of text){const [x,y]=[t.transform[4],height-t.transform[5]];
    if(bounds[0]<x+t.width&&bounds[2]>x&&bounds[1]<y+t.height*.25&&bounds[3]>y-t.height) overlaps++;
   }
  }
 }
 const pages=pdf.numPages;await pdf.destroy();return {overlaps,citations,pages};
}
const label='BC · 2022 · § 1004.1.3 · Areas without fixed seating.';
const items=[];
for(let n=0;n<9;n++) items.push({kind:'paragraph',reportTitle:`Authored Note ${n}`,sourceClassification:'user-authored',
 text:'Retained authored reasoning and exact linked evidence. '.repeat(5+n%3),
 derivedFrom:{kind:'notebookCard',id:`note-${n}`,title:`Authored Note ${n}`,version:7},
 evidenceLinks:Array.from({length:3},(_,i)=>({id:`link-${n}-${i}`,label}))},
 {kind:'notebookCard',title:`Following calculation ${n}`,cardType:'calculation',sourceClassification:'user-authored',plainText:'6000 gross ft² ÷ 100 ft²/person = 60 people. Verify source applicability.'});
const manifest={id:'evidence-spacing-proof',title:'Evidence-list spacing proof',project:{name:'Synthetic proposed office'},
 author:{displayName:'Synthetic tester'},createdAt:'2026-10-24T12:00:00Z',reportDate:'2026-10-24T12:00:00Z',reportVersion:1,items};
manifest.disclaimers=['Verify enacted sources and stated assumptions before professional use.'];
manifest.contentHash=createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
const before=JSON.stringify(manifest),bytes=await renderReportPDF(manifest),result=await inspect(bytes);
assert.equal(JSON.stringify(manifest),before,'Rendering preserves original Note, evidence and snapshot data.');
assert.equal(result.citations,27,'Every linked citation remains printed across page boundaries.');
assert.equal(result.overlaps,0,'Following sources must never paint opaque white paths over evidence citations.');
if(process.env.PERMITEXT_PDF_BASELINE_PATH){const baseline=await inspect(await readFile(process.env.PERMITEXT_PDF_BASELINE_PATH));assert(baseline.overlaps>0,'The regression detector catches the original production overpaint.');console.log({baseline});}
if(process.env.PERMITEXT_LAYOUT_PROOF_DIR){await mkdir(process.env.PERMITEXT_LAYOUT_PROOF_DIR,{recursive:true});await writeFile(`${process.env.PERMITEXT_LAYOUT_PROOF_DIR}/evidence-spacing-fixed.pdf`,bytes);}
console.log('PDF evidence spacing passed:',result);
