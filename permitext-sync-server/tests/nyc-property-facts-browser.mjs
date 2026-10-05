// Local browser acceptance for the shipped editor and refresh handler. Uses
// synthetic property responses and an in-memory Project; no account/provider.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { nycMappedFactFields } from "../public/nyc-property-facts.js";
const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function between(start, end) { return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))); }
const editor = between("function appendSavedProjectFactEditor(", "\nconst initialProjectFoundationScopes");
const helpers = between("function normalizeProjectStructuredFact(", "\nfunction projectMutationForRecord(");
const motion = between("function wireProjectSectionMotion(", "\nfunction wireResearchDetailsMotion(");
const chevrons = between("function researchChevronIconsSVG(", "\nfunction setResearchSourceCardExpanded(");
const date = "2026-10-04T12:00:00.000Z";
const property = { bbl: "2028500003", retrievedAt: date, warnings: ["Synthetic Coastal Zone service unavailable; fact remains unknown."],
  structuredFacts: nycMappedFactFields.map(field => ({ ...field, id: `project-fact:${field.key}`,
    source: "nyc-planning", sourceText: "Synthetic browser verification", updatedAt: date,
    status: field.key === "coastal-zone" ? "unknown" : "sourced",
    value: field.key === "parking-geography" ? "Outer Transit Zone" : field.key === "coastal-zone" ? "Unknown — NYC Planning layer unavailable" : field.key === "mih-area-options" ? "Mapped MIH options: Option 1 and Option 3; verify Appendix F" : "Synthetic mapped fact" })) };
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"><style>
body{display:block;overflow:auto;padding:24px}main{max-width:700px;margin:auto}#editor{padding:16px}h1{font-size:20px}#notice{white-space:pre-wrap;margin:16px 0}#state{font-size:12px}button,input{font-family:inherit}
</style></head><body><main><h1>ZoLa structured facts — local verification</h1><p>Synthetic Project and transport; shipped field editor, styles and refresh handler.</p><section id="editor" class="saved-folder-context is-project"></section><p id="notice" role="status"></p><p id="state"></p></main><script type="module">
import {nycMappedFactFields,mergeNYCPropertyFacts,previewNYCPropertyRefresh,applyNYCPropertyRefresh} from '/nyc-property-facts.js';
const projectStructuredFactStatuses = new Set(['stated','confirmed','sourced','unknown','rejected']);
${helpers}
${motion}
${chevrons}
const captureAccountRequest=()=>1,isCurrentAccountRequest=()=>true,requireCurrentAccountRequest=()=>{};
const projectRecordID=folder=>folder.id, safeAnnotationIDPart=value=>value,projectColor=()=>"#334455",folderType=()=>"project";
const projectSectionExpanded=()=>true,persistProjectSectionExpansion=()=>{},clear=element=>element.replaceChildren();
const showWebNotice=async(title,message)=>{document.querySelector('#notice').textContent=title+' — '+message;};
const postResearch=async()=>{await new Promise(resolve=>setTimeout(resolve,100));return {property:${JSON.stringify(property)}};};
const folder={id:'synthetic',name:'Synthetic ZoLa Project',address:'1760 Jerome Avenue',description:'Synthetic conditions',structuredFacts:[{id:'manual',key:'occupancy',label:'Occupancy',value:'Group R-2 — manual',status:'confirmed',source:'user'},{id:'old',key:'coastal-zone',label:'Coastal Zone',value:'Within mapped Coastal Zone — old record',status:'sourced',source:'nyc-planning'}]};
let syntheticSaveAttempts=0;
const updateProjectFolder=async(_folder,details)=>{syntheticSaveAttempts++;const failure=new URL(location.href).searchParams.get('saveFailure');if(syntheticSaveAttempts===1&&failure==='false')return false;if(syntheticSaveAttempts===1&&failure==='throw')throw new Error('Synthetic save failure');Object.assign(folder,details);document.querySelector('#state').textContent='Saved '+folder.structuredFacts.length+' facts. Manual occupancy: '+folder.structuredFacts.find(f=>f.key==='occupancy').value;return true;};
${editor}
appendSavedProjectFactEditor(document.querySelector('#editor'),folder,{...folder});
</script></body></html>`;
const server = createServer(async (request, response) => {
  try {
    if (new URL(request.url, "http://localhost").pathname === "/") {response.setHeader("content-type", "text/html"); response.end(html); return;}
    if (["/styles.css", "/nyc-property-facts.js"].includes(request.url)) {
      response.setHeader("content-type", request.url.endsWith(".css") ? "text/css" : "text/javascript");
      response.end(await readFile(new URL(`../public${request.url}`, import.meta.url))); return;
    }
    response.writeHead(404);response.end();
  } catch {response.writeHead(500);response.end();}
});
server.listen(0, "127.0.0.1", () => console.log(`ZoLa browser fixture: http://127.0.0.1:${server.address().port}`));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
