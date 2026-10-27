import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createResearchV2Budget} from '../research-v2-budget.mjs';

// Explicit local launch only. Both the API and UI require the opt-in; Vercel and
// production environments cannot enable the replacement through a URL flag.
if(!process.argv.includes('--live'))throw new Error('Use --live to enable the user-authorized Luna evaluation budget.');
if(process.env.VERCEL||process.env.NODE_ENV==='production')throw new Error('Research v2 cannot run in a deployed environment.');
const apiKey=process.env.OPENAI_API_KEY||execFileSync('security',['find-generic-password','-a',process.env.USER,'-s','permitext-openai-api-key','-w'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
if(!apiKey.startsWith('sk-'))throw new Error('Luna is not configured in the local Keychain.');
const root=resolve('data/research-v2-local'),budgetPath=resolve('data/research-v2-evaluation/budget-ledger.json');
await mkdir(root,{recursive:true});
for(const key of Object.keys(process.env))if(/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$|BLOB_|CLERK_|STRIPE_|RESEND_|APPLE_.*(?:SECRET|KEY))/.test(key))delete process.env[key];
Object.assign(process.env,{OPENAI_API_KEY:apiKey,NODE_ENV:'development',PERMITEXT_SYNC_DATA_PATH:resolve(root,'store.json'),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH:resolve(root,'assets'),PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN:'1',
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN:randomUUID(),PERMITEXT_RESEARCH_V2:'1',PERMITEXT_RESEARCH_V2_BUDGET_PATH:budgetPath,
  PERMITEXT_RESEARCH_MODEL:'gpt-6-luna',PERMITEXT_RESEARCH_FAST_MODEL:'gpt-6-luna',PERMITEXT_RESEARCH_ROUTING_MODE:'single',
  PERMITEXT_RESEARCH_MAX_REQUEST_USD:'1',PERMITEXT_RESEARCH_USER_DAILY_CAP_USD:'7',PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD:'7',
  PERMITEXT_RESEARCH_DAILY_CAP_USD:'7',PERMITEXT_RESEARCH_MONTHLY_CAP_USD:'7',
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS:'.1',PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS:'.01',
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS:'.5',PERMITEXT_RESEARCH_PRICING_VERSION:'openai-luna-20261026'});
const {handleRequest}=await import('../app.mjs');
const capability=randomUUID();let stored;
const portArgument=process.argv.find(arg=>arg.startsWith('--port='));
const port=portArgument?Number(portArgument.slice(7)):8807;
const server=createServer((request,response)=>{
  if(request.url===`/research-v2-local/${capability}`&&request.method==='GET'){
    response.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer'});
    response.end(`<script>localStorage.setItem('permitext:webAccount:v1',${JSON.stringify(JSON.stringify(stored))});location.replace('/workspace?research=v2')</script>`);return;
  }
  return handleRequest(request,response);
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
const base=`http://127.0.0.1:${server.address().port}`;
async function post(path,body,bearer){const response=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(bearer?{authorization:`Bearer ${bearer}`}:{})},body:JSON.stringify(body)});const value=await response.json();if(!response.ok)throw Error(value.error||'Local setup failed.');return value;}
const credential={provider:'web',providerUserID:'research-v2-local-development',displayName:'Research rebuild · Local'};
let account=(await post('/account/sign-in',{credential})).account;
await post('/admin/lifetime-grants/grant',{userID:account.appUserID},process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
account=(await post('/account/sign-in',{credential})).account;
stored={userID:account.appUserID,sessionToken:account.backendSessionToken,authProvider:'web',displayName:credential.displayName,entitlement:account.entitlement};
const budget=createResearchV2Budget({path:budgetPath});
console.log(JSON.stringify({localResearch:base+`/research-v2-local/${capability}`,model:'gpt-6-luna',budget:await budget.summary(),storage:root}));
