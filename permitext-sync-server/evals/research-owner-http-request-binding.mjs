import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const hash = (value) => createHash("sha256").update(value).digest("hex");

// Separate isolated accounts create fresh Reader passage IDs. Normalize only
// those explicitly declared IDs, retaining their section and every occurrence
// of the binding. Verify a derived context hash before omitting that redundant
// value; the entire context remains bound by the resulting request hash.
export function ownerHTTPResearchRequestHash(body, { normalizeOfficialHTML = false } = {}) {
  assert.equal(typeof body.input, "string");
  if (normalizeOfficialHTML && body.text?.format?.name === "permitext_official_guidance_summary") {
    // The app still sends and persists the real fetched-document hashes. Only
    // this opt-in diagnostic comparison normalizes opaque HTML identifiers:
    // NYC pages inject changing scripts that are outside the extracted text.
    // Preserve every supplied passage field and its exact schema binding.
    const normalized = structuredClone(body), input = JSON.parse(body.input);
    const ids = new Map(), hashes = new Map();
    assert(Array.isArray(input.passages));
    for (const [index, passage] of input.passages.entries()) {
      assert(!ids.has(passage.claimID), "Ambiguous repeated guidance claim identifier.");
      ids.set(passage.claimID, passage.claimID);
      if (passage.page !== null) continue;
      assert(passage.sourceID && /^https:\/\//.test(passage.url) && typeof passage.text === "string");
      assert(/^[a-f0-9]{64}$/.test(passage.contentHash), "Invalid HTML source fingerprint.");
      if (hashes.has(passage.sourceID)) assert.equal(hashes.get(passage.sourceID), passage.contentHash,
        "One HTML source must have a consistent fingerprint.");
      hashes.set(passage.sourceID, passage.contentHash);
      const id = `html-claim:${passage.sourceID}:${index}`;
      ids.set(passage.claimID, id);
      passage.claimID = id;
      passage.contentHash = `html-content:${passage.sourceID}`;
    }
    const claimSchema = normalized.text.format.schema.properties.paragraphs.items.properties.sourceUses.items.properties.claimID;
    assert(Array.isArray(claimSchema.enum) && claimSchema.enum.length === ids.size && new Set(claimSchema.enum).size === ids.size &&
      claimSchema.enum.every((id) => ids.has(id)), "The guidance schema must bind exactly the declared passages.");
    claimSchema.enum = claimSchema.enum.map((id) => ids.get(id));
    normalized.input = JSON.stringify(input);
    normalized.safety_identifier = "isolated-account";
    return hash(JSON.stringify(normalized));
  }
  const derivedIDs = new Map();
  let input = body.input.replace(/^DETERMINISTIC_CONTEXT: (\{.+\})$/gm, (_line, serialized) => {
    const { contextHash, ...context } = JSON.parse(serialized);
    assert.equal(contextHash, hash(JSON.stringify(context)), "Invalid deterministic context hash.");
    for (const obligation of context.answerObligations || []) {
      if (obligation.kind !== "table_legend") continue;
      assert.equal(obligation.sourceIDs.length, 1);
      assert.equal(obligation.values.length, 2);
      const [sourceID] = obligation.sourceIDs, [symbol, meaning] = obligation.values;
      const expectedID = `table_legend_${hash(JSON.stringify(`${sourceID}:${symbol}:${meaning}`)).slice(0, 12)}`;
      assert.equal(obligation.id, expectedID, "Invalid table legend obligation identifier.");
      // This identifier is derived from a random Reader passage ID. Verify it
      // first, then preserve its complete source/symbol/meaning binding while
      // allowing the declared Reader ID normalization below to take effect.
      derivedIDs.set(obligation.id, `table_legend:${sourceID}:${hash(JSON.stringify([symbol, meaning]))}`);
    }
    return `DETERMINISTIC_CONTEXT: ${JSON.stringify(context)}`;
  });
  let serialized = JSON.stringify({ ...body, safety_identifier: "isolated-account", input });
  for (const [id, normalized] of derivedIDs) serialized = serialized.replaceAll(id, normalized);
  const declarations = [...input.matchAll(/^PASSAGE_ID: ([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\nSECTION_ID: ([^\n]+)\n/gm)];
  assert.equal(new Set(declarations.map(([, id]) => id)).size, declarations.length, "Repeated random passage declaration.");
  for (const [index, [, id, sectionID]] of declarations.entries()) {
    serialized = serialized.replaceAll(id, `reader-passage:${sectionID}:${index}`);
  }
  return hash(serialized);
}
