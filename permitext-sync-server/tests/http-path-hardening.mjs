import assert from "node:assert/strict";
import { decodePublicPath, requestMutatesFileStore } from "../app.mjs";

assert.equal(decodePublicPath("app.js"), "app.js");
assert.equal(decodePublicPath("assets%2Ficon.png"), "assets/icon.png");
assert.equal(decodePublicPath("%E0%A4%A"), null);
assert.equal(decodePublicPath("%"), null);

const request = (method, url) => ({ method, url });
assert.equal(requestMutatesFileStore(request("POST", "/sync/pull")), false);
assert.equal(requestMutatesFileStore(request("POST", "/reports/files/read")), false);
assert.equal(requestMutatesFileStore(request("POST", "/research/conversations/list")), false);
assert.equal(requestMutatesFileStore(request("POST", "/sync/push")), true);
assert.equal(requestMutatesFileStore(request("POST", "/reports/drafts/save")), true);
assert.equal(requestMutatesFileStore(request("DELETE", "/account/delete")), true);

console.log("Permitext HTTP path hardening passed.");
