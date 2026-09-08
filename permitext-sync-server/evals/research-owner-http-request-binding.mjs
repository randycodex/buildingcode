import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const hash = (value) => createHash("sha256").update(value).digest("hex");

// Separate isolated accounts create fresh Reader passage IDs. Normalize only
// those explicitly declared IDs, retaining their section and every occurrence
// of the binding. Verify a derived context hash before omitting that redundant
// value; the entire context remains bound by the resulting request hash.
export function ownerHTTPResearchRequestHash(body) {
  assert.equal(typeof body.input, "string");
  let input = body.input.replace(/^DETERMINISTIC_CONTEXT: (\{.+\})$/gm, (_line, serialized) => {
    const { contextHash, ...context } = JSON.parse(serialized);
    assert.equal(contextHash, hash(JSON.stringify(context)), "Invalid deterministic context hash.");
    return `DETERMINISTIC_CONTEXT: ${JSON.stringify(context)}`;
  });
  let serialized = JSON.stringify({ ...body, safety_identifier: "isolated-account", input });
  const declarations = [...input.matchAll(/^PASSAGE_ID: ([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\nSECTION_ID: ([^\n]+)\n/gm)];
  assert.equal(new Set(declarations.map(([, id]) => id)).size, declarations.length, "Repeated random passage declaration.");
  for (const [index, [, id, sectionID]] of declarations.entries()) {
    serialized = serialized.replaceAll(id, `reader-passage:${sectionID}:${index}`);
  }
  return hash(serialized);
}
