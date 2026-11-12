import assert from 'node:assert/strict';
import {runResearchV2} from '../research-v2-engine.mjs';
const input={question:'Compare hypothetical Business and Library rows, preserving every table footnote.',
  sources:[{id:'S1',sectionID:'2152',edition:'2022 NYC Construction Codes',text:'Table 1004.1.3. Business 100 gross b, d. Library reading 50 net. a. Floor area per occupant. b. Fixtures may be deducted. c. Group R-2 or R-3 recreational rooftop. d. Where the maximum rooftop or terrace occupant load exceeds 74 persons, a Place of Assembly Certificate of Operation is required.'}]};
const answer={questionTitle:'Hypothetical table comparison',answerText:'The hypothetical comparison uses the quoted rows. [S1]',
  claims:[{text:'The comparison uses the supplied table.',sourceIDs:['S1']}],missingSources:[],missingFacts:[]};
const payload=value=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]});
async function scenario(reviewIssues, options={}) {
  const calls=[];let reviews=0;
  const result=await runResearchV2(input,{...options,call:async(body,context)=>{
    calls.push({body,phase:context.phase});
    if(context.phase==='review') {
      const issues=reviewIssues[reviews++] || [];
      return payload({pass:issues.length===0,issues});
    }
    return payload(answer);
  }});
  return {result,calls};
}
const marker={code:'TABLE_MARKER_LINKAGE',detail:'Keep the actual table row footnote markers.'};
const threshold={code:'FOOTNOTE_D_THRESHOLD_COMPARISON',detail:'Preserve the table footnote threshold, exceeds 74 persons.'};
const recovered=await scenario([[marker],[threshold],[]]);
assert.equal(recovered.result.status,'reviewed');assert.equal(recovered.calls.length,6);
assert.deepEqual(recovered.calls.filter(call=>call.phase==='repair').at(-1).body &&
  JSON.parse(recovered.calls.filter(call=>call.phase==='repair').at(-1).body.input).issues,[marker,threshold]);
assert.equal(new Set(recovered.result.reviews.map(review=>review.checkedPacketHash)).size,1,'Recovery cannot change the evidence or Project snapshot');
const repeated=await scenario([[marker],[marker]]);
assert.equal(repeated.result.status,'review_failed');assert.equal(repeated.calls.length,4);
assert(!repeated.result.draft.claims.length,'Failed generated claims remain withheld');
const unrelated=await scenario([[marker],[{code:'UNSUPPORTED_SCOPE',detail:'Unsupported application to a Project.'}]]);
assert.equal(unrelated.result.status,'review_failed');assert.equal(unrelated.calls.length,4);
const capped=await scenario([[marker],[threshold]],{maxRepairRounds:1});
assert.equal(capped.result.status,'review_failed');assert.equal(capped.calls.length,4,'Explicit caller bounds are respected');
console.log('New table defects recover once automatically; repeated/other failures stop, caller caps and frozen evidence remain intact.');
