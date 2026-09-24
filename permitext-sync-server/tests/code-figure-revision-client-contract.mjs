import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function actual(name){const a=source.indexOf(`function ${name}(`),b=source.indexOf('\n}',a);assert.ok(a>=0&&b>a);return source.slice(a,b+2);}
const context=vm.createContext({encodeURIComponent,decodeURIComponent,offlineFeatureMetadata:{assetVersion:'legacy'},rewriteStructuredCodeLinks:x=>x,decorateCodeHTML(){},promoteAuthoredSectionLabels(){},document:{createElement(){return {children:[],append(x){this.children.push(x);},querySelector(){return true;},textContent:''};}}});
vm.runInContext(['codeFigureURL','rewriteCodeHTML','renderCodeBlock'].map(actual).join('\n'),context);
const old='a'.repeat(64),next='b'.repeat(64);
for(const revision of [old,next]){
 const direct=context.renderCodeBlock({kind:'image',imageID:'figure.png',assetRevision:revision});
 assert.equal(direct.children[0].src,`/code/assets/figure.png?assetRevision=${revision}`);
 for(const kind of ['image','html','table']){
  const node=context.renderCodeBlock({kind,html:'<img src="../assets/figure.png"><img src="/code/assets/other.png?v=old"><img src="https://example.com/external.png">',assetRevision:revision});
  assert.ok(node.innerHTML.includes(`figure.png?assetRevision=${revision}`));
  assert.ok(node.innerHTML.includes(`other.png?assetRevision=${revision}`));
  assert.ok(node.innerHTML.includes('https://example.com/external.png'));
 }
}
assert.equal(context.renderCodeBlock({kind:'image',imageID:'figure.png'}).children[0].src,'/code/assets/figure.png?v=legacy');
assert.equal(context.codeFigureURL('figure.png','invalid'),'\/code/assets/figure.png?v=legacy');
console.log('Figure revision rendering passed: chapter-owned old/new URLs, authored image/table HTML, external URLs and legacy compatibility.');
