import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractDefinitionEntries, splitDefinitionParagraph, resolveDefinitionReferences } from '../reader-definition-index.mjs';

test('merged imported paragraphs retain each term and body', () => {
  assert.deepEqual(splitDefinitionParagraph('ACCESS. A way in. AIR CONDITIONING. Treatment of air.').map(({term,text}) => ({term,text})), [
    {term:'ACCESS',text:'A way in.'}, {term:'AIR CONDITIONING',text:'Treatment of air.'},
  ]);
});
test('bare term lists reference their source instead of defining each other', () => {
  const entries = extractDefinitionEntries('<h2>201.3 Terms.</h2><p>The following terms are defined in Section 28-101.5 of the Administrative Code:</p><p>ADDITION.<br>ALTERATION.<br>BUILDING.</p>', {definitionChapter:true});
  assert.deepEqual(entries.map(e=>e.term), ['ADDITION','ALTERATION','BUILDING']);
  assert.ok(entries.every(e=>e.referenceOnly && e.text === 'The following terms are defined in Section 28-101.5 of the Administrative Code:'));
});
test('continuations belong to the preceding definition, until the next heading', () => {
  const entries = extractDefinitionEntries('<h2>202 Definitions</h2><p>ACCESS. A way in.</p><p>Includes a passage.</p><h2>203 Other</h2><p>Not part of access.</p>', {definitionChapter:true});
  assert.equal(entries[0].text, 'A way in.\n\nIncludes a passage.');
});
test('references resolve only to an unambiguous matching definition', () => {
  const terms = extractDefinitionEntries('<h2>202 Definitions</h2><p>EXIT. See “EGRESS”.</p><p>EGRESS. A way out.</p>', {definitionChapter:true});
  const resolved = resolveDefinitionReferences(terms,terms);
  assert.equal(resolved[0].resolution,'resolved-reference');
  assert.equal(resolved[0].definition.text,'A way out.');
  assert.equal(resolveDefinitionReferences(terms,[...terms,{...terms[1],text:'Another scope.'}])[0].resolution,'ambiguous-reference');
});
test('2014 fuel gas source includes definitions merged into paragraphs', () => {
  const html = readFileSync(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2014-construction-codes/chapters/fgc-2.html', import.meta.url),'utf8');
  const terms = extractDefinitionEntries(html,{definitionChapter:true});
  assert.ok(terms.find(e=>e.term === 'AIR CONDITIONING')?.text.startsWith('The treatment of air'));
  assert.ok(terms.find(e=>e.term === 'ADMINISTRATIVE CODE')?.text.startsWith('The Administrative Code'));
});
test('reference resolution cannot cross edition, code, or applicability scope', () => {
  const reference = {key:'exit',term:'EXIT',text:'See Section 202.',referenceOnly:true,bundle:'2022',code:'BC',scope:'general'};
  const definition = {...reference,text:'A way out.',referenceOnly:false,sectionNumber:'202'};
  for (const other of [{bundle:'2014'},{code:'MC'},{scope:'appendix-D'}]) {
    assert.equal(resolveDefinitionReferences([reference],[{...definition,...other}])[0].resolution,'unresolved-reference');
  }
  assert.equal(resolveDefinitionReferences([reference],[definition])[0].resolution,'resolved-reference');
});
test('explicit administrative references require the named code and same edition',()=>{
 const term={key:'addition',term:'ADDITION',text:'See Section 28-101.5 of the Administrative Code.',referenceOnly:true,bundle:'2014',code:'BUILDING CODE',scope:'general'};
 const target={...term,referenceOnly:false,text:'An extension.',code:'ADMINISTRATIVE PROVISIONS',sectionNumber:'28-101.5'};
 assert.equal(resolveDefinitionReferences([term],[target])[0].resolution,'resolved-reference');
 assert.equal(resolveDefinitionReferences([term],[{...target,bundle:'2022'}])[0].resolution,'unresolved-reference');
 assert.equal(resolveDefinitionReferences([term],[{...target,code:'BUILDING CODE'}])[0].resolution,'unresolved-reference');
});
test('historical inline definition headings replace the previous section number',()=>{
 const entries=extractDefinitionEntries('<h3>AC 28-101.4.5.3 Effect.</h3><p>Prior text.<br>*§28-101.5 Definitions. Terms follow:</p><p>ADDITION. An extension.</p>');
 assert.equal(entries[0].sectionNumber,'28-101.5');
});
test('published administrative section-sign headings retain their citation',()=>{
 const entries=extractDefinitionEntries('<div class="rbox"><h6>§ 28-101.5 <span>Definitions.</span></h6></div><div class="rbox"><div><span>ADDITION.</span> An extension.</div></div>');
 assert.equal(entries.length,1);assert.equal(entries[0].sectionNumber,'28-101.5');
});
test('quoted references do not swallow the next definition in imported paragraphs',()=>{
 const entries=splitDefinitionParagraph('BUILDING SEWER. See “Sewer, building sewer.” BUILDING SUBDRAIN. That portion of a drainage system.');
 assert.deepEqual(entries.map(e=>e.term),['BUILDING SEWER','BUILDING SUBDRAIN']);
 assert.equal(entries[0].text,'See “Sewer, building sewer.”');
});
test('lowercase legal subsection markers inside term labels are preserved',()=>{
 const entries=splitDefinitionParagraph('DWELLING UNIT. See Chapter 2. FIRE ESCAPE (MDL 4(42)(c)). A fire escape is a combination.');
 assert.equal(entries[1].term,'FIRE ESCAPE (MDL 4(42)(c))');
});
test('group definitions retain the meanings listed beneath a bare parent term',()=>{
 const entries=extractDefinitionEntries('<h3>2102.1 Definitions.</h3><p>AREA.</p><p>Bedded. The contact surface.</p><p>Net cross-sectional. The net area.</p><p>BRICK. A masonry unit.</p>');
 assert.equal(entries[0].term,'AREA');
 assert.equal(entries[0].text,'Bedded. The contact surface.\n\nNet cross-sectional. The net area.');
 assert.equal(entries[1].term,'BRICK');
});
test('explicit grouped references require the exact published child label',()=>{
 const entries=extractDefinitionEntries('<h2>202 Definitions</h2><p>BUILDING SEWER. See “Sewer, building sewer.”</p><p>SEWER.</p><p>Building sewer. A drainage system.</p><p>Private sewer. A private system.</p>',{definitionChapter:true});
 assert.equal(resolveDefinitionReferences(entries,entries)[0].resolution,'resolved-reference');
 const missing={...entries[0],text:'See “Sewer, imaginary sewer.”'};
 assert.equal(resolveDefinitionReferences([missing],entries)[0].resolution,'unresolved-reference');
});
test('electrical amendment definitions stop at the next article',()=>{
 const html='<h2>ARTICLE 100</h2><h3>ARTICLE-100 DEFINITIONS</h3><p>Coordination (Limited Level). Localization of a condition.<br>Electrical Equipment Room. A dedicated room.</p><h2>ARTICLE 110</h2><p>Other Heading. This is not a definition.</p>';
 const entries=extractDefinitionEntries(html,{definitionChapter:true,definitionSectionOnly:true,titleCaseLabels:true});
 assert.deepEqual(entries.map(t=>t.term),['Coordination (Limited Level)','Electrical Equipment Room']);
 assert.equal(entries[0].sectionNumber,'100');
});
test('references can resolve an acronym explicitly printed in a definition label',()=>{
 const entries=extractDefinitionEntries('<h2>202 Definitions</h2><p>LOWER EXPLOSIVE LIMIT (LEL). See “LFL”.</p><p>LOWER FLAMMABLE LIMIT (LFL). The minimum concentration.</p>',{definitionChapter:true});
 assert.equal(resolveDefinitionReferences(entries,entries)[0].definition.term,'LOWER FLAMMABLE LIMIT (LFL)');
 assert.deepEqual(entries[1].aliases,['LFL']);
});
test('missing definition heading does not inherit a Terms not defined citation',()=>{
 const entries=extractDefinitionEntries('<h3>BC 201.4 Terms not defined.</h3><p>Ordinary meanings apply.</p><p>ALTERATION. A construction change.</p>',{definitionChapter:true});
 assert.equal(entries[0].sectionNumber,'');
});
test('parenthetical qualifiers are not mistaken for acronym aliases',()=>{
 const entries=extractDefinitionEntries('<h2>202 Definitions</h2><p>FOUNDATION (BUILDING). Transfers loads.</p><p>LOWER FLAMMABLE LIMIT (LFL). A concentration.</p>',{definitionChapter:true});
 assert.deepEqual(entries[0].aliases,[]);
 assert.deepEqual(entries[1].aliases,['LFL']);
});
test('lowercase mathematical symbols do not merge adjacent definitions',()=>{
 const entries=extractDefinitionEntries('<h2>202 Definitions</h2><p>DWELLING UNIT. See “Type B unit”.</p><p>EAVE HEIGHT, <em>h</em>. The distance to the roof eave.</p><p>EXIT. A way out.</p>',{definitionChapter:true});
 assert.deepEqual(entries.map(e=>e.term),['DWELLING UNIT','EAVE HEIGHT, h','EXIT']);
 assert.equal(entries[0].text,'See “Type B unit”.');
 assert.equal(entries[1].text,'The distance to the roof eave.');
});
test('explicit quoted references tolerate published inline punctuation spacing',()=>{
 const context={bundle:'2022',code:'BC',scope:'general'};
 const terms=extractDefinitionEntries('<h2>202 Definitions</h2><p>GREEN ROOF. See definition for “Vegetative Roof.”</p><p>VEGETATIVE ROOF. A planted roof.</p><p>FIRE DAMPER. See “ Dampers , Types of .”</p><p>DAMPERS, TYPES OF. Published group description.</p>',{definitionChapter:true}).map(e=>({...e,...context}));
 const resolved=resolveDefinitionReferences(terms,terms);
 assert.equal(resolved[0].definition.term,'VEGETATIVE ROOF');
 assert.equal(resolved[2].definition.term,'DAMPERS, TYPES OF');
 assert.equal(resolved[0].referenceText,'See definition for “Vegetative Roof.”');
});
test('plus signs distinguish Type B and Type B plus NYC definitions',()=>{
 const entries=extractDefinitionEntries('<h2>202 Definitions</h2><p>TYPE B UNIT. First meaning.</p><p>TYPE B + NYC UNIT. Separate meaning.</p>',{definitionChapter:true});
 assert.deepEqual(entries.map(e=>[e.term,e.text]),[['TYPE B UNIT','First meaning.'],['TYPE B + NYC UNIT','Separate meaning.']]);
});
test('bold group labels without a period start their own definition',()=>{
 const entries=extractDefinitionEntries('<h2>202 Definitions</h2><div class="rbox"><div><b>TEST.</b> Prior meaning.</div></div><div class="rbox"><div><span style="font-weight: bold">THERMOSTAT</span></div></div><div class="rbox"><div>Electric switch type. A temperature control.</div></div><div class="rbox"><div>UNIT. Next meaning.</div></div>',{definitionChapter:true});
 assert.deepEqual(entries.map(e=>e.term),['TEST','THERMOSTAT','UNIT']);
 assert.equal(entries[0].text,'Prior meaning.');
 assert.equal(entries[1].text,'Electric switch type. A temperature control.');
});
test('mixed-case bold continuation is not mistaken for an uppercase group',()=>{
 const entries=extractDefinitionEntries('<h2>202 Definitions</h2><div class="rbox"><div>TERM. First sentence.</div></div><div class="rbox"><div><span style="font-weight: bold">Additional explanation</span></div></div>',{definitionChapter:true});
 assert.equal(entries.length,1);
 assert.equal(entries[0].text,'First sentence.\n\nAdditional explanation');
});
test('chapter definition lists never turn amendment notes into competing meanings',()=>{
 const terms=extractDefinitionEntries('<h2>1502 Definitions</h2><p>The following terms are defined in Chapter 2:</p><p>VEGETATIVE ROOF.</p><p>(Am. L.L. 2023/077)</p>');
 assert.equal(terms.length,1);
 assert.equal(terms[0].referenceOnly,true);
 const context={bundle:'2022',code:'BC',scope:'general'};
 const direct={...context,key:'vegetative roof',term:'VEGETATIVE ROOF',text:'Published roof meaning.',sectionNumber:'202',referenceOnly:false};
 const reference={...context,key:'green roof',term:'GREEN ROOF',text:'See “Vegetative roof.”',referenceOnly:true};
 const resolved=resolveDefinitionReferences([reference],[direct,...terms.map(t=>({...t,...context}))]);
 assert.equal(resolved[0].resolution,'resolved-reference');
 assert.equal(resolved[0].definition.text,direct.text);
});
test('multiword alternatives do not discard a qualifying adjective',()=>{
 const entries=extractDefinitionEntries('<h2>202 Definitions</h2><p>EXISTING BUILDING OR STRUCTURE. A qualified meaning.</p><p>ACCEPTANCE OR ACCEPTED. An approval.</p>',{definitionChapter:true});
 assert.deepEqual(entries[0].aliases,[]);
 assert.deepEqual(entries[1].aliases,['ACCEPTANCE','ACCEPTED']);
});
test('explicit same-edition reference chains resolve to their terminal source',()=>{
 const context={bundle:'2022',scope:'general',key:'example',term:'EXAMPLE'};
 const first={...context,code:'BUILDING CODE',text:'See Section 28-101.5 of the Administrative Code.',referenceOnly:true,sectionNumber:'202'};
 const second={...context,code:'GENERAL ADMINISTRATIVE PROVISIONS',text:'See section 28-107.2.',referenceOnly:true,sectionNumber:'28-101.5'};
 const final={...context,code:second.code,text:'The published meaning.',referenceOnly:false,sectionNumber:'28-107.2'};
 const resolved=resolveDefinitionReferences([first],[first,second,final])[0];
 assert.equal(resolved.resolution,'resolved-reference');assert.equal(resolved.definition,final);
 assert.equal(resolved.referenceText,first.text);
 assert.equal(resolveDefinitionReferences([first],[first,second,{...final,bundle:'2014'}])[0].resolution,'unresolved-reference');
});
test('reference cycles and conflicting terminal meanings are not guessed',()=>{
 const context={bundle:'2022',code:'BC',scope:'general',key:'example',term:'EXAMPLE',referenceOnly:true};
 const first={...context,text:'See Section 203.',sectionNumber:'202'};
 const second={...context,text:'See Section 202.',sectionNumber:'203'};
 assert.equal(resolveDefinitionReferences([first],[first,second])[0].resolution,'unresolved-reference');
 const third={...context,text:'See Section 204.',sectionNumber:'203'};
 const direct={...context,text:'One meaning.',sectionNumber:'204',referenceOnly:false};
 const conflicting={...direct,text:'Another meaning.'};
 assert.equal(resolveDefinitionReferences([first],[first,third,direct,conflicting])[0].resolution,'ambiguous-reference');
});

test('list references retain only their published introduction inside a combined paragraph',()=>{
 const entries=extractDefinitionEntries('<p>201.1 Scope. These words apply here. 201.3.1 Terms defined elsewhere. The following terms are defined in Section 28-101.5 of the Administrative Code:<br>BUILDING.<br>CITY.<br>OWNER.</p>',{definitionChapter:true});
 for(const term of ['BUILDING','CITY','OWNER']){
  const entry=entries.find(e=>e.term===term);
  assert.ok(entry);
  assert.equal(entry.text,'The following terms are defined in Section 28-101.5 of the Administrative Code:');
  assert.equal(entry.referenceOnly,true);
 }
});

test('amendment asterisks do not merge an uppercase definition into its predecessor',()=>{
 const entries=extractDefinitionEntries('<p>COVER. See Section 2102.1.<br>*COVERED DEVELOPMENT PROJECT. See Section 28-104.11.1 of the Administrative Code.<br>*Section 202 was amended by: Local Law 97 of 2017.</p>',{definitionChapter:true});
 assert.equal(entries.length,2);
 assert.equal(entries[0].term,'COVER');
 assert.equal(entries[0].text,'See Section 2102.1.');
 assert.equal(entries[1].term,'COVERED DEVELOPMENT PROJECT');
 assert.ok(entries[1].text.startsWith('See Section 28-104.11.1'));
 assert.ok(!entries.some(e=>e.term.includes('Section 202')));
});

test('published lowercase or separates explicit uppercase alternatives',()=>{
 const entries=extractDefinitionEntries('<h3>BC G201.2 Definitions.</h3><p>FLOOD or FLOODING. A general and temporary condition of inundation.</p><p>OTHER. Another meaning.</p>');
 assert.equal(entries[0].term,'FLOOD or FLOODING');
 assert.deepEqual(entries[0].aliases,['FLOOD','FLOODING']);
 assert.equal(entries[0].text,'A general and temporary condition of inundation.');
 assert.equal(entries.length,2);
});

test('paired references require both cited meanings and reject conflicts',()=>{
 const base={bundle:'edition',code:'BC',scope:'general',term:'EXAMPLE',key:'example'};
 const term={...base,referenceOnly:true,text:'See Sections 301.1 and 401.1.'};
 const first={...base,referenceOnly:false,sectionNumber:'301.1',text:'One meaning.'};
 const second={...first,sectionNumber:'401.1'};
 assert.equal(resolveDefinitionReferences([term],[first,second])[0].resolution,'resolved-reference');
 assert.equal(resolveDefinitionReferences([term],[first])[0].resolution,'unresolved-reference');
 assert.equal(resolveDefinitionReferences([term],[first,{...second,text:'Different meaning.'}])[0].resolution,'ambiguous-reference');
});
test('paired code and administrative citations resolve each source independently',()=>{
 const base={bundle:'edition',code:'BC',scope:'general',term:'LISTED',key:'listed'};
 const term={...base,referenceOnly:true,text:'See Section 902.1 of this code and Section 28-101.5 of the Administrative Code.'};
 const intermediary={...base,referenceOnly:true,sectionNumber:'902.1',chapter:'9',text:'See Chapter 1 of Title 28 of the Administrative Code.'};
 const direct={...base,code:'GENERAL ADMINISTRATIVE PROVISIONS',chapter:'1',sectionNumber:'28-101.5',referenceOnly:false,text:'Published meaning.'};
 assert.equal(resolveDefinitionReferences([term],[term,intermediary,direct])[0].resolution,'resolved-reference');
 assert.equal(resolveDefinitionReferences([term],[term,intermediary,{...direct,bundle:'other'}])[0].resolution,'unresolved-reference');
});
