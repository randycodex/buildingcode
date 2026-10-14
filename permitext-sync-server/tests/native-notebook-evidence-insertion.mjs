// Execute the native source snapshot builder, then normalize its actual JSON
// through the server contract to prove edition + exact text survive a save.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {normalizeNotebookEvidenceLinks} from '../notebook-contract.mjs';
const view=await readFile(new URL('../../NYC CC APP/permitext/Views/NotebookView.swift',import.meta.url),'utf8');
const models=await readFile(new URL('../../NYC CC APP/permitext/Models/ResearchNotebookModels.swift',import.meta.url),'utf8');
const helper=view.slice(view.indexOf('private enum NotebookReferenceEvidencePreparer {'));
const declarations=['NotebookEvidenceLink','NotebookEvidenceSource','NotebookEvidencePassage','NotebookEvidenceNoteTarget'].map(name=>{
 const start=models.indexOf(`struct ${name}:`); return models.slice(start,models.indexOf('\n}',start)+2);
}).join('\n');
const source=`import Foundation
${declarations}
${helper}
func make(_ text:String, code:String = "2014 NYC Building Code") throws -> NotebookEvidenceLink {
 try NotebookReferenceEvidencePreparer.makeLink(label:"BC 1001",projectID:"project",cardID:"note",codeName:code,
 codeVersion:"nyc-construction-codes-2014",codeEdition:"2014",sectionID:"42",sectionNumber:"1001",
 sectionTitle:"Exact historical section",officialText:text)
}
let text = "Complete authored text — never the saved bookmark preview.\\nSecond paragraph."
let link = try make(text)
precondition(link.source.codeVersion == "nyc-construction-codes-2014")
precondition(link.source.codeEdition == "2014")
precondition(link.passages[0].exact == text)
precondition(try NotebookReferenceEvidencePreparer.codePrefix(for:"1968 Building Code") == "BC68")
precondition(try NotebookReferenceEvidencePreparer.codePrefix(for:"Existing Building Code") == "EBC")
do { _ = try make("x",code:"Unknown corpus"); fatalError("Guessed an unknown code") }
catch NotebookReferenceEvidencePreparer.Failure.unsupportedCode {}
do { _ = try make(String(repeating:"😀",count:25_001)); fatalError("Oversize passage truncated or accepted") }
catch NotebookReferenceEvidencePreparer.Failure.passageTooLarge {}
do { _ = try make(" "); fatalError("Empty authored text accepted") }
catch NotebookReferenceEvidencePreparer.Failure.unavailable {}
print(String(data:try JSONEncoder().encode([link]),encoding:.utf8)!)
`;
const dir=await mkdtemp(join(tmpdir(),'permitext-reference-insertion-'));
try{
 await writeFile(join(dir,'verify.swift'),source.replaceAll('precondition(try NotebookReferenceEvidencePreparer.codePrefix(for:', 'precondition(try! NotebookReferenceEvidencePreparer.codePrefix(for:'));
 execFileSync('xcrun',['swiftc',join(dir,'verify.swift'),'-o',join(dir,'verify')]);
 const raw=JSON.parse(execFileSync(join(dir,'verify'),{encoding:'utf8'}));
 const saved=normalizeNotebookEvidenceLinks(raw);
 assert.deepEqual(saved[0].source,raw[0].source);
 assert.equal(saved[0].passages[0].exact,raw[0].passages[0].exact);
 assert.equal(saved[0].source.codeEdition,'2014');
 assert.match(view,/makeSearchReaderLibrary\(sourceVersion: savedVersion\)/);
 assert.match(view,/prepareCodeVersionForEvidence\(savedVersion\)/);
 assert.match(view,/referenceKind: "selectedPassage", referenceID: link.id/);
 console.log('PASS: exact native edition/source/passage survives server normalization; unknown corpus, oversized UTF-16 and empty text rejected.');
}finally{await rm(dir,{recursive:true,force:true});}
