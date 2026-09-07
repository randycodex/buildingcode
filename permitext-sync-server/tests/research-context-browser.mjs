// Actual shipped Research handlers and recovery UI, with synthetic transport on
// a dedicated loopback origin. No accounts, credentials or external requests.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const publicRoot = new URL("../public/", import.meta.url);
const source = await readFile(new URL("app.js", publicRoot), "utf8");
const names = ["createResearchProgressSession", "researchRequestRecoveryScope", "persistResearchProgressSession",
  "researchConversationContainsCompletedRequest", "restoreResearchProgressSession", "researchProgressElapsed",
  "researchProgressStatusLabel", "renderResearchPixelGrid", "renderResearchProgressCard", "refreshResearchProgressCard",
  "startResearchProgressTimer", "updateResearchProgressSession", "currentResearchProgressConversation",
  "captureResearchProgressView", "researchProgressViewIsCurrent", "researchProgressConversationConflict",
  "runResearchProgressSession", "recoveredResearchProgressCallbacks"];
const handlers = names.map(name => {
  const marker = source.includes(`async function ${name}(`) ? `async function ${name}(` : `function ${name}(`;
  const start = source.indexOf(marker), end = source.indexOf("\n}", start);
  if (start < 0 || end <= start) throw new Error(`Missing shipped handler: ${name}`);
  return source.slice(start, end + 2);
}).join("\n");
const runner = await readFile(new URL("./fixtures/research-context-runner.js", import.meta.url), "utf8");
// Use the shipped composer, including its captured pending-request state and
// input/submit handlers. The surrounding Project/answer panes remain synthetic.
const composerStart = source.indexOf('  const composer = document.createElement("form");', source.indexOf("async function renderResearchConversation("));
const composerEnd = source.indexOf("  dialoguePane.append(composer);", composerStart);
if (composerStart < 0 || composerEnd < composerStart) throw new Error("Missing shipped Research composer");
const composer = `function renderFixtureComposer(conversation, pendingProgress, thread) {
const conversationID = conversation.id, supplemental = false;
${source.slice(composerStart, composerEnd)}
return composer;
}`;
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Research context recovery verification</title><link rel="stylesheet" href="/web/styles.css">
<style>body{overflow:auto;padding:28px}main{max-width:1000px;margin:auto}h1{font-size:25px}button{padding:10px;margin:6px 8px 6px 0}label{display:block;margin:12px 0}pre{white-space:pre-wrap;padding:12px;background:#202020}.workspace-panel{width:100%;height:auto;min-height:200px;padding:22px}.research-question-input{width:100%}#progress{margin-top:20px}</style>
<main><h1>Research context recovery</h1><p>Local verification with the shipped response handlers, review controls and recovery storage. Project transitions and transport responses are synthetic. No sign-in or paid service.</p>
<nav aria-label="Synthetic scenario controls"><button id="start">Start delayed Research in A</button>
<button id="switch">Switch to conversation B</button><button id="project">Select Saved Project B only</button><button id="move">Move pending conversation to B</button>
<button id="success">Deliver older success</button><button id="failure">Deliver older conflict</button>
<button id="reload">Reload fixture</button><button id="cleanup">Clean up fixture</button></nav>
<label><input id="fail-review" type="checkbox"> Fail current-state review</label>
<article class="workspace-panel"><h2 id="current-heading">Current Project</h2><pre id="current" aria-label="Current and saved state"></pre>
<div id="composer"></div>
<p id="question"></p><div id="progress"></div><pre id="receipt" aria-label="Verification receipt"></pre></article></main>
<script type="module" src="/runner.js"></script></html>`;
const routes = new Map([["/web/styles.css", new URL("styles.css", publicRoot)],
  ["/web/research-progress.js", new URL("research-progress.js", publicRoot)],
  ["/fonts/source-serif-4-latin-wght-normal.woff2", new URL("fonts/source-serif-4-latin-wght-normal.woff2", publicRoot)],
  ["/fonts/source-serif-4-latin-wght-italic.woff2", new URL("fonts/source-serif-4-latin-wght-italic.woff2", publicRoot)]]);
const server = createServer(async (request, response) => {
  const path = new URL(request.url, "http://127.0.0.1").pathname;
  if (request.method !== "GET") return response.writeHead(405).end();
  try {
    const file = routes.get(path);
    if (path !== "/" && path !== "/runner.js" && !file) return response.writeHead(404).end();
    const body = path === "/" ? html : path === "/runner.js" ? `${handlers}\n${composer}\n${runner}` : await readFile(file);
    response.writeHead(200, { "Content-Type": path === "/" ? "text/html" : path.endsWith(".css") ? "text/css" : path.endsWith(".woff2") ? "font/woff2" : "text/javascript",
      "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; font-src 'self'; object-src 'none'; base-uri 'none'" }).end(body);
  } catch (error) { console.error(error.message); response.writeHead(500).end("Fixture unavailable"); }
});
const portArgument = process.argv.indexOf("--port");
const port = portArgument >= 0 ? Number(process.argv[portArgument + 1]) : 0;
server.listen(port, "127.0.0.1", () => console.log(`Research context fixture: http://127.0.0.1:${server.address().port}/`));
