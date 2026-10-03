import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const extract = (name) => {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, `Missing ${name}`);
  const end = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, end < 0 ? undefined : end);
};
const context = vm.createContext({});
vm.runInContext(extract("researchAnswerDisplayMarkdown"), context);
const format = (text) => context.researchAnswerDisplayMarkdown(text);
const unchangedWords = (text, formatted = false) => String(text)
  .replace(formatted ? /(?:^|\n)\d+\.\s+/g : /\([1-9]\d*\)\s+/g, " ")
  .replace(/\s+/g, " ").trim();

const alternatives = "Use one qualifying method (PC § 314.2.3): (1) a secondary pan with a conspicuous drain; (2) an overflow line above the primary connection; (3) a pan without a drain, with a listed detector stopping equipment before overflow; or (4) a listed detector stopping equipment when the primary drain blocks. For method 3, retain the pan’s stated construction conditions. All stated installation conditions still apply (PC § 314.2.3).";
const expected = "Use one qualifying method (PC § 314.2.3):\n\n1. a secondary pan with a conspicuous drain;\n2. an overflow line above the primary connection;\n3. a pan without a drain, with a listed detector stopping equipment before overflow;\n4. or a listed detector stopping equipment when the primary drain blocks.\n\nFor method 3, retain the pan’s stated construction conditions. All stated installation conditions still apply (PC § 314.2.3).";
assert.equal(format(alternatives), expected);
assert.equal(unchangedWords(expected, true), unchangedWords(alternatives), "Words, conjunctions, punctuation, conditions and citations remain in order.");
assert.equal(format(expected), expected, "Display normalization is idempotent.");
for (const conjunction of ["", "and ", "or ", "OR "]) {
  const text = `Available controls: (1) close the valve; ${conjunction}(2) stop the fan.`;
  assert.equal(format(text), `Available controls:\n\n1. close the valve;\n2. ${conjunction}stop the fan.`);
  assert.equal(unchangedWords(format(text), true), unchangedWords(text));
}
const six = `Select a qualifying response: ${Array.from({ length: 6 }, (_, index) => `(${index + 1}) preserve condition number ${index + 1}`).join("; ")}.`;
assert.equal(format(six).split("\n").filter((line) => /^\d+\. /.test(line)).length, 6);
assert.equal(unchangedWords(format(six), true), unchangedWords(six));
const second = "Another choice: (1) stop the pump; (2) close the valve.";
assert.equal(format(`${alternatives}\n\n${second}`), `${expected}\n\nAnother choice:\n\n1. stop the pump;\n2. close the valve.`);

for (const protectedText of [
  "See PC § 314.2.3(1), (2), and (3), with their exceptions.",
  "Cited references: (1) PC § 314.2.3; (2) FGC § 404.12.",
  'The source says "Controls: (1) close the valve; (2) stop the fan."',
  "The source says ‘Controls: (1) close the valve; (2) stop the fan.’",
  "The source says 'Controls: (1) close the valve; (2) stop the fan.'",
  "> Controls: (1) close the valve; (2) stop the fan.",
  "`Controls: (1) close the valve; (2) stop the fan.`",
  "    Controls: (1) close the valve; (2) stop the fan.",
  "```text\nControls: (1) close the valve; (2) stop the fan.\n```",
  "~~~text\nControls: (1) close the valve; (2) stop the fan.\n~~~",
  "| Method | Condition |\n| --- | --- |\n| Controls: (1) close the valve; (2) stop the fan. | Listed |",
  "1. Controls: (1) close the valve; (2) stop the fan.",
  "Controls: (1) close the valve; (3) stop the fan.",
  "Controls: (1) close the valve; (1) stop the fan.",
  "Controls (1) close the valve; (2) stop the fan.",
  "Controls: (1) close the valve, (2) stop the fan.",
  "Controls: (1) close the valve; (2) stop the fan. It must be listed.",
  "Controls: (1) close the valve; (2) stop the fan (unless condition applies. For method 1, preserve that condition.",
  "Controls: (1) close the valve (Item (2) controls); (2) stop the fan."
]) assert.equal(format(protectedText), protectedText, `Ambiguous/protected text changed: ${protectedText}`);

class Element {
  constructor(name) { this.localName = name; this.children = []; this.attributes = {}; this.className = ""; }
  append(...children) { this.children.push(...children); }
  setAttribute(name, value) { this.attributes[name] = value; }
  get textContent() { return this.children.map((child) => typeof child === "string" ? child : child.textContent).join(""); }
  set textContent(text) { this.children = [String(text)]; }
}
context.document = { createElement: (name) => new Element(name), createTextNode: (text) => ({ textContent: text }) };
vm.runInContext(["researchDisplayText", "researchAnswerNarrativeText", "appendResearchInlineFormatting", "appendResearchInlineLines", "researchAnswerTable", "appendResearchAnswerNarrative"].map(extract).join("\n"), context);
const saved = Object.freeze({ answerText: alternatives, mode: "openai", verification: Object.freeze({ status: "verified" }) });
const container = new Element("article");
context.appendResearchAnswerNarrative(container, saved);
const narrative = container.children[0];
assert.deepEqual(narrative.children.map((element) => element.localName), ["p", "ol", "p"]);
assert.equal(narrative.children[1].children.length, 4);
assert.match(narrative.children[1].children[3].textContent, /^or a listed detector/);
assert.match(narrative.children[2].textContent, /^For method 3,/);
assert.equal(saved.answerText, alternatives, "Stored verified answer remains unchanged.");
assert.equal(context.researchAnswerNarrativeText(saved), alternatives, "Copy/export narrative stays original.");
const quoteContainer = new Element("article");
context.appendResearchAnswerNarrative(quoteContainer, { answerText: "> Controls: (1) close the valve; (2) stop the fan." });
assert.equal(quoteContainer.children[0].children[0].localName, "blockquote");
const tableContainer = new Element("article");
context.appendResearchAnswerNarrative(tableContainer, { answerText: "| Method | Condition |\n| --- | --- |\n| Listed detector | Before overflow |" });
assert.equal(tableContainer.children[0].children[0].className, "research-answer-table-scroll");
console.log("Inline alternatives display contract passed: conservative contiguous lists, unchanged legal/quoted/code/table text, intact conjunctions/conditions/citations, renderer list and immutable stored/copy answer.");
