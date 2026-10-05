import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const path=resolve(process.argv[2]);const r=JSON.parse(await readFile(path,'utf8'));
const rank=(xs,targets)=>{const i=xs.findIndex(x=>targets.includes(x.sectionNumber));return i<0?null:i+1;};
const rows=r.cases.map(c=>{
 const tokens=c.query.toLowerCase().split(/\W+/).filter(Boolean);
 const titleOrder=c.results.map((x,i)=>({x,i,n:tokens.filter(t=>x.title.toLowerCase().includes(t)).length,exact:x.sectionNumber===c.query})).sort((a,b)=>Number(b.exact)-Number(a.exact)||b.n-a.n||a.i-b.i).map(x=>x.x);
 return {query:c.query,kind:c.kind,total:c.totalResults,baseline:rank(c.results,c.targets),titleOnly:rank(titleOrder,c.targets),jev:c.attempts.map(a=>a.order?rank(a.order.map(id=>c.results.find(x=>x.id===id)),c.targets):null)};
});
const calls=r.cases.flatMap(c=>c.attempts),ms=calls.filter(a=>a.status==='completed').map(a=>a.ms).sort((a,b)=>a-b);
const summary={source:path,status:r.status,rows,calls:calls.length,costUSD:calls.reduce((s,a)=>s+(a.costUSD||0),0),medianAddedMs:ms[Math.ceil(ms.length*.5)-1],p90AddedMs:ms[Math.ceil(ms.length*.9)-1],zeroResults:rows.filter(x=>!x.total).length,targetAbsent:rows.filter(x=>x.baseline===null).length,limitations:r.limitations};
await writeFile(path.replace('.json','.summary.json'),JSON.stringify(summary,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(summary,null,2));
