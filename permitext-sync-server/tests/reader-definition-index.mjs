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
 assert.equal(resolveDefinitionReferences([term],[first,{...second,text:'Different meaning.'}])[0].resolution,'multiple-definitions');
});
test('paired code and administrative citations resolve each source independently',()=>{
 const base={bundle:'edition',code:'BC',scope:'general',term:'LISTED',key:'listed'};
 const term={...base,referenceOnly:true,text:'See Section 902.1 of this code and Section 28-101.5 of the Administrative Code.'};
 const intermediary={...base,referenceOnly:true,sectionNumber:'902.1',chapter:'9',text:'See Chapter 1 of Title 28 of the Administrative Code.'};
 const direct={...base,code:'GENERAL ADMINISTRATIVE PROVISIONS',chapter:'1',sectionNumber:'28-101.5',referenceOnly:false,text:'Published meaning.'};
 assert.equal(resolveDefinitionReferences([term],[term,intermediary,direct])[0].resolution,'resolved-reference');
 assert.equal(resolveDefinitionReferences([term],[term,intermediary,{...direct,bundle:'other'}])[0].resolution,'unresolved-reference');
});

test('prime mathematical labels do not contaminate a preceding definition',()=>{
 const entries=extractDefinitionEntries('<h2>2102.1 Definitions.</h2><p>SPECIFIED. Required by construction documents. SPECIFIED COMPRESSIVE STRENGTH OF MASONRY, f ’c. Minimum compressive strength.</p>');
 assert.deepEqual(entries.map(e=>e.term),['SPECIFIED','SPECIFIED COMPRESSIVE STRENGTH OF MASONRY, f ’c']);
 assert.equal(entries[0].text,'Required by construction documents.');
});

test('an exact label at the cited section takes precedence over a grouped child',()=>{
 const context={bundle:'2014',code:'BC',scope:'general'};
 const terms=extractDefinitionEntries('<h2>202 Definitions</h2><p>SPECIFIED. See Section 2102.1.</p>',{definitionChapter:true}).map(e=>({...e,...context}));
 const support=extractDefinitionEntries('<h2>2102.1 Definitions</h2><p>DIMENSIONS. Actual. Measured dimensions.</p><p>Specified. Dimensions for manufacture.</p><p>SPECIFIED. Required by construction documents.</p>').map(e=>({...e,...context}));
 const resolved=resolveDefinitionReferences(terms,[...terms,...support]);
 assert.equal(resolved[0].resolution,'resolved-reference');
 assert.equal(resolved[0].definition.text,'Required by construction documents.');
 const otherEdition=support.map(e=>({...e,bundle:'2022'}));
 assert.equal(resolveDefinitionReferences(terms,[...terms,...otherEdition])[0].resolution,'unresolved-reference');
});

test('explicit appendix references resolve only inside the named same-edition appendix',()=>{
 const term={term:'MDL',key:'mdl',text:'See Appendix D.',referenceOnly:true,bundle:'EBC',code:'EBC',scope:'general'};
 const target={...term,text:'The New York State Multiple Dwelling Law.',referenceOnly:false,scope:'appendix-D'};
 assert.equal(resolveDefinitionReferences([term],[term,target])[0].definition.text,target.text);
 for(const mismatch of [{scope:'appendix-C'},{bundle:'older-EBC'},{code:'BC'}]) {
  assert.equal(resolveDefinitionReferences([term],[term,{...target,...mismatch}])[0].resolution,'unresolved-reference');
 }
 const ordinary={...term,text:'See "MDL."'};
 assert.equal(resolveDefinitionReferences([ordinary],[ordinary,target])[0].resolution,'unresolved-reference');
});

test('grouped child labels resolve when published inline after a sentence',()=>{
 const context={bundle:'2014',code:'BC',scope:'general'};
 const term={...context,term:'CORRIDOR, INTERIOR',key:'corridor, interior',referenceOnly:true,text:'See Section 1002.1.'};
 const parent={...context,term:'CORRIDOR',key:'corridor',referenceOnly:false,sectionNumber:'1002.1',text:'An enclosed component. Corridor, interior. A corridor serving one tenant. Corridor, public. A corridor serving multiple tenants.'};
 const result=resolveDefinitionReferences([term],[term,parent])[0];
 assert.equal(result.resolution,'resolved-reference');
 assert.equal(result.definition.text,parent.text);
 assert.equal(resolveDefinitionReferences([term],[term,{...parent,sectionNumber:'1003.1'}])[0].resolution,'unresolved-reference');
 assert.equal(resolveDefinitionReferences([term],[term,{...parent,text:'An enclosed component with an interior corridor.'}])[0].resolution,'unresolved-reference');
});

