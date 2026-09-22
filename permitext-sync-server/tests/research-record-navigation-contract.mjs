import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { researchPracticalNextStepPrompt } from '../research-practical-next-step.mjs';
const url = 'https://www.nyc.gov/site/buildings/dob/find-building-data.page';
for (const target of ['Is this a prior-code building?', 'What is the approved occupancy?', 'Which code basis applies?']) {
  const prompt = researchPracticalNextStepPrompt(target);
  assert(prompt.includes(url));
  assert(prompt.includes('not evidence that any project record has been retrieved'));
  assert(prompt.includes('neither portal alone is exhaustive'));
}
assert(!researchPracticalNextStepPrompt('What is the alteration value?').includes(url));
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const start = source.indexOf('function appendResearchInlineFormatting(');
const end = source.indexOf('\nfunction appendResearchInlineLines', start);
const element = tag => ({ tag, children: [], append(child) { this.children.push(child); } });
const document = { createElement: element, createTextNode: text => ({ text }) };
const render = runInNewContext(source.slice(start, end) + '\nappendResearchInlineFormatting', { document });
const root = element('p');
render(root, `Start at [DOB records](${url}), then **check the filing** and *its code basis*.`);
const link = root.children.find(n => n.tag === 'a');
assert.equal(link.href, url); assert.equal(link.textContent, 'DOB records');
assert.equal(link.target, '_blank'); assert.equal(link.rel, 'noopener noreferrer');
assert(root.children.some(n => n.tag === 'strong' && n.textContent === 'check the filing'));
assert(root.children.some(n => n.tag === 'em' && n.textContent === 'its code basis'));
for (const unsafe of ['javascript:alert(1)', 'https://www.nyc.gov.evil.test/', `${url}?tracking=secret`, 'https://example.com']) {
  const node = element('p'); render(node, `[Link](${unsafe})`);
  assert(!node.children.some(n => n.tag === 'a'));
}
const escaped = element('p'); render(escaped, `[<img src=x onerror=alert(1)>](${url})`);
assert.equal(escaped.children[0].textContent, '<img src=x onerror=alert(1)>');
console.log('Research record navigation: maintained destination, scope and safe formatting passed.');
