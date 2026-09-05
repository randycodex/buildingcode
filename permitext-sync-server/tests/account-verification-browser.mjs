// Dedicated loopback fixture: actual built React/Clerk hook, synthetic provider.
// No credentials, application configuration, account API, or persistent storage.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const sdkErrors = await build({
  configFile: false, publicDir: false, logLevel: "silent",
  build: { write: false, lib: { entry: fileURLToPath(new URL("./fixtures/account-verification-errors.js", import.meta.url)), formats: ["es"] } }
});
const sdkErrorCode = (Array.isArray(sdkErrors) ? sdkErrors[0] : sdkErrors).output.find((item) => item.type === "chunk").code;

const routes = new Map([
  ["/", new URL("./fixtures/account-verification.html", import.meta.url)],
  ["/runner.js", new URL("./fixtures/account-verification-runner.js", import.meta.url)],
  ["/verification.js", new URL("../public/account-verification-assets/account-verification.js", import.meta.url)]
]);
const server = http.createServer(async (request, response) => {
  const path = new URL(request.url, "http://localhost").pathname;
  const file = routes.get(path);
  if (request.method !== "GET" || (!file && path !== "/sdk-errors.js")) return response.writeHead(404).end();
  try {
    const body = file ? await readFile(file) : sdkErrorCode;
    response.writeHead(200, {
      "Content-Type": path === "/" ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    }).end(body);
  } catch { response.writeHead(500).end("Fixture unavailable"); }
});
server.listen(0, "127.0.0.1", () => console.log(`Account verification fixture: http://127.0.0.1:${server.address().port}/`));