test('explicit named lists retain every target through a section reference chain',()=>{
 const base={bundle:'2014',code:'BC',scope:'general',sectionNumber:'702.1'};
 const head={...base,key:'damper',term:'DAMPER',text:'See Section 702.1.',referenceOnly:true,sectionNumber:'202'};
 const list={...base,key:'damper',term:'DAMPER',text:'See “Fire damper,” “Smoke damper.”',referenceOnly:true};
 const fire={...base,key:'fire damper',term:'FIRE DAMPER',text:'A fire device.',referenceOnly:false};
 const smoke={...base,key:'smoke damper',term:'SMOKE DAMPER',text:'A smoke device.',referenceOnly:false};
 const result=resolveDefinitionReferences([head],[head,list,fire,smoke])[0];
 assert.equal(result.resolution,'multiple-definitions');
 assert.deepEqual(result.definitions.map(e=>e.term),['FIRE DAMPER','SMOKE DAMPER']);
 assert.equal(resolveDefinitionReferences([head],[head,list,fire])[0].resolution,'unresolved-reference');
 assert.equal(resolveDefinitionReferences([head],[head,list,fire,{...smoke,bundle:'2022'}])[0].resolution,'unresolved-reference');
});

test('MDL source citations do not become required text in a term occurrence',()=>{
 const entries=extractDefinitionEntries('<h2>D202 Definitions</h2><p>BASEMENT (MDL 4(38)). A published meaning.</p><p>FIRE ESCAPE (MDL 4(42)(c)). Another meaning.</p><p>BASEMENT (FOR FLOOD ZONE PURPOSES). A scoped meaning.</p>',{definitionChapter:true});
 assert.deepEqual(entries[0].aliases,['BASEMENT']);
 assert.deepEqual(entries[1].aliases,['FIRE ESCAPE']);
 assert.deepEqual(entries[2].aliases,[]);
 assert.equal(entries[0].term,'BASEMENT (MDL 4(38))');
});

test('opt-in quoted legal labels retain explicit aliases and nested continuation wording',()=>{
 const html='<h3>24-104 Definitions.</h3><p>"British thermal unit" or "Btu" means a unit of energy.</p><p>"Device" means equipment which:</p><p>(1) detects emissions; and</p><p>(2) records them.</p><p>"Air" means the respirable mixture.</p><h3>24-105 Rules.</h3><p>"Other" means ordinary quoted prose.</p>';
 const entries=extractDefinitionEntries(html,{definitionSectionOnly:true,quotedLegalLabels:true});
 assert.deepEqual(entries.map(e=>e.term),['British thermal unit','Device','Air']);
 assert.deepEqual(entries[0].aliases,['Btu']);
 assert.equal(entries[1].text,'equipment which:\n\n(1) detects emissions; and\n\n(2) records them.');
 assert.ok(entries.every(e=>e.sectionNumber==='24-104'));
 assert.equal(extractDefinitionEntries(html,{definitionSectionOnly:true}).length,0);
});

test('numbered quoted labels preserve punctuation and do not infer ordinary quoted sentences',()=>{
 const entries=extractDefinitionEntries('<h3>25-302 Definitions.</h3><p>a."Alteration." Any acts defined by the code.</p><p>c-1.“Chair.” The chair of the commission.</p><h3>25-303 Rules.</h3><p>"Chair" shall act.</p>',{definitionSectionOnly:true,quotedLegalLabels:true});
 assert.deepEqual(entries.map(e=>[e.term,e.text]),[['Alteration','Any acts defined by the code.'],['Chair','The chair of the commission.']]);
});

