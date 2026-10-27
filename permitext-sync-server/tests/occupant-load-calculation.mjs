import assert from 'node:assert/strict';
import {calculateOccupantLoad, occupantLoadSource, occupantLoadAnswerSource, calculationNoteBlocks} from '../public/occupant-load-calculation.js';
import {emptyNotebookDocument, normalizeNotebookCardPayload} from '../notebook-contract.mjs';
const input={spaceFunction:'Synthetic office test',area:'1200',factor:'100',areaBasis:'gross',factorBasis:'Synthetic table row',seating:'without-fixed-seating'};
assert.equal(calculateOccupantLoad(input).people,12);
assert.equal(calculateOccupantLoad({...input,area:'1201'}).people,13);
assert.equal(calculateOccupantLoad({...input,area:'10.1',factor:'0.1'}).people,101,'Decimal arithmetic must not round an exact quotient up spuriously.');
for(const patch of [{area:'0'},{factor:'0'},{factor:'-1'},{area:'Infinity'},{area:'1e8'},{area:'1.0000001'},{areaBasis:''},{seating:'fixed-seating'},{seating:''},{spaceFunction:''},{factorBasis:''},{area:'9999999999',factor:'0.000001'}]) {
 const result=calculateOccupantLoad({...input,...patch}); assert.equal(result.valid,false); assert.equal(result.people,null);
}
assert.equal(calculateOccupantLoad({...input,reviewed:false}).valid,true,'A source-confirmation checkbox must not gate the calculator.');
const customInput={...input,area:'1500',factor:'50',factorMode:'custom',tableFactor:'100',tableRowID:'bc-1004.1.3:Synthetic office test',customReason:'  Synthetic alternate design reference CALC-7.  '};
const custom=calculateOccupantLoad(customInput);
assert.equal(custom.valid,true);assert.equal(custom.people,30);assert.equal(custom.input.tableFactor,'100');
assert.equal(custom.input.customReason,'Synthetic alternate design reference CALC-7.');
assert.equal(calculateOccupantLoad({...customInput,factor:'75'}).people,20);
assert.equal(calculateOccupantLoad({...customInput,factor:'99'}).people,16);
for(const patch of [{customReason:''},{customReason:' '.repeat(5)},{customReason:'x'.repeat(2001)},{tableFactor:''},{tableRowID:''},{factorMode:'unrecognized'},{seating:'fixed-seating'}]) {
 assert.equal(calculateOccupantLoad({...customInput,...patch}).valid,false,'Invalid custom context cannot be saved.');
}
assert.equal(calculateOccupantLoad({...customInput,customReason:''}).previewPeople,30,'An explicitly custom preview updates while its reason is being entered.');
assert.equal(calculateOccupantLoad({...customInput,tableFactor:''}).previewPeople,null);
assert.equal(calculateOccupantLoad({area:'1500',factor:'100'}).previewPeople,15,'Arithmetic updates before descriptive fields are complete.');
assert.equal(calculateOccupantLoad({area:'1501',factor:'100'}).previewPeople,16);
assert.equal(calculateOccupantLoad({area:'1500',factor:'50'}).previewPeople,30);
for(const patch of [{area:''},{factor:'0'},{factor:'-1'},{seating:'fixed-seating'},{area:'9999999999',factor:'0.000001'}]) {
 assert.equal(calculateOccupantLoad({area:'1500',factor:'100',...patch}).previewPeople,null,'Unsupported or invalid arithmetic must clear the displayed number.');
}
const source={sectionID:'2152',codePrefix:'BC',sectionNumber:'1004.1.3',codeVersion:'CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1'};
assert(occupantLoadSource(source));
for(const patch of [{codeVersion:''},{codeVersion:source.codeVersion.replace('2022','2014')},{codePrefix:'FC'},{sectionID:'word'},{sectionNumber:'1004.3'}])assert(!occupantLoadSource({...source,...patch}));
assert.equal(occupantLoadAnswerSource([], {citations:[source]}), source, 'Automatically retrieved citations expose the calculator without manually pinned sources.');
assert.equal(occupantLoadAnswerSource([source], {}), source);
assert.equal(occupantLoadAnswerSource([], {}), null);
for (const patch of [{codeVersion:''},{codeVersion:source.codeVersion.replace('2022','2014')},{sectionNumber:'1004.3'},{codePrefix:'FC'}]) {
 assert.equal(occupantLoadAnswerSource([], {citations:[{...source,...patch}]}), null, 'Answer citations must pass the same exact source and edition gate.');
}
const link={id:'synthetic-link',label:'BC 2022 § 1004.1.3',source:{...source,sourceID:'2152',sectionTitle:'Areas without fixed seating',codeEdition:'2022',sourceLibraryVersion:source.codeVersion},passages:[{exact:'Synthetic captured passage for a persistence contract.'}],relationshipRole:'context',createdAt:new Date().toISOString()};
const document=emptyNotebookDocument();document.document=calculationNoteBlocks(calculateOccupantLoad(input),[link]);
const normalized=normalizeNotebookCardPayload({cardType:'finding',title:'Synthetic calculation',document,evidenceLinks:[link],createdBy:'synthetic',updatedBy:'synthetic'});
assert.match(normalized.plainText,/12 people/); assert.match(normalized.plainText,/Needs review/);
assert.equal(normalized.evidenceLinks[0].source.codeVersion,source.codeVersion);
assert.equal(normalized.references[0].referenceKind,'selectedPassage');
assert.equal(normalized.sourceClassification,'user-authored','An arithmetic snapshot must never be classified as enacted or verified Research.');
const single=normalizeNotebookCardPayload({cardType:'finding',title:'One occupant',
  document:{...emptyNotebookDocument(),document:calculationNoteBlocks(calculateOccupantLoad({...input,area:'100'}),[link])},
  evidenceLinks:[link],createdBy:'synthetic',updatedBy:'synthetic'});
assert.match(single.plainText,/= 1 person \(rounded up/);
assert.doesNotMatch(single.plainText,/1 people/);
assert.doesNotMatch(normalized.plainText,/author confirmed|footnotes reviewed/i,'Removing the checkbox must not fabricate a review confirmation.');
assert.throws(()=>calculationNoteBlocks(calculateOccupantLoad({area:'1500',factor:'100'}),[link]),'A preview with incomplete context cannot be saved.');
assert.throws(()=>calculationNoteBlocks(calculateOccupantLoad(input),[]));
const customDocument=emptyNotebookDocument();customDocument.document=calculationNoteBlocks(custom,[link]);
const customNote=normalizeNotebookCardPayload({cardType:'finding',title:'Custom factor',document:customDocument,evidenceLinks:[link],createdBy:'synthetic',updatedBy:'synthetic'});
assert.match(customNote.plainText,/Custom factor \(user-defined\): 50 ft²\/person/);
assert.match(customNote.plainText,/BC table factor: 100 ft²\/person \(gross\)/);
assert.match(customNote.plainText,/Reason\/reference \(user-provided\): Synthetic alternate design reference CALC-7/);
assert.match(customNote.plainText,/30 people/);assert.equal(customNote.sourceClassification,'user-authored');
assert.throws(()=>calculationNoteBlocks(calculateOccupantLoad({...customInput,customReason:''}),[link]));
console.log('Occupant-load arithmetic, invalid/unsupported input boundaries, edition eligibility and durable Notebook snapshot passed. No providers.');
