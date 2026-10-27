import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as identity from '../public/sync-identity.js';
import {parseCodeJumpAnchor, readerCodeReferenceTarget} from '../public/code-references.js';
const text=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const actual=name=>{const start=text.search(new RegExp(`(?:async )?function ${name}\\(`));return text.slice(start,text.indexOf('\n}',start)+2);};
const context=vm.createContext({...identity,URLSearchParams});
vm.runInContext(actual('readerReferenceCodeVersion')+actual('resolveReaderCodeReference'),context);
const current=identity.defaultSyncCodeVersion,historical=identity.historicalConstructionSyncCodeVersion,enacted=identity.enactedAdministrativeSyncCodeVersion;
for(const [source,prefix,expected] of [
 [{codePrefix:'BC',codeVersion:historical},'MC',historical],
 [{codePrefix:'BC',codeVersion:current},'AC',current],
 [{codePrefix:'BC',codeVersion:current},'ZR',identity.zoningSyncCodeVersion],
 [{codePrefix:'ZR',codeVersion:identity.zoningSyncCodeVersion},'BC',current],
 [{codePrefix:'T28',codeVersion:enacted},'AC',enacted],
 [{codePrefix:'BC',codeVersion:'custom-edition'},'BC','custom-edition'],
 [{codePrefix:'BC',codeVersion:'custom-edition'},'MC','custom-edition']
])assert.equal(context.readerReferenceCodeVersion(source,prefix),expected);
context.api=async path=>{const p=new URL(path,'http://fixture').searchParams;assert.equal(p.get('code'),'T28');assert.equal(p.get('version'),enacted);return{section:{id:1,codePrefix:'T28',codeVersion:enacted}};};
assert.equal((await context.resolveReaderCodeReference({codePrefix:'T28',codeVersion:enacted},{codePrefix:'AC',sectionNumber:'28-101.1'})).codePrefix,'T28');
context.api=async()=>({section:{id:1,codePrefix:'BC',codeVersion:historical}});
await assert.rejects(context.resolveReaderCodeReference({codePrefix:'BC',codeVersion:current},{sectionNumber:'101.1'}),/exact code and edition/);
assert.equal(parseCodeJumpAnchor('BCTable1613.3.3(2)').referenceNumber,'1613.3.3(2)');
assert.equal(parseCodeJumpAnchor('BCK1').kind,'chapter');assert.equal(parseCodeJumpAnchor('BCG402').kind,'section');
// Numbered table anchors stay distinct, even when the prose mentions both tables.
const captions=[1,2].map(i=>({textContent:`Table 1613.3.3(${i}) Values`,closest:()=>null}));
const anchors=[1,2].map((i)=>({id:`JD_BCTable1613.3.3(${i})`,parentElement:captions[i-1],closest:()=>null}));
const content={querySelectorAll:selector=>selector==='[id],a[name]'?anchors:[]};
for(const i of [1,2])assert.equal(readerCodeReferenceTarget(content,{codePrefix:'BC',referenceTarget:{kind:'table',number:`1613.3.3(${i})`}}),captions[i-1]);
assert.equal(readerCodeReferenceTarget(content,{codePrefix:'BC',referenceTarget:{kind:'table',number:'1613.3.3(3)'}}),null);
console.log('Reference destinations passed: construction/cross-library editions, current Title 28, wrong-edition rejection, appendix parts and numbered table anchors.');
