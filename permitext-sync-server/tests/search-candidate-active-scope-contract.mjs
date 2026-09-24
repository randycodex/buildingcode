import assert from "node:assert/strict";
import { candidateSectionIDs } from "../app.mjs";
import { intersectCandidateIDsWithPosting } from "../search-postings.mjs";

// Frozen pre-scope algorithm: compare insertion order as well as membership.
function baseline(index, queryTokens, normalizedQuery, query) {
  const size = posting => posting instanceof Set ? posting.size : posting.length;
  const postings = queryTokens.map(token => index.get(token) || [])
    .sort((left, right) => size(left) - size(right));
  let candidates = new Set(postings[0] || []);
  for (const posting of postings.slice(1)) {
    if (!candidates.size) break;
    candidates = intersectCandidateIDsWithPosting(candidates, posting);
  }
  if (/^[A-Za-z]?\d/.test(query)) {
    for (const [token, ids] of index) {
      if (token.startsWith(normalizedQuery)) {
        for (const id of ids) candidates.add(id);
      }
    }
  }
  return candidates;
}

const fixtures = [
  new Map([
    ["concrete", new Set([9, 2, 7, 4])], ["walls", new Set([4, 2])],
    ["2", new Set([7])], ["2.1", new Set([9, 2])], ["2.10", new Set([4])],
    ["a2", new Set([2])], ["a2.1", new Set([7, 4])]
  ]),
  new Map([
    ["concrete", new Uint32Array([2, 4, 7, 9])], ["walls", new Uint32Array([2, 4])],
    ["2", new Uint32Array([7])], ["2.1", new Uint32Array([2, 9])], ["2.10", [4]],
    ["a2", [2]], ["a2.1", [4, 7]]
  ])
];
const queries = [
  [["concrete"], "concrete"], [["concrete", "walls"], "concrete walls"],
  [["walls", "concrete"], "walls concrete"], [["2"], "2"],
  [["a2"], "a2"], [["2", "walls"], "2 walls"],
  [["missing"], "missing"], [["concrete", "missing"], "concrete missing"], [[], ""]
];
for (const index of fixtures) {
  const before = [...index].map(([token, ids]) => [token, [...ids]]);
  for (const [tokens, query] of queries) {
    const expected = [...baseline(index, tokens, query.toLowerCase(), query)];
    assert.deepEqual([...candidateSectionIDs(index, tokens, query.toLowerCase(), query)], expected);
    assert.deepEqual([...candidateSectionIDs(index, tokens, query.toLowerCase(), query, null)], expected);
    for (const allowed of [new Set(), new Set([2, 4]), new Set([9, 7]), new Set([999]), new Set([2, 4, 7, 9])]) {
      assert.deepEqual([...candidateSectionIDs(index, tokens, query.toLowerCase(), query, allowed)],
        expected.filter(id => allowed.has(id)), `${query}: scoped order differs`);
    }
  }
  assert.deepEqual([...index].map(([token, ids]) => [token, [...ids]]), before, "Shared index must not mutate");
}
const inaccessibleIndex = new Proxy(new Map(), { get() { throw new Error("Empty scope touched index"); } });
assert.deepEqual([...candidateSectionIDs(inaccessibleIndex, ["2"], "2", "2", new Set())], []);
console.log("Active candidate scope passed: frozen default/order parity, Set/typed postings, phrase/numeric unions, scope intersection and empty scope zero index access.");
