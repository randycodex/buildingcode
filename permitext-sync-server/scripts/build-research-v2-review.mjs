import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
const data=resolve('data/research-v2-evaluation');
const run=JSON.parse(await readFile(resolve(data,'latest-summary.json'),'utf8'));
const regrade=JSON.parse(await readFile(resolve(data,'latest-regrade.json'),'utf8'));
if(regrade.runID!==run.runID)throw Error('Regrade must match the current run.');
const target=resolve(process.argv[2]||'data/research-v2-evaluation/review/index.html');
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const blocks=run.records.map((r,i)=>`<details ${i===0?'open':''}><summary>${i+1}. ${escape(r.id)} — ${escape(r.status||'error')}</summary>
<h2>${escape(r.question)}</h2><p>Original scripted check: ${r.automatedExpectationPassed?'pass':'fail'}. Corrected check: ${regrade.results.find(x=>x.id===r.id)?.correctedCheck?'pass':'fail'}. Human review: pending.</p>
<div class="answers"><section><h3>Research v2</h3><pre>${escape(r.draft?.answerText||r.error)}</pre><p>${(r.elapsedMilliseconds/1000).toFixed(2)} seconds · ${r.providerCallCount||0} calls</p></section>
<section><h3>Existing Fast prompt</h3><pre>${escape(r.fastComparison?.answerText||r.fastComparison?.error||'Not run')}</pre><p>${((r.fastComparison?.elapsedMilliseconds||0)/1000).toFixed(2)} seconds · unreviewed</p></section></div>
<h3>Exact evidence supplied to both</h3>${(r.sources||[]).map(s=>`<h4>${escape(s.id)} · ${escape(s.title)} · ${escape(s.edition)}</h4><pre>${escape(s.text)}</pre>`).join('')}
${r.history?.length?`<details><summary>Supplied conversation history (${r.history.length} messages)</summary><pre>${escape(r.history.map(m=>m.role+': '+m.text).join('\n\n'))}</pre></details>`:''}
<details><summary>Review findings and unresolved information</summary><pre>${escape(JSON.stringify({missingSources:r.draft?.missingSources,missingFacts:r.draft?.missingFacts,reviews:r.reviews,rejectedDraft:r.rejectedDraft},null,2))}</pre></details>
<p class="review">Review: Does the answer preserve conditions and exceptions? Are citations sufficient? Does it invent facts or overstate compliance? Which answer is more useful, and what would you correct?</p></details>`).join('\n');
await mkdir(dirname(target),{recursive:true});
await writeFile(target,`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Research rebuild — review packet</title><style>
body{font:16px/1.6 system-ui,sans-serif;background:#f5f4f0;color:#232724;margin:0;padding:32px}main{max-width:1200px;margin:auto}h1{font-size:30px}h2{font-size:22px}h3{font-size:17px}details{background:#fff;padding:18px 24px;margin:16px 0;border-radius:14px}summary{cursor:pointer;font-weight:600}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}.answers{display:grid;grid-template-columns:1fr 1fr;gap:30px}.review{background:#f2f4ee;padding:16px;border-radius:10px}small{overflow-wrap:anywhere}@media(max-width:700px){body{padding:12px}.answers{grid-template-columns:1fr}details{padding:14px}}
</style><main><h1>Research rebuild: answers for your review</h1><p>${run.records.length} local evaluation cases, with identical evidence supplied to Research v2 and the existing Fast prompt. The Fast comparison uses nonstreamed transport and its existing six-message history window; it does not represent the old Verified engine or full application latency.</p>
<p><strong>These are not independently verified legal answers.</strong> Scripted checks and Luna's own review are development signals. Please inspect the source text and flag incorrect conclusions, missing conditions, and unclear explanations.</p>
<p>Start with the two slope directions, corridor applicability, edition conflict, and removed-evidence follow-up cases. For the interface, review attaching a passage mid-conversation, opening a citation, and switching numbered questions in the local app.</p>
<small>Run ${escape(run.runID)} · engine ${escape(run.engineSHA256)} · cumulative estimated spend $${run.budget.accountedUSD} of $7 at run completion. The original outputs and failed checks are retained.</small>${blocks}</main></html>`);
console.log(target);
