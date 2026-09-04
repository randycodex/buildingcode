// Local-only harness for the actual generated Notebook editor. No account,
// API, database, upload, provider calls, or persistent user data are involved.
// Run npm run build:notebook first, then node tests/notebook-browser-smoke.mjs.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const assets = new URL("../public/notebook-assets/", import.meta.url);
const fixture = new URL("./fixtures/notebook-browser-smoke.html", import.meta.url);
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  const asset = pathname.match(/^\/web\/notebook-assets\/([\w-]+\.(js|css))$/);
  if (request.method !== "GET" || (pathname !== "/" && !asset)) {
    response.writeHead(404).end();
    return;
  }
  try {
    const body = await readFile(asset ? new URL(asset[1], assets) : fixture);
    response.writeHead(200, {
      "content-type": asset ? (asset[2] === "js" ? "text/javascript" : "text/css") : "text/html",
      "cache-control": "no-store"
    }).end(body);
  } catch {
    response.writeHead(404).end();
  }
});
server.listen(8917, "127.0.0.1", () => console.log("Notebook smoke fixture: http://127.0.0.1:8917/ (local-only; Ctrl-C stops it)"));
