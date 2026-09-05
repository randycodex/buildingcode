// Run with node tests/offline-browser-durability.mjs, then open the printed URL.
// The dedicated loopback origin uses synthetic accounts only. It never loads
// application configuration, calls APIs, or clears a user's existing database.
import http from "node:http";
import { readFile } from "node:fs/promises";

const routes = new Map([
  ["/", new URL("./fixtures/offline-durability.html", import.meta.url)],
  ["/client.js", new URL("./fixtures/offline-durability-client.js", import.meta.url)],
  ["/runner.js", new URL("./fixtures/offline-durability-runner.js", import.meta.url)],
  ["/offline-storage.js", new URL("../public/offline-storage.js", import.meta.url)],
  ["/sync-identity.js", new URL("../public/sync-identity.js", import.meta.url)]
]);
const server = http.createServer(async (request, response) => {
  const path = new URL(request.url, "http://localhost").pathname;
  const file = routes.get(path);
  if (request.method !== "GET" || (!file && path !== "/review-ui.js")) {
    response.writeHead(404).end();
    return;
  }
  try {
    let body;
    if (path === "/review-ui.js") {
      const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
      const start = source.indexOf("function notebookRecoveryPlainText(");
      const end = source.indexOf("async function appendNotebookDeviceRecovery(", start);
      if (start < 0 || end < start) throw new Error("Recovery UI boundary missing");
      body = source.slice(start, end) + "\nexport { appendNotebookDraftCopyReview };\n";
    } else body = await readFile(file);
    response.writeHead(200, {
      "Content-Type": path === "/" ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'"
    });
    response.end(body);
  } catch {
    response.writeHead(500).end("Fixture unavailable");
  }
});
server.listen(0, "127.0.0.1", () => console.log(`Offline durability fixture: http://127.0.0.1:${server.address().port}/`));
