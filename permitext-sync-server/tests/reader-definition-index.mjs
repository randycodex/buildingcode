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
  assert.ok(entries.every(e=>e.referenceOnly && e.text === 'See Section 28-101.5 of the Administrative Code.'));
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
