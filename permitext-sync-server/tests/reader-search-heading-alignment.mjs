import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function actual(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf("\n}", start) + 2);
}
const context = vm.createContext({ getComputedStyle: panel => ({ height: String(panel.fadeHeight) }) });
vm.runInContext(["readerSearchMatchScrollTarget", "scrollReaderContentToNode"].map(actual).join("\n"), context);

function reader({ height = 600, contentTop = 70, fadeHeight = 126, matchY = 942, title = true } = {}) {
  const panel = { fadeHeight, classList: { contains: () => false }, getBoundingClientRect: () => ({ top: 70 }) };
  const content = { scrollTop: 0, closest: () => panel,
    getBoundingClientRect: () => ({ top: contentTop, bottom: contentTop + height }),
    scrollTo({ top }) { this.scrollTop = top; } };
  const node = (y, nodeHeight) => ({ getBoundingClientRect: () => ({ top: 70 + y - content.scrollTop, bottom: 70 + y + nodeHeight - content.scrollTop }) });
  const heading = node(900, 22), match = node(matchY, 20);
  const section = { querySelector: () => title ? heading : null };
  const target = context.readerSearchMatchScrollTarget(content, section, match);
  context.scrollReaderContentToNode(content, target);
  return { content, heading, match, target, fadeBottom: 70 + fadeHeight };
}

for (const height of [240, 600, 1000]) {
  const result = reader({ height });
  assert.equal(result.target, result.heading, "A nearby section heading accompanies the matching paragraph.");
  assert.ok(result.heading.getBoundingClientRect().top >= result.fadeBottom, "The Plumbing heading must land below the complete fade.");
  assert.ok(result.match.getBoundingClientRect().bottom <= result.content.getBoundingClientRect().bottom, "The matching words remain visible too.");
}
const deep = reader({ matchY: 2000 });
assert.equal(deep.target, deep.match, "A distant match in a long section stays the scroll destination.");
assert.ok(deep.match.getBoundingClientRect().top >= deep.fadeBottom);
const untitled = reader({ title: false });
assert.equal(untitled.target, untitled.match, "Missing headings retain the exact match destination.");
const earlierMatch = reader({ matchY: 880 });
assert.equal(earlierMatch.target, earlierMatch.match, "A heading after the match cannot hide earlier matching text.");
console.log("Reader search alignment passed: nearby headings clear the fade, matches stay visible at three viewport heights, and deep matches retain their exact target.");
