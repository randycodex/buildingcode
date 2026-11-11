import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {researchAnswerURL,linkedResearchAnswerID} from '../public/research-answer-links.js';
import {Element,deferred,tick} from './helpers/research-test-dom.mjs';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const method=app.slice(app.indexOf('let linkedResearchAnswerFlight = null;'),app.indexOf('async function startNewResearchFromSelection('));
const focusMethod=app.slice(app.indexOf('async function focusLinkedResearchAnswer('),app.indexOf('async function openResearchConversation('));
{
  const ready=deferred();let focused=false;
  const c=vm.createContext({whenWorkspacePaneReady:()=>ready.promise,requestAnimationFrame:fn=>fn(),CSS:{escape:value=>value},
    track:{querySelector:()=>({_researchV2View:{focusAnswer:id=>{assert.equal(id,'earlier');focused=true;return true;}}})}});
  vm.runInContext(focusMethod,c);
  const opening=c.focusLinkedResearchAnswer('pane','earlier',()=>true);await tick();
  assert(!focused,'Wait for the actual hydrated view, not only the loading shell');
  ready.resolve(true);assert.equal(await opening,true);assert(focused);
  assert.equal(await c.focusLinkedResearchAnswer('pane','earlier',()=>false),false,'A superseded navigation cannot take focus');
}
function harness(id){
  const target=new Element('article'),calls=[];let active=true;
  const c=vm.createContext({URL,linkedResearchAnswerID,location:{href:researchAnswerURL(id)},activeAccount:()=>active?{userID:'owner'}:null,
    activeWorkspaceID:'other',state:{utilityInstances:[{id:'existing',key:'analysis',conversationID:'conversation'}]},captureAccountRequest:()=>({userID:'owner'}),isCurrentAccountRequest:()=>active,
    requireCurrentAccountRequest:()=>assert(active),CSS:{escape:value=>value},track:{querySelector:selector=>selector.includes(id)?target:null},
    currentContentSummary:()=>({projects:[{id:'raw',clientID:'project'}]}),projectRecordID:p=>p.id,researchProjectID:p=>p.clientID,
    visibleWorkspaceRecords:()=>[{id:'workspace',projectID:'raw'}],
    switchWorkspace:async workspace=>{calls.push(['workspace',workspace]);c.activeWorkspaceID=workspace;return true;},
    switchWorkflowView:async view=>{calls.push(['view',view]);return true;},
    openResearchConversation:async(id,options)=>{calls.push(['open',id,options]);return {id};},
    postResearch:async(path,body)=>{calls.push([path,body]);return path.endsWith('answers/get')?{answer:{id,conversationID:'conversation'}}:{conversation:{id:'conversation',primaryProjectID:'project',messages:[{id}]}};},
    presentWorkspaceIssue:(message,options)=>calls.push(['error',message,options]),
    history:{replaceState:(_state,_title,url)=>{calls.push(['consume',url]);c.location.href='https://per.codes'+url;}}
  });vm.runInContext(method,c);return {c,calls,target,signOut:()=>{active=false;}};
}
for(let n=1;n<=5;n++){
  const id=`qa-answer-${n}:answer`,{c,calls,target}=harness(id);
  assert.equal(await c.resumeLinkedResearchAnswer(),true);
  assert.equal(calls.find(call=>call[0]==='/research/answers/get')[1].answerID,id);
  assert.equal(calls.find(call=>call[0]==='open')[1],'conversation');
  assert.equal(calls.find(call=>call[0]==='open')[2].focusAnswerID,id,'Focus the exact saved answer after the pane finishes opening');
  assert.equal(calls.find(call=>call[0]==='open')[2].instance.id,'existing','Reuse the existing conversation owner');
  assert.equal(linkedResearchAnswerID(c.location.href),'','Consume only a successfully opened URL');
}
{
  const {c}=harness('private:answer');c.openResearchConversation=async()=>null;
  assert.equal(await c.resumeLinkedResearchAnswer(),false);
  assert.equal(linkedResearchAnswerID(c.location.href),'private:answer','A superseded open cannot consume the saved destination');
}
{
  const {c,calls}=harness('private:answer');
  c.postResearch=async()=>{throw new Error('Historical Research answer not found.');};
  assert.equal(await c.resumeLinkedResearchAnswer(),false);
  assert(!calls.some(call=>call[0]==='open'||call[0]==='workspace'),'An unavailable or unauthorized answer cannot redirect the workspace');
  assert.equal(linkedResearchAnswerID(c.location.href),'private:answer','Keep the destination for retry or signing in to the right account');
}
{
  const {c,calls,signOut}=harness('private:answer'),response=deferred();c.postResearch=()=>response.promise;
  const pending=c.resumeLinkedResearchAnswer();signOut();response.resolve({answer:{conversationID:'conversation'},conversation:{id:'conversation'}});
  await pending;assert(!calls.some(call=>call[0]==='open'||call[0]==='workspace'),'A changed account cannot open the old private destination');
}
{
  const {c,calls,signOut}=harness('private:answer');signOut();assert.equal(await c.resumeLinkedResearchAnswer(),false);assert.equal(calls.length,0,'Signed-out links wait for normal sign-in without querying private data');
}
console.log('Saved answer URLs passed: 5 exact-answer destinations, owned API lookup, workspace selection, URL consumption, unavailable-answer recovery and sign-in/account fences.');
