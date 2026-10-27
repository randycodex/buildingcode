import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {codeReferenceRequest, resolveCodeReference} from '../public/code-reference-resolution.js';
import {parseCodeJumpAnchor} from '../public/code-references.js';
import {defaultSyncCodeVersion as current, historicalConstructionSyncCodeVersion as historical} from '../public/sync-identity.js';
import {handleRequest, allSectionCatalogByID} from '../app.mjs';
import {applyVisibleSectionNumber} from '../code-navigation-hierarchy.mjs';
const records = [...(await allSectionCatalogByID()).values()].map(s=>({...applyVisibleSectionNumber(s),codeVersion:s.codeVersion||current}));
const server=createServer(handleRequest);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
try {
  for(const [anchor,code,version,expected,match] of [
    ['T28C001','AC',current,'28-101.1','chapter-start'],
    ['28-103','AC',current,'28-103.1','first-subsection'],
    ['BC3321','BC',current,'3321.1','first-subsection'],
    ['BC407','BC',current,'407.1','first-subsection'],
    ['BC3104','BC',current,'3104.1','first-subsection'],
    ['BC101.4.6','BC',current,'101.4.6','exact'],
    ['BCTable1613.3.3(2)','BC',current,'1613.3.3','exact'],
    ['BCK1','BC',current,'K101.1','chapter-start'],
    ['BC101.1','BC',historical,'101.1','exact']
  ]) {
    const target=parseCodeJumpAnchor(anchor);assert.ok(target,anchor);
    const params=new URLSearchParams({include:'metadata',code,version,number:target.referenceNumber||target.sectionNumber||target.chapterNumber,kind:target.targetKind});
    const result=await fetch(base+'/code/references/resolve?'+params);
    assert.equal(result.status,200,anchor+': '+await result.clone().text());
    const {section}=await result.json();
    assert.equal(section.codePrefix,code);assert.equal(section.codeVersion,version);
    assert.equal(section.sectionNumber,expected,anchor);assert.equal(section.referenceTarget.match,match,anchor);
    assert.equal(section.referenceTarget.number,params.get('number'));
    for(const field of ['blocks','body','html','plainText'])assert.ok(!(field in section));
    const exact=await fetch(base+`/code/sections/${section.id}?include=metadata&version=${encodeURIComponent(version)}`);
    assert.equal((await exact.json()).section.id,section.id);
  }
  for(const [code,number,kind] of [['BC','G402','section'],['MC','202','section'],['FGC','202','section'],['PC','202','section'],['BC','1803.3','table'],['FGC','E.6','appendix-section'],['FGC','E.2','appendix-section']]){
    const p=new URLSearchParams({include:'metadata',code,version:current,number,kind});
    const response=await fetch(base+'/code/references/resolve?'+p);assert.equal(response.status,404,number);
    assert.match((await response.json()).error,/not available/);
  }
  const p=new URLSearchParams({include:'metadata',code:'BC',version:'unavailable-edition',number:'101.1',kind:'section'});
  assert.equal((await fetch(base+'/code/references/resolve?'+p)).status,404);
  p.set('version',current);p.append('version',historical);
  assert.equal((await fetch(base+'/code/references/resolve?'+p)).status,400);
  for(const query of ['include=metadata','include=body&code=BC&version=x&number=101&kind=section','include=metadata&code=BC&version=x&number=101&kind=wrong'])assert.throws(()=>codeReferenceRequest(new URLSearchParams(query)));
  const synthetic=[{id:1,chapterID:1,codePrefix:'BC',codeVersion:current,sectionNumber:'101.1'},
    {id:2,chapterID:2,codePrefix:'BC',codeVersion:current,sectionNumber:'101.2'}];
  assert.throws(()=>resolveCodeReference(synthetic,{code:'BC',version:current,number:'101',kind:'section'}),/multiple/);
  assert.throws(()=>resolveCodeReference([...synthetic,{...synthetic[0],id:3}],{code:'BC',version:current,number:'101.1',kind:'section'}),/multiple/);
  assert.throws(()=>resolveCodeReference(records,{code:'BC',version:historical,number:'9999',kind:'section'}),/not available/);
  // Ordinary exact-source resolution must keep rejecting a parent-only number.
  const strict=new URLSearchParams({include:'metadata',code:'AC',version:current,sectionNumber:'28-103'});
  assert.equal((await fetch(base+'/code/sections/resolve?'+strict)).status,404);
  console.log('Reference metadata passed: chapters, appendix parts, parent entry points, suffixes, editions, ambiguity, unavailable targets, exact saved-source boundaries.');
}finally{await new Promise(resolve=>server.close(resolve));}
