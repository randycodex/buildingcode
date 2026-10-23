// Manual browser acceptance harness. The production modules run on this
// isolated loopback origin; only public GET code data is proxied upstream.
// --source https://permitext.com --deployed also uses deployed browser modules.
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
const option = (name, fallback) =>
  process.argv.includes(name)
    ? process.argv[process.argv.indexOf(name) + 1]
    : fallback;
const source = option("--source", "http://127.0.0.1:8788");
const deployed = process.argv.includes("--deployed");
const output = option(
  "--output",
  "/tmp/permitext-downloaded-library-full.json",
);
const port = Number(option("--port", "8796"));
const headers = {
  "cache-control": "no-store",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-embedder-policy": "require-corp",
};
const root = new URL("../public/", import.meta.url);
async function runner() {
  const library = await import("/web/downloaded-library.js?v=4");
  const status = document.querySelector("#status"),
    output = document.querySelector("#output");
  const report = {
    source: document.querySelector("#source").textContent,
    method:
      "Public browser transport; complete installed corpus; page plus worker memory when supported; not native Chrome process memory",
    checks: [],
    samples: [],
  };
  const show = () => {
    output.textContent = JSON.stringify(report, null, 2);
  };
  const record = (label, value) => {
    report.checks.push({ label, ...value });
    show();
  };
  const assert = (yes, label) => {
    if (!yes) throw Error(label);
  };
  const memory = async (label) => {
    const storage = await navigator.storage.estimate();
    let timer;
    const bytes = typeof performance.measureUserAgentSpecificMemory === "function"
      ? await Promise.race([performance.measureUserAgentSpecificMemory().then(r => r.bytes),
        new Promise(resolve => {timer = setTimeout(() => resolve(null), 12000);})]).finally(() => clearTimeout(timer)) : null;
    report.samples.push({ label, pageAndWorkerBytes: bytes, storage });
    show();
  };
  document.querySelector("#install").onclick = async () => {
    const started = performance.now();
    document.querySelector("#install").disabled = true;
    try {
      const installed = await library.downloadLocalLibrary({
        onProgress(p) {
          status.textContent = `${p.phase} · ${p.completed}/${p.total}`;
        },
      });
      report.install = {chapterCount: installed.chapterCount, sectionCount: installed.sectionCount,
        corpusRevision: installed.corpusRevision, indexRevision: installed.indexRevision};
      report.installMS = performance.now() - started;
      status.textContent = "Complete library installed";
      show();
      await memory("after-install");
    } catch (e) {
      report.error = e.stack;
      status.textContent = e.message;
      show();
    } finally {
      document.querySelector("#install").disabled = false;
    }
  };
  document.querySelector("#check").onclick = async () => {
    document.querySelector("#check").disabled = true;
    try {
      report.checks = [];
      delete report.error;
      const m = await library.downloadedLibraryStatus();
      assert(m.available, "Install first");
      const read = async (path, mode) => {
        const start = performance.now();
        const packet =
          mode === "downloaded"
            ? await library.readDownloadedLibrary(path, { force: true })
            : null;
        if (mode === "downloaded" && !packet)
          throw Error("Downloaded transport fell back: " + path);
        const payload = packet
          ? packet.payload
          : await (await fetch(path)).json();
        return { payload, ms: performance.now() - start };
      };
      const libraries = await read("/code/libraries", "downloaded");
      const sourceScope = JSON.stringify({
        version: 1,
        enabledSources: libraries.payload.codeSources,
      });
      let positions = 0;
      for (const q of [
        "dead end corridor",
        "water supply",
        "occupant load",
        "fire resistance",
        "egress",
        "101.4.3",
      ]) {
        status.textContent = `Comparing complete result order: ${q}`;
        const collected = {};
        for (const mode of ["online", "downloaded"]) {
          const ids = [];
          let offset = 0,
            ms = 0;
          for (let page = 0; page < 30; page++) {
            const path =
              "/code/search?" +
              new URLSearchParams({
                q,
                version: "all",
                match: "words",
                sourceScope,
                limit: 250,
                offset,
              });
            const result = await read(path, mode);
            ms += result.ms;
            ids.push(...result.payload.results.map((r) => r.id));
            if (!result.payload.hasMore) break;
            const next = result.payload.nextOffset;
            assert(next > offset, "Pagination must advance");
            offset = next;
          }
          collected[mode] = { ids, ms };
        }
        if (
          JSON.stringify(collected.online.ids) !==
          JSON.stringify(collected.downloaded.ids)
        ) {
          report.parityFailure = { query: q, ...collected };
          show();
          throw Error(`Result order differs for ${q}`);
        }
        positions += collected.online.ids.length;
        record(q, {
          positions: collected.online.ids.length,
          onlineMS: collected.online.ms,
          downloadedMS: collected.downloaded.ms,
        });
      }
      report.matchedResultPositions = positions;
      const catalog = (await read("/code/chapters?version=all", "downloaded"))
        .payload.chapters;
      const selected = [
        catalog.find((c) => String(c.id) === "1"),
        catalog.find(
          (c) => c.codePrefix === "BC" && c.codeVersion.includes("/2014-"),
        ),
        catalog.find((c) => c.codePrefix === "FGC" && c.chapterNumber === "6"),
        catalog.find((c) => c.codePrefix === "ZR"),
        catalog.find((c) => c.codePrefix === "EC"),
      ].filter(Boolean);
      for (const c of selected) {
        const path = `/code/chapters/${c.id}?bodyContract=2&include=body&bodyStart=0&bodyLimit=25`;
        const a = await read(path, "online"),
          b = await read(path, "downloaded");
        assert(
          JSON.stringify(a.payload.chapter.sections) ===
            JSON.stringify(b.payload.chapter.sections),
          "Reader bodies differ: " + c.id,
        );
        const findPath = `/code/chapters/${c.id}?readerSearch=water`;
        const fa = await read(findPath, "online"),
          fb = await read(findPath, "downloaded");
        assert(
          JSON.stringify(fa.payload.readerSearch.results) ===
            JSON.stringify(fb.payload.readerSearch.results),
          "Reader Find differs: " + c.id,
        );
        record("Reader " + c.id, {
          onlineMS: a.ms,
          downloadedMS: b.ms,
          findMatches: fb.payload.readerSearch.total,
          bodyAndFindParity: true,
        });
      }
      await memory("after-parity");
      for (let round = 0; round < 5; round++) {
        for (const q of [
          "accessible route",
          "water supply",
          "exit signs",
          "sprinkler",
          "stairway",
        ]) {
          await read(
            "/code/search?" +
              new URLSearchParams({
                q,
                version: "all",
                match: "words",
                sourceScope,
                grouped: true,
              }),
            "downloaded",
          );
        }
        for (const c of selected)
          await read(
            `/code/chapters/${c.id}?include=body&bodyContract=2&bodyStart=0&bodyLimit=25`,
            "downloaded",
          );
        await memory(`repeat-${round + 1}`);
      }
      report.passed = true;
      status.textContent =
        "PASS: full corpus, reader bodies, Find and repeated lookups";
      show();
      await fetch("/result", { method: "POST", body: JSON.stringify(report) });
    } catch (e) {
      report.passed = false;
      report.error = e.stack;
      status.textContent = e.message;
      show();
      await fetch("/result", { method: "POST", body: JSON.stringify(report) });
    } finally {
      document.querySelector("#check").disabled = false;
    }
  };
  show();
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://fixture");
  try {
    if (url.pathname === "/") {
      res.writeHead(200, { ...headers, "content-type": "text/html" });
      return res.end(
        `<meta charset="utf-8"><title>Downloaded library acceptance</title><style>body{background:#10151c;color:#e8edf2;font:16px system-ui;margin:32px}button{padding:12px;margin:12px}pre{white-space:pre-wrap}</style><h1>Downloaded library acceptance</h1><p id="source">${source} · ${deployed ? "deployed modules" : "local modules"}</p><button id="install">Install full library</button><button id="check">Run parity and performance checks</button><p id="status" role="status">Ready</p><pre id="output"></pre><script type="module" src="/runner.js"></script>`,
      );
    }
    if (url.pathname === "/runner.js") {
      res.writeHead(200, { ...headers, "content-type": "text/javascript" });
      return res.end(`(${runner.toString()})()`);
    }
    if (url.pathname === "/result" && req.method === "POST") {
      let body = "";
      for await (const c of req) body += c;
      if (body.length > 2_000_000) throw Error("Report too large");
      JSON.parse(body);
      await writeFile(output, body);
      return res.writeHead(200, headers).end("saved");
    }
    if (req.method !== "GET") return res.writeHead(405).end();
    if (
      url.pathname.startsWith("/code/") ||
      (deployed && url.pathname.startsWith("/web/"))
    ) {
      const response = await fetch(source + url.pathname + url.search);
      const outputHeaders = {
        ...Object.fromEntries(response.headers),
        ...headers,
      };
      for (const name of [
        "content-encoding",
        "content-length",
        "transfer-encoding",
        "connection",
      ])
        delete outputHeaders[name];
      res.writeHead(response.status, outputHeaders);
      return res.end(Buffer.from(await response.arrayBuffer()));
    }
    if (
      /^\/web\/(?:[a-z0-9-]+\.js|downloaded-library\/[a-z0-9.-]+)$/.test(
        url.pathname,
      )
    ) {
      const bytes = await readFile(new URL(url.pathname.slice(5), root));
      res.writeHead(200, {
        ...headers,
        "content-type": url.pathname.endsWith(".js")
          ? "text/javascript"
          : url.pathname.endsWith(".json")
            ? "application/json"
            : "application/octet-stream",
      });
      return res.end(bytes);
    }
    res.writeHead(404, headers).end();
  } catch (e) {
    res
      .writeHead(500, { ...headers, "content-type": "application/json" })
      .end(JSON.stringify({ error: e.message }));
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    JSON.stringify({
      url: `http://127.0.0.1:${port}`,
      source,
      deployed,
      output,
    }),
  ),
);
