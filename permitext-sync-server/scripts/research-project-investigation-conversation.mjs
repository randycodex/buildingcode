// Project investigation acceptance using the enclosing comparison preload for
// shared budget accounting and explicit model overrides. Never invoke unguarded.
// This session-only live replay depends on the untracked comparison runner and
// preload; it is not a standalone committed-repository acceptance command.
// Local invocation after the shared ledger is settled and the pause is removed:
// node scripts/run-research-model-comparison.mjs --live --case transparency-conversation --project-fact-revision --combination luna-low-priority --investigation --trial <unique-trial>
import {createServer} from 'node:http';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
if(!process.env.PERMITEXT_COMPARISON_DIRECTORY || !process.env.PERMITEXT_COMPARISON_RUN_ID || !process.execArgv.some(argument=>/(?:^|\/)research-model-comparison-preload\.mjs$/.test(argument))) throw Error('Use the bounded comparison runner with its accounting preload for this investigation.');
Object.assign(process.env,{PERMITEXT_COMPARISON_PROJECT_FACTS:'1',PERMITEXT_COMPARISON_EXACT_FOLLOWUP:'1'});
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
 const pushed=await request('/sync/push',{batch:{user:{id:account.appUserID},mutations:[{project:{id:projectID,clientID:projectID,userID:account.appUserID,name:'Synthetic transparency comparison',address:'1070 Southern Blvd, Bronx',description:'Schematic design. Proposed work scope has not been recorded.',structuredFacts:projectFixture.structuredFacts,updatedAt:new Date().toISOString()}}]}},token);
 assert.equal(pushed.status,200);
 const initial='can you explain the transparency requirements for this project?';
 for(let repetition=0;repetition<(process.env.PERMITEXT_COMPARISON_REPEAT_INITIAL === '1' ? 2 : 1);repetition++){
  const created=await request('/research/conversations/create',{auth,projectID},token);assert.equal(created.status,201);assert.equal(created.body.conversation.primaryProjectID,projectID);
  const questions=repetition ? [initial] : [
   initial,
   'It’s a new building with ground-floor retail and community facility space',
   'The sidewalk slopes. If a level sill is 2 feet above the highest sidewalk point and no more than 2 feet 6 inches above the lowest point, does that satisfy the glazing-start height?',
   'what is the governing zr number?',
   'then explain the 141-32',
   'Back to the transparency question for this project: apply the work and ground-floor uses I already described. What can we establish, and what still needs to be checked?'
  ];
  for(const question of questions){const started=Date.now();const response=await request('/research/conversations/message',{auth,conversationID:created.body.conversation.id,question,requestID:randomUUID()},token);const answer=response.body.conversation?.messages.at(-1)?.answer;
   results.push({repetition,question,status:response.status,seconds:(Date.now()-started)/1000,answer,error:response.body.error});
   await writeFile(join(process.env.PERMITEXT_COMPARISON_DIRECTORY,`${process.env.PERMITEXT_COMPARISON_RUN_ID}-conversation.json`),JSON.stringify(results,null,2));
   console.log('CONVERSATION_RESULT '+JSON.stringify({turn:results.length,status:response.status,mode:answer?.mode,seconds:results.at(-1).seconds}));
   assert.equal(response.status,200,`Turn ${results.length} must complete.`);
   assert.equal(response.body.conversation.primaryProjectID,projectID,'Every answer must remain linked to the same project.');
   assert.equal(answer?.mode,'openai',`Turn ${results.length} must provide a substantive answer.`);
   assert.equal(answer?.verification?.pass,true,`Turn ${results.length} must pass review.`);
   const prose=answer?.answerText || '';
   assert(!/I couldn[’']t verify the explanation|Which specific part should we work through first/i.test(prose),'Generic failure copy must not replace the answer.');
   if(!repetition && questions.indexOf(question)>0){
    const nextQuestions=(answer?.followUpQuestions || []).join('\n');
    assert(!/(?:what|which) (?:work|type of work) (?:is|are) proposed\s*\?|is (?:the|this) (?:proposal|project) (?:a |an )?(?:new )?development\s*(?:\?|or (?:a |an )?(?:ground[- ]floor enlargement|change of use))/i.test(nextQuestions),'Do not re-ask the already supplied new-building work scope.');
   }
   assert(!/(?:^|\n)\s*(?:this project|the site|1070 Southern Boulevard)\s+(?:is|lies|falls)\s+(?:located\s+)?(?:in|within)\s+(?:the\s+)?Special Jerome Corridor District/i.test(prose),'Do not invent Special Jerome district membership for this project.');
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
  for (const claim of ['The community facility building exception in ZR § 32-321 automatically exempts every community-facility space in any mixed-use building.', 'Where ZR § 37-34 applies, only 20 percent transparent glazing is required.', 'This project is within the Special Jerome Corridor District, so its special district rules govern this site.']) {
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