test('published quoted administrative definitions keep a bare label separate from its predecessor',()=>{
 const html=readFileSync(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/chapters/30000014.html',import.meta.url),'utf8');
 const entries=extractDefinitionEntries(html,{definitionSectionOnly:true,quotedLegalLabels:true});
 const reasonable=entries.find(e=>e.term==='Reasonable return');
 assert.ok(reasonable);
 assert.match(reasonable.text,/^\(1\)A net annual return of six per centum/);
 assert.match(reasonable.text,/Test year shall be/);
 assert.ok(!entries.find(e=>e.term==='Protected architectural feature').text.includes('six per centum'));
 assert.ok(entries.every(e=>e.sectionNumber==='25-302'&&e.anchor==='section-31000440'));
});

test('cited prose definitions require an exact term and exact section',()=>{
 const html='<section id="target"><h3>BC 1913.1 General.</h3><p>Shotcrete is mortar or concrete that is projected onto a surface.</p></section><h3>BC 1913.1.1 Qualifications.</h3><p>Shotcrete is another sentence.</p>';
 const targets=[{term:'SHOTCRETE',sectionNumber:'1913.1'}];
 const entries=extractDefinitionEntries(html,{sentenceDefinitionTargets:targets});
 assert.deepEqual(entries.map(e=>[e.term,e.text,e.anchor]),[['SHOTCRETE','Shotcrete is mortar or concrete that is projected onto a surface.','target']]);
 assert.equal(extractDefinitionEntries(html).length,0);
 assert.equal(extractDefinitionEntries(html,{sentenceDefinitionTargets:[{term:'CONCRETE',sectionNumber:'1913.1'}]}).length,0);
 assert.equal(extractDefinitionEntries(html,{sentenceDefinitionTargets:[{term:'SHOTCRETE',sectionNumber:'1913'}]}).length,0);
});

test('an explicit appendix section resolves only in the named same-code appendix',()=>{
 const term={bundle:'2014',code:'BC',scope:'general',term:'PREFIRM DEVELOPMENT',key:'prefirm development',text:'See Section G201.2.',referenceOnly:true};
 const source={...term,scope:'appendix-G',sectionNumber:'G201.2',text:'Published appendix meaning.',referenceOnly:false};
 assert.equal(resolveDefinitionReferences([term],[source])[0].resolution,'resolved-reference');
 for(const invalid of [{...source,sectionNumber:'G201.3'},{...source,scope:'appendix-H'},{...source,bundle:'2022'},{...source,code:'PC'}]){
  assert.equal(resolveDefinitionReferences([term],[invalid])[0].resolution,'unresolved-reference');
 }
 assert.equal(resolveDefinitionReferences([{...term,text:'See "PREFIRM DEVELOPMENT".'}],[source])[0].resolution,'unresolved-reference');
});

test('hyphen variants need a cited section and preserve conflicting meanings',()=>{
 const term={bundle:'2014',code:'BC',scope:'general',term:'PREFIRM DEVELOPMENT',key:'prefirm development',text:'See Section G201.2.',referenceOnly:true};
 const source={...term,term:'PRE-FIRM DEVELOPMENT',key:'pre-firm development',scope:'appendix-G',sectionNumber:'G201.2',text:'Exact published wording.',referenceOnly:false};
 assert.equal(resolveDefinitionReferences([term],[source])[0].resolution,'resolved-reference');
 assert.equal(resolveDefinitionReferences([{...term,text:'See "PRE-FIRM DEVELOPMENT".'}],[source])[0].resolution,'unresolved-reference');
 assert.equal(resolveDefinitionReferences([term],[{...source,sectionNumber:'G201.3'}])[0].resolution,'unresolved-reference');
 assert.equal(resolveDefinitionReferences([term],[source,{...source,text:'Conflicting wording.'}])[0].resolution,'ambiguous-reference');
 assert.equal(resolveDefinitionReferences([term],[{...source,key:'pre-firm development (special use)'}])[0].resolution,'unresolved-reference');
});

test('double amendment markers retain an inline administrative definition section',()=>{
 const html='<section id="prior"><h3>AC 28-401.2 General requirements.</h3><p>General requirements.<br>**§28-401.3 Definitions. As used in this chapter.<br>DIRECT EMPLOY. An individual on the payroll.</p></section>';
 const entries=extractDefinitionEntries(html);
 assert.equal(entries.length,1);
 assert.equal(entries[0].term,'DIRECT EMPLOY');
 assert.equal(entries[0].sectionNumber,'28-401.3');
 assert.equal(entries[0].anchor,'prior');
 assert.equal(entries[0].text,'An individual on the payroll.');
});

test('inline section boundaries keep following requirements out of definitions',()=>{
 const html='<section id="source"><h3>AC 28-103.33.1 Definitions.</h3><p>GREEN ROOF SYSTEM. See Chapter 2.<br>**§28-103.33.2 Duties.<br>The office shall publish guidance.<br>*§28-103.34 Definitions.<br>OFFICE. The designated office.</p></section>';
 const entries=extractDefinitionEntries(html,{definitionSectionOnly:true});
 assert.deepEqual(entries.map(({term,text,sectionNumber})=>({term,text,sectionNumber})),[
  {term:'GREEN ROOF SYSTEM',text:'See Chapter 2.',sectionNumber:'28-103.33.1'},
  {term:'OFFICE',text:'The designated office.',sectionNumber:'28-103.34'},
 ]);
 assert.ok(entries.every(entry=>entry.anchor==='source'));
});

test('qualified 2022 flood references resolve only through their printed section',()=>{
 const term={bundle:'2022-construction-codes',code:'BUILDING CODE',scope:'general',term:'HISTORIC STRUCTURE (FLOOD-RESISTANT CONSTRUCTION)',key:'historic structure (flood-resistant construction)',text:'See Section G201.1.2.',referenceOnly:true};
 const source={...term,term:'HISTORIC STRUCTURE',key:'historic structure',scope:'appendix-G',sectionNumber:'G201.1.2',text:'Exact flood definition.',referenceOnly:false};
 const result=resolveDefinitionReferences([term],[source])[0];
 assert.equal(result.resolution,'resolved-reference');
 assert.equal(result.term,term.term);
 assert.equal(result.definition.text,source.text);
 for(const invalid of [{...source,sectionNumber:'G201.3'},{...source,bundle:'2014-construction-codes'},{...source,code:'PLUMBING CODE'}]) {
  assert.equal(resolveDefinitionReferences([term],[invalid])[0].resolution,'unresolved-reference');
 }
 assert.equal(resolveDefinitionReferences([{...term,text:'See Appendix G.'}],[source])[0].resolution,'unresolved-reference');
 assert.equal(resolveDefinitionReferences([term],[source,{...source,text:'Conflicting definition.'}])[0].resolution,'ambiguous-reference');
});

test('reciprocal alternate-name headings resolve without dropping scope qualifiers',()=>{
 const term={bundle:'2022',code:'BC',scope:'general',term:'HOLD-DOWN',key:'hold-down',text:'See "TIE-DOWN".',referenceOnly:true};
 const source={...term,term:'TIE-DOWN (HOLD-DOWN)',key:'tie-down (hold-down)',text:'A device used to resist uplift.',referenceOnly:false};
 assert.equal(resolveDefinitionReferences([term],[source])[0].resolution,'resolved-reference');
 for(const invalid of [{...source,key:'tie-down (special use)'},{...source,bundle:'2014'},{...source,code:'PC'},{...source,scope:'appendix-G'}]) {
  assert.equal(resolveDefinitionReferences([term],[invalid])[0].resolution,'unresolved-reference');
 }
 assert.equal(resolveDefinitionReferences([term],[source,{...source,text:'Different definition.'}])[0].resolution,'ambiguous-reference');
});

test('cited definition references tolerate spacing while preserving scope and ambiguity',()=>{
 for(const [label,target] of [['PARTICLE BOARD','PARTICLEBOARD'],['DRAFTSTOP','DRAFT STOP'],['MEMBRANE-PENETRATION FIRESTOP','MEMBRANE PENETRATION FIRESTOP']]) {
  const term={bundle:'2014',code:'BC',scope:'general',term:label,key:label.toLowerCase(),text:'See Section 702.1.',referenceOnly:true};
  const source={...term,term:target,key:target.toLowerCase(),sectionNumber:'702.1',text:'Published definition.',referenceOnly:false};
  assert.equal(resolveDefinitionReferences([term],[source])[0].resolution,'resolved-reference');
  for(const invalid of [{...source,sectionNumber:'702.2'},{...source,bundle:'2022'},{...source,key:source.key+' (special use)'},{...source,code:'PC'}]) {
   assert.equal(resolveDefinitionReferences([term],[invalid])[0].resolution,'unresolved-reference');
  }
  assert.equal(resolveDefinitionReferences([{...term,text:`See "${label}".`}],[source])[0].resolution,'unresolved-reference');
  assert.equal(resolveDefinitionReferences([term],[source,{...source,text:'Conflicting meaning.'}])[0].resolution,'ambiguous-reference');
 }
});

test('configured numbered legal definitions retain child paragraphs and stop at the next numbered entry',()=>{
 const html='<h3>27-2004 Definitions.</h3><p>3.A dwelling is a home.</p><p>4.A family is:</p><p>(a) One person; or</p><p>(b) Related persons.</p><p>5.A restricted meaning.</p><p>Additional restricted wording.</p><h3>27-2005 Duties.</h3><p>6.Not a definition.</p>';
 const entries=extractDefinitionEntries(html,{definitionSectionOnly:true,numberedLegalLabels:{sectionNumber:'27-2004',terms:{3:'Dwelling',4:'Family'}}});
 assert.equal(entries.length,2);
 assert.equal(entries[1].text,'A family is:\n\n(a) One person; or\n\n(b) Related persons.');
 assert.equal(entries[0].text,'A dwelling is a home.');
 assert.equal(entries[1].sectionNumber,'27-2004');
});
