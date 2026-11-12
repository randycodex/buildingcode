import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {constructionHTMLBodyForSection} from '../construction-html-content.mjs';
import {prepareSavedEvidenceItems} from '../report-evidence.mjs';
import {renderReportPDF} from '../report-pdf.mjs';

globalThis.fetch=()=>{throw new Error('Pagination checks use bundled sources only.');};
const base={id:'p7-pagination',title:'Full code table export verification',project:{name:'Synthetic table audit'},
  reportDate:'2026-11-11T00:00:00Z',createdAt:'2026-11-11T00:00:00Z',author:{displayName:'Synthetic tester'},reportVersion:1,codeEdition:'2022',
  contentHash:'synthetic-test',disclaimers:[]};
for(const [codePrefix,sectionNumber,chapterNumber] of [['BC','1004.1.3','10'],['PC','403.1','4']]) {
  const section={id:`${codePrefix}-${sectionNumber}`,codePrefix,sectionNumber,chapterNumber,title:sectionNumber};
  const body=await constructionHTMLBodyForSection(section);
  assert(body,'Full bundled published body is available');
  const prepared=await prepareSavedEvidenceItems({selections:[{sectionID:section.id,codeVersion:'2022'}],
    resolveSource:async()=>({section,body,source:{canonicalEdition:'2022',editionLabel:'2022 Construction Codes'}})});
  const manifest={...base,items:prepared.items}, before=JSON.stringify(manifest);
  const bytes=await renderReportPDF(manifest);
  assert.equal(JSON.stringify(manifest),before,'Pagination never edits the immutable source or spans');
  const pdf=await getDocument({data:new Uint8Array(bytes),useSystemFonts:true}).promise;
  let text='';
  for(let p=1;p<=pdf.numPages;p++) {
    const page=await pdf.getPage(p), content=await page.getTextContent();
    for(const item of content.items) if(item.str.trim()) {
      assert(item.transform[5]>20 && item.transform[5]<page.view[3]-20,'Table text stays within printable bounds');
    }
    text+=content.items.map(item=>item.str).join(' ')+' ';
  }
  const normalized=text.replace(/\s+/g,'').toLowerCase();
  for(const table of prepared.items.flatMap(item=>item.tables || [])) {
    for(const cell of table.rows.flat()) for(const word of cell.match(/[\p{L}\p{N}]+/gu) || []) {
      assert(normalized.includes(word.toLowerCase()),`Lost table content: ${codePrefix} ${word}`);
    }
  }
  if(process.env.PERMITEXT_P7_PDF_DIR) {
    await mkdir(process.env.PERMITEXT_P7_PDF_DIR,{recursive:true});
    await writeFile(`${process.env.PERMITEXT_P7_PDF_DIR}/${codePrefix}-${sectionNumber}.pdf`,bytes);
  }
  console.log(`${codePrefix} ${sectionNumber}: complete table and footnotes exported across ${pdf.numPages} pages`);
  await pdf.destroy();
}
