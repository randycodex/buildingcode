import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const start=source.indexOf('function notebookEvidenceTextMap('),end=source.indexOf('\nfunction markNotebookEvidenceRange(',start);
const block={};
const node=(value,kind='text')=>({nodeValue:value,parentElement:{closest(selector){
 if(selector.includes('button:not'))return kind==='control'?{}:null;
 return block;
}}});
const nodes=[node('The '),node('occupant load','definition'),node(' shall use '),node('Table 1004.1.3','reference'),node('.'),node(' Areas on other floors'),node('\u00a0\u00a0'),node('Basement','definition'),node('Save passage','control')];
const context=vm.createContext({NodeFilter:{SHOW_TEXT:4,FILTER_REJECT:2,FILTER_ACCEPT:1},
 document:{createTreeWalker(_root,_mask,filter){let i=0;return {nextNode(){while(i<nodes.length){const n=nodes[i++];if(filter.acceptNode(n)===1)return n;}return null;}};}},
 normalizedPassageAnchorText:v=>String(v||'').replace(/\s+/g,' ').trim()});
vm.runInContext(source.slice(start,end),context);
const literal=context.notebookEvidenceTextMap({}, {literalInline:true});
assert.equal(literal.text,'The occupant load shall use Table 1004.1.3. Areas on other floors Basement');
assert.equal(literal.map.length,literal.text.length);
assert(!literal.text.includes('Save passage'));
assert.equal(context.notebookEvidenceMatchIndex(literal.text,{exact:literal.text}),0);
assert.equal(context.notebookEvidenceMatchIndex(literal.text,{exact:'The occupant load shall use Table 1004.1.4.'}),-1,'Different enacted text must not match.');
assert.equal(context.notebookEvidenceMatchIndex(literal.text+' '+literal.text,{exact:literal.text}),-1,'Ambiguous repeated text must remain unresolved.');
console.log('Decorated definition/reference text preserves exact punctuation and unique matching; controls and changed text remain excluded.');
