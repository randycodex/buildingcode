// Local project-linked conversation acceptance; uses the enclosing comparison
// preload's shared budget, provider overrides, and fixed verifier.
import {createServer} from 'node:http';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const temporary=await mkdtemp(join(tmpdir(),'permitext-model-conversation-'));
Object.assign(process.env,{NODE_ENV:'',PERMITEXT_SYNC_DATA_PATH:join(temporary,'store.json'),PERMITEXT_LOCAL_PRIVATE_ASSET_PATH:join(temporary,'assets'),PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN:'1',PERMITEXT_SYNC_GRANT_ADMIN_TOKEN:randomUUID()});
const {handleRequest}=await import('../app.mjs');
const server=createServer(handleRequest);await new Promise(r=>server.listen(0,'127.0.0.1',r));
const results=[];
try{
 const request=async(path,body,token)=>{const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};};
 const signed=await request('/account/sign-in',{credential:{provider:'web',providerUserID:randomUUID(),displayName:'Synthetic model comparison'}});
 assert.equal(signed.status,200);
 const account=signed.body.account,token=account.backendSessionToken,auth={accountUserID:account.appUserID};
 const grant=await request('/admin/lifetime-grants/grant',{userID:account.appUserID},process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
 assert.equal(grant.status,200);
 const projectID=randomUUID();
 const projectFixture=JSON.parse(await readFile(new URL('../tests/fixtures/research-transparency-project-facts.json',import.meta.url))); 
 const pushed=await request('/sync/push',{batch:{user:{id:account.appUserID},mutations:[{project:{id:projectID,clientID:projectID,userID:account.appUserID,name:'Synthetic transparency comparison',address:'1070 Southern Blvd, Bronx',description:'Schematic design. Proposed work scope has not been recorded.',structuredFacts:process.env.PERMITEXT_COMPARISON_PROJECT_FACTS ? projectFixture.structuredFacts : [
 ...(process.env.PERMITEXT_COMPARISON_PROJECT_FACTS ? [{key:'lot-width',label:'Lot Width',value:'188.5 ft',status:'sourced'},{key:'special-purpose-district',label:'Special Purpose District',value:'None mapped',status:'sourced'},{key:'stories-above-grade',label:'Stories Above Grade',value:'1',status:'sourced'},{key:'residential-units',label:'Residential Units',value:'0',status:'sourced'},{key:'year-built',label:'Year Built',value:'1966',status:'sourced'}] : []),
 {key:'zoning-districts',label:'Zoning Districts',value:'R7-1',status:'sourced'},
 {key:'commercial-overlays',label:'Commercial Overlays',value:'C2-4',status:'sourced'},
 {key:'appendix-j-designated-m-district',label:'Appendix J Designated M District',value:'Not within a mapped Appendix J designated M district',status:'sourced'}],updatedAt:new Date().toISOString()}}]}},token);
 assert.equal(pushed.status,200);
 const initial='can you explain the transparency requirements for this project?';
 for(let repetition=0;repetition<((process.env.PERMITEXT_COMPARISON_INITIAL_ONLY || process.env.PERMITEXT_COMPARISON_PROJECT_FACTS) ? 1 : 2);repetition++){
  const created=await request('/research/conversations/create',{auth,projectID},token);assert.equal(created.status,201);assert.equal(created.body.conversation.primaryProjectID,projectID);
  const questions=(repetition || process.env.PERMITEXT_COMPARISON_INITIAL_ONLY)?[initial]:[initial,process.env.PERMITEXT_COMPARISON_EXACT_FOLLOWUP === '1' ? 'It’s a new building with ground-floor retail and community facility space' : 'This is a new building with ground-floor retail and community facility space. Where should I measure the 2 feet from?','The sidewalk slopes. If a level sill is 2 feet above the highest sidewalk point and no more than 2 feet 6 inches above the lowest point, does that satisfy the glazing-start height?','what is the governing zr number?'];
  for(const question of (process.env.PERMITEXT_COMPARISON_PROJECT_FACTS && process.env.PERMITEXT_COMPARISON_EXTENDED_FOLLOWUPS !== '1' ? questions.slice(0,2) : questions)){const started=Date.now();const response=await request('/research/conversations/message',{auth,conversationID:created.body.conversation.id,question,requestID:randomUUID()},token);const answer=response.body.conversation?.messages.at(-1)?.answer;
   results.push({repetition,question,status:response.status,seconds:(Date.now()-started)/1000,answer,error:response.body.error});
   await writeFile(join(process.env.PERMITEXT_COMPARISON_DIRECTORY,`${process.env.PERMITEXT_COMPARISON_RUN_ID}-conversation.json`),JSON.stringify(results,null,2));
   console.log('CONVERSATION_RESULT '+JSON.stringify({turn:results.length,status:response.status,mode:answer?.mode,seconds:results.at(-1).seconds}));
   if(response.status!==200)break;
  }
 }
 if (process.env.PERMITEXT_COMPARISON_PROJECT_FACTS) {
  const directory=process.env.PERMITEXT_COMPARISON_DIRECTORY;
  const ledger=JSON.parse(await readFile(join(directory,'ledger.json')));
  const review=ledger.requests.findLast(r=>r.runID===process.env.PERMITEXT_COMPARISON_RUN_ID && r.stage==='permitext_research_verification' && r.status==='settled');
  const template=JSON.parse(await readFile(join(directory,'provider',`${review.id}-request.json`)));
  const split=template.input.lastIndexOf('PROPOSED ANSWER JSON\n');
  assert(split>=0);
  const controls=[];
  for (const claim of ['The community facility building exception in ZR § 32-321 automatically exempts every community-facility space in any mixed-use building.', 'Where ZR § 37-34 applies, only 20 percent transparent glazing is required.']) {
   const requestBody=structuredClone(template);
   const answer=JSON.parse(template.input.slice(split+'PROPOSED ANSWER JSON\n'.length));
   answer.answerText+='\n\n'+claim;
   requestBody.input=template.input.slice(0,split)+'PROPOSED ANSWER JSON\n'+JSON.stringify(answer);
   const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'content-type':'application/json'},body:JSON.stringify(requestBody)});
   const payload=await response.json();
   const value=JSON.parse(payload.output.flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join(''));
   controls.push({claim,result:value});
   await writeFile(join(directory,`${process.env.PERMITEXT_COMPARISON_RUN_ID}-negative-controls.json`),JSON.stringify(controls,null,2));
   assert.equal(value.pass,false,'Incorrect legal scope or numeric requirement must still be rejected.');
   console.log('NEGATIVE_CONTROL_REJECTED '+JSON.stringify({claim,issues:value.issues}));
  }
 }
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(temporary,{recursive:true,force:true});}
