import assert from "node:assert/strict";
import { createPostgresRateLimitRepository } from "../postgres-rate-limit-repository.mjs";

const now = Date.now();
const warnings = [], originalWarn = console.warn;
console.warn = (...values) => warnings.push(values);
try {
  let count = 0, failCounter = false, failCleanup = true;
  const statements = [];
  const sql = async (strings, ...values) => {
    const query = strings.join("?"); statements.push(query);
    if (query.includes("CREATE")) return [];
    if (query.includes("INSERT INTO")) {
      if (failCounter) throw Object.assign(new Error("Counter unavailable"), { code: "08006" });
      count += 1; return [{ request_count: count, reset_at_ms: now + 60000 }];
    }
    assert.match(query, /FOR UPDATE SKIP LOCKED/);
    assert.equal(count > 0, true, "Cleanup follows a committed counter result.");
    if (failCleanup) throw Object.assign(new Error("Synthetic cleanup failure with private detail"), { code: "40P01" });
    return [];
  };
  const repository = createPostgresRateLimitRepository(sql);
  const consume = () => repository.consume({ scope: "synthetic", principal: "private-principal", limit: 1, windowMs: 60000, now });
  const first = await consume(), second = await consume();
  assert.equal(first.allowed, true); assert.equal(first.count, 1);
  assert.equal(second.allowed, false); assert.equal(second.count, 2);
  assert.equal(warnings.length, 2);
  assert.deepEqual(warnings[0], ["Rate-limit bucket cleanup failed.", { code: "40P01" }]);
  assert.ok(!JSON.stringify(warnings).includes("private"));
  failCleanup = false; failCounter = true;
  const callsBefore = statements.length;
  await assert.rejects(consume, /Counter unavailable/);
  assert.equal(statements.length, callsBefore + 1, "Counter failure must not proceed to maintenance or return an allowance.");
  failCounter = false;
  assert.equal((await consume()).count, 3);
  assert.ok(statements.filter(query => query.includes("INSERT INTO")).every(query => !query.includes("DELETE FROM")),
    "One transaction must not hold its counter lock while acquiring cleanup locks.");
} finally { console.warn = originalWarn; }
console.log("Rate-limit cleanup contract passed: committed exact allowance survives maintenance failure; counter errors remain fail-closed; sanitized warnings.");
