import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {defaultSyncCodeVersion} from '../public/sync-identity.js';
const directory=await mkdtemp(join(tmpdir(),'permitext-nine-workflow-'));
for(const key of Object.keys(process.env))if(/DATABASE_URL|POSTGRES_URL|STORAGE_URL|OPENAI|BLOB_|VERCEL_|CLERK/.test(key))delete process.env[key];
Object.assign(process.env,{NODE_ENV:'test',PERMITEXT_SYNC_DATA_PATH:join(directory,'sync.json'),
 PERMITEXT_LOCAL_PRIVATE_ASSET_PATH:join(directory,'assets'),PERMITEXT_SYNC_GRANT_ADMIN_TOKEN:'synthetic-nine-fixes'});
const nativeFetch=globalThis.fetch;let base,server;
globalThis.fetch=(url,options)=>{assert.equal(new URL(url).origin,base,'No external provider calls');return nativeFetch(url,options);};
try{
 const {handleRequest,allSectionCatalogByID}=await import('../app.mjs');
 server=createServer(handleRequest);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
 const userID='apple:synthetic-nine-images',projectID='nine-images-project';let token;
 const post=async(path,body,expected=200,bearer=token)=>{const response=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(bearer?{authorization:`Bearer ${bearer}`}:{})},body:JSON.stringify({auth:{accountUserID:userID},...body})});
  const result=await response.json();assert.equal(response.status,expected,`${path}: ${JSON.stringify(result).slice(0,500)}`);return result;};
 await post('/admin/lifetime-grants/grant',{userID},200,'synthetic-nine-fixes');
 token=(await post('/account/sign-in',{credential:{provider:'apple',providerUserID:'synthetic-nine-images',email:'nine@example.test',displayName:'Synthetic image QA'}})).account.backendSessionToken;
 const numbers=['R102.1','R103.3','M103.1','S101.1','D106.1'];
 const catalog=[...(await allSectionCatalogByID()).values()];
 const sections=numbers.map(number=>catalog.find(s=>s.codePrefix==='BC'&&(s.codeVersion||defaultSyncCodeVersion)===defaultSyncCodeVersion&&s.sectionNumber===number));
 assert(sections.every(Boolean));const now='2026-11-11T15:00:00Z';
 await post('/sync/push',{batch:{user:{id:userID},mutations:[{project:{id:'nine-images-record',clientID:projectID,userID,name:'TEST ONLY - illustrated source workflow',description:'Synthetic verification; no compliance determination.',codeVersion:defaultSyncCodeVersion,colorHex:'#334455',sortOrder:0,updatedAt:now}},
  ...sections.map((section,i)=>({projectSection:{id:`nine-image-section-${i}`,userID,folderClientID:projectID,sectionID:String(section.id),codeVersion:defaultSyncCodeVersion,scope:'section',blockID:'',updatedAt:now}}))]}});
 const palette=await post('/reports/sources/list',{projectID});assert.equal(palette.warnings.length,0,'All five illustrated sources are available');
 const sources=palette.sources.filter(s=>s.kind==='evidence');assert.equal(sources.length,5);
 const blocks=[];const expectedFigures=[3,2,2,15,41];let count=0;
 for(const [i,number]of numbers.entries()){
  const source=sources.find(s=>s.sectionNumber===number);assert(source);
  const preview=await post('/reports/sources/preview',{projectID,kind:'evidence',sourceID:source.id});
  const figures=preview.items.find(item=>item.kind==='evidence').figures;
  assert.equal(figures.length,expectedFigures[i]);count+=figures.length;
  assert.equal(preview.preview.filter(p=>p.kind==='image').length,expectedFigures[i]);
  if(i===0){
   const image=await fetch(base+'/notebook/assets/read',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},
    body:JSON.stringify({auth:{accountUserID:userID},projectID,publicURL:figures[0].url})});
   assert.equal(image.status,200);assert.match(image.headers.get('content-type'),/^image\//);assert((await image.arrayBuffer()).byteLength>1000);
   await post('/notebook/assets/read',{projectID,publicURL:'https://127.0.0.1/private'},400);
   await post('/notebook/assets/read',{projectID:'someone-elses-project',publicURL:figures[0].url},404);
  }
  blocks.push({id:`source-${i}`,kind:'evidence',sourceID:source.id,label:number});
  const note=(await post('/notebook/cards/save',{projectID,expectedVersion:0,clientMutationID:`image-note-${i}`,cardType:'finding',title:`HTTPS code figure ${i+1}`,document:{schema:'permitext-notebook-card',schemaVersion:2,format:'blocknote-json',document:[{type:'image',props:{url:figures[0].url,name:`Official source control ${i+1}`}}]},evidenceLinks:[]},201)).card;
  blocks.push({id:`note-${i}`,kind:'notebookCard',sourceID:note.id,label:note.title});
 }
 const draft=(await post('/reports/drafts/save',{projectID,expectedVersion:0,reportDate:'2026-11-11',title:'TEST ONLY - five illustrated passages and five HTTPS images',blocks},201)).draft;
 const generated=await post('/reports/generate',{projectID,draftID:draft.id,expectedVersion:draft.version},201);
 assert(generated.manifest.sourceVersions.images.length>=count,'Manifest records each immutable image hash');
 const download=await fetch(base+'/reports/files/read',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},
  body:JSON.stringify({auth:{accountUserID:userID},projectID,generatedReportID:generated.generatedReport.file.generatedReportID})});
 assert.equal(download.status,200);const bytes=new Uint8Array(await download.arrayBuffer());
 if(process.env.PERMITEXT_NINE_IMAGES_PDF)await writeFile(process.env.PERMITEXT_NINE_IMAGES_PDF,bytes);
 const pdf=await getDocument({data:bytes,useSystemFonts:true}).promise;let actual=0;
 for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n),ops=await page.getOperatorList();actual+=ops.fnArray.filter(op=>op===OPS.paintImageXObject).length;}
 assert.equal(actual,count+5,'Every source figure and all five HTTPS Note embeds reach the actual issued PDF');
 const firstText=(await(await pdf.getPage(1)).getTextContent()).items.map(i=>i.str).join(' ');assert.match(firstText,/Professional-use notice/);
 console.log(`Image HTTP workflows passed: five illustrated passages, ${count} source figures, five HTTPS Notes, ${actual} PDF images, ${pdf.numPages} pages and hashed immutable image snapshots.`);
 await pdf.destroy();
}finally{if(server)await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});globalThis.fetch=nativeFetch;}
