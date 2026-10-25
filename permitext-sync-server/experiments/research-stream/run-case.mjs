// Drives the local experiment, never production. One invocation = one user question.
import { readFile, writeFile } from 'node:fs/promises';
const launch = JSON.parse(await readFile(new URL('./.local/launch.json',import.meta.url),'utf8'));
const cases = {
  office: { sectionIDs:['2152'], question:'Using only the selected 2022 NYC BC 1004.1.3 passage, calculate the occupant load for 6,000 square feet of gross Business areas, entirely indoors, without fixed seating. No rooftop or terrace area is included and no optional fixture or amenity deduction is proposed. Explain the applicable table footnotes and any mandatory condition that could change the result.' },
  title: { sectionIDs:['1'], question:'Based only on this selected passage, what is the code called and how are section numbers designated?' },
  missing: { sectionIDs:['1'], question:'Does this selected passage establish that my proposed four-story office building must have sprinklers? Explain what this passage can actually establish.' },
  web: { sectionIDs:['1'], question:'Find official NYC DOB guidance explaining who provides the owner attestation when submitting a job filing through DOB NOW: Build. Cite the official page and distinguish the guidance from enacted code.' }
  ,webdirect: { sectionIDs:['1'], question:'According to official NYC DOB guidance, may a filing representative attest for the owner in DOB NOW: Build? Explain who must provide the owner attestation, citing the official guidance.' }
};
const name=process.argv[2]||'office', mode=process.argv.includes('--baseline')?'baseline':'stream';
if (!cases[name]) throw new Error('Unknown fixture.');
const started=performance.now(); let firstClientTextMs=null;
const response=await fetch(`${launch.origin}/api/run`,{method:'POST',headers:{'content-type':'application/json','x-prototype-token':launch.token},body:JSON.stringify({...cases[name],mode})});
if(!response.ok)throw new Error(await response.text());
const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',last;
function consume(line){if(!line.trim())return;const e=JSON.parse(line);if(e.type==='delta'&&e.text.trim()&&firstClientTextMs===null){firstClientTextMs=Math.round(performance.now()-started);console.log(JSON.stringify({event:'first_text',case:name,ms:firstClientTextMs}));}
if(e.type==='status')console.log(JSON.stringify(e));if(['result','error'].includes(e.type)){last=e;console.log(JSON.stringify({event:e.type,case:name,mode,firstClientTextMs,status:e.run.status,totalMs:e.run.totalMs,providerRequests:e.run.providerRequests,error:e.error,budget:e.budget}));}}
while(true){const{value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done});const lines=buffer.split('\n');buffer=lines.pop();lines.forEach(consume);if(done)break;}consume(buffer);
await writeFile(new URL(`./.local/${name}-${mode}.json`,import.meta.url),JSON.stringify({...last,firstClientTextMs,clientTotalMs:Math.round(performance.now()-started)},null,2),{mode:0o600});
if(!last)throw new Error('No final event.');
