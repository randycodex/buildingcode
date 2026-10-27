import {readFile} from 'node:fs/promises';
import {researchV2Configuration} from '../research-v2-runtime.mjs';

// Read-only: no application import, database connection or provider request.
const config=researchV2Configuration({...process.env,NODE_ENV:'production'});
const deployment=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
const problems=[...config.problems];
if(Number(deployment.functions?.['api/index.mjs']?.maxDuration)<300||!deployment.functions?.['api/index.mjs']?.maxDuration){
  problems.push('The API function must allow at least 300 seconds for the bounded Research pipeline.');
}
if(process.argv.includes('--require-enabled')&&!config.enabled)problems.push('Research v2 is disabled; activation readiness was requested.');
console.log(JSON.stringify({enabled:config.enabled,ready:problems.length===0,rollout:config.rollout,defaultEngine:config.defaultEngine,spending:config.spending,problems},null,2));
if(problems.length)process.exitCode=1;
