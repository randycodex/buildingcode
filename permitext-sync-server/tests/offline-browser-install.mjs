// Dedicated loopback origin. No credentials, application config or external
// requests. Optional --corpus points to previously captured public JSON/assets.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { defaultSyncCodeVersion, historicalConstructionSyncCodeVersion } from "../public/sync-identity.js";
const publicRoot = new URL("../public/", import.meta.url);
const corpusArg = process.argv.indexOf("--corpus");
const corpus = corpusArg >= 0 ? resolve(process.argv[corpusArg + 1]) : null;
const portArg = process.argv.indexOf("--port");
const port = portArg >= 0 ? Number(process.argv[portArg + 1]) : 0;
let mode = "synthetic", fail = false;
const chapter = (id, count) => ({ id, codePrefix: "BC", codeVersion: defaultSyncCodeVersion,
  chapterNumber: String(id), sections: Array.from({ length: count }, (_, index) => ({
    id: id * 1000 + index, sectionNumber: `${id}.${index}`, title: `Synthetic section ${index}`,
    blocks: [{ plainText: `Complete synthetic body ${id}/${index}` }]
  })) });
const synthetic = [chapter(1, 63), chapter(2, 3), {
  ...chapter(40000010, 0), codeVersion: historicalConstructionSyncCodeVersion,
  sections: [{ id: 41000010, sectionNumber: "1010.2", title: "Slope", blocks: [{ plainText: "Synthetic historical slope" }] }]
}];
const jsonFile = async name => JSON.parse(await readFile(resolve(corpus, name), "utf8"));
const indexFor = async historical => mode === "captured"
  ? (await jsonFile(historical ? "historical-index.json" : "index.json")).chapters
  : synthetic.filter(value => (value.codeVersion === historicalConstructionSyncCodeVersion) === historical)
    .map(({ sections, ...value }) => ({ ...value, sectionCount: sections.length }));
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Permitext offline installer checks</title>
<style>body{font:16px system-ui;max-width:900px;margin:40px auto;padding:0 20px;background:#10151c;color:#e5eaf0}button{padding:12px;margin:0 12px 12px 0}li{margin:12px 0}.pass{color:#84dfa9}.fail{color:#ff9595}progress{width:100%}pre{white-space:pre-wrap}</style>
<h1>Offline installer verification</h1><p>Isolated browser storage. Synthetic drafts; no sign-in or paid service.</p>
<button id="checks">Run recovery checks</button><button id="full" ${corpus ? "" : "disabled"}>Install captured public library</button>
<button id="reopen" ${corpus ? "" : "disabled"}>Reopen installed citations</button><button id="cleanup">Clean up this test origin</button><progress id="progress" max="100" value="0"></progress>
<p id="status" role="status">Ready</p><ol id="results"></ol><pre id="evidence"></pre>
<script type="module" src="/runner.js"></script></html>`;
const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  const headers = { "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' blob:; object-src 'none'; base-uri 'none'" };
  const json = value => response.writeHead(200, { ...headers, "Content-Type": "application/json" }).end(JSON.stringify(value));
  try {
    if (request.method === "POST" && url.pathname === "/fixture/mode") {
      mode = corpus && url.searchParams.get("source") === "captured" ? "captured" : "synthetic";
      fail = url.searchParams.get("fail") === "1";
      json({ mode, fail }); return;
    }
    if (request.method !== "GET") { response.writeHead(405).end(); return; }
    if (url.pathname === "/") { response.writeHead(200, { ...headers, "Content-Type": "text/html" }).end(html); return; }
    if (url.pathname === "/fixture/expected") {
      const values = [];
      let chapterCount = 0, sectionCount = 0;
      for (const historical of [false, true]) {
        const index = await indexFor(historical);
        chapterCount += index.length;
        sectionCount += index.reduce((count, chapter) => count + chapter.sectionCount, 0);
        const summary = index.find(value => value.codePrefix === "BC" && value.chapterNumber === "10");
        if (!summary) continue;
        const { chapter } = await jsonFile(summary.id + ".json");
        const section = chapter.sections.find(value => value.sectionNumber === "1010.2");
        values.push({ id: section.id, title: section.title, codeVersion: historical ? historicalConstructionSyncCodeVersion : defaultSyncCodeVersion });
      }
      json({ values, chapterCount, sectionCount, assetCount: (await jsonFile("asset-names.json")).length }); return;
    }
    if (url.pathname === "/code/libraries") {
      json(mode === "captured" ? await jsonFile("libraries.json") : { libraries: [
        { id: "nyc-2022-construction-codes", syncCodeVersion: defaultSyncCodeVersion },
        { id: "nyc-2014-construction-codes", syncCodeVersion: historicalConstructionSyncCodeVersion }
      ] }); return;
    }
    if (url.pathname === "/code/chapters") { json({ chapters: await indexFor(url.searchParams.get("version") === historicalConstructionSyncCodeVersion) }); return; }
    const match = url.pathname.match(/^\/code\/chapters\/([a-zA-Z0-9_-]+)$/);
    if (match) {
      const id = match[1];
      const data = mode === "captured" ? (await jsonFile(id + ".json")).chapter : synthetic.find(value => String(value.id) === id);
      const start = Number(url.searchParams.get("bodyStart"));
      const limit = Number(url.searchParams.get("bodyLimit"));
      if (!data || !limit || limit > 25) { response.writeHead(400).end("Expected a bounded body request"); return; }
      if (fail && id === "1" && start === 25) { response.writeHead(500).end("Controlled chapter failure"); return; }
      const end = Math.min(start + limit, data.sections.length);
      json({ chapter: { ...data, sections: data.sections.map((section, index) => index >= start && index < end ? section : { ...section, blocks: undefined }),
        bodyRange: { start, end, total: data.sections.length, complete: start === 0 && end === data.sections.length } } }); return;
    }
    let file;
    if (url.pathname === "/runner.js") file = new URL("./fixtures/offline-install-runner.js", import.meta.url);
    else if (url.pathname === "/service-worker.js") file = new URL("service-worker.js", publicRoot);
    else if (url.pathname.startsWith("/web/")) file = new URL(url.pathname.slice(5), publicRoot);
    else if (corpus && /^\/code\/assets\/[a-zA-Z0-9._-]+$/.test(url.pathname)) file = resolve(corpus, "assets", url.pathname.split("/").at(-1));
    if (!file) { response.writeHead(404).end(); return; }
    const extension = extname(String(file));
    const type = ({ ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" })[extension] || "application/octet-stream";
    const body = await readFile(file);
    response.writeHead(200, { ...headers, "Content-Type": type }).end(body);
  } catch (error) { console.error(error.message); if (!response.headersSent) response.writeHead(500); response.end("Fixture unavailable"); }
});
server.listen(port, "127.0.0.1", () => console.log(`Offline installer fixture: http://127.0.0.1:${server.address().port}/`));
