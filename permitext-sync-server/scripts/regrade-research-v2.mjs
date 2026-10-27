import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {rejectsUnsupportedRampApproval} from '../evals/research-v2-checks.mjs';
const output=resolve('data/research-v2-evaluation');
const original=JSON.parse(await readFile(resolve(output,'latest-summary.json'),'utf8'));
const results=original.records.map(record=>({id:record.id,status:record.status,
  originalCheck:record.automatedExpectationPassed,
  correctedCheck:record.id==='cross-slope-units'?/48/.test(record.draft?.answerText)&&/2(?:\.0?8)?\s*(?:%|percent)/.test(record.draft?.answerText):record.id==='unsupported-user-instruction'?rejectsUnsupportedRampApproval(record.draft):record.automatedExpectationPassed}));
const report={runID:original.runID,engineSHA256:original.engineSHA256,expectationVersion:'source-rounded-percent-v3',
  reason:'Accept the selected code text’s rounded 2-percent value as well as a calculated 2.08 percent. The earlier regex treated "does not establish that a 1:10 ramp is compliant" as an affirmative compliance assertion.',
  results,originalPassed:results.filter(r=>r.originalCheck&&r.status!=='review_failed').length,
  correctedPassed:results.filter(r=>r.correctedCheck&&r.status!=='review_failed').length,
  newModelCalls:0,limitations:original.limitations};
await writeFile(resolve(output,'runs',original.runID,'regrade.json'),JSON.stringify(report,null,2)+'\n');
await writeFile(resolve(output,'latest-regrade.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
