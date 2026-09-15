import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const root = path.join(repo, 'NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city');
const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value || '';
const text = node => node.tagName === 'br' ? '\n' : node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join(' ');
const clean = value => value.replace(/\s+/g, ' ').trim();
function walk(node, visit) { visit(node); for (const child of node.childNodes || []) walk(child, visit); }
async function filesUnder(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'prepared' || entry.name === 'assets') continue;
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await filesUnder(child));
    else if (entry.name.endsWith('.html')) result.push(child);
  }
  return result;
}
function definitionCandidates(document) {
  const results = [];
  walk(document, node => {
    if (attr(node, 'class').split(/\s+/).includes('defined-term')) {
      const term = attr(node, 'id').replace(/^term-/, '');
      walk(node, child => {
        if (!attr(child, 'class').split(/\s+/).includes('definition__definition')) return;
        const value = clean(text(child));
        if (term && value) results.push({ term, text: value, anchor: attr(node, 'id'), referenceOnly: false });
      });
      return;
    }
    const isRecord = attr(node, 'class').split(/\s+/).includes('rbox');
    if (!isRecord && node.tagName !== 'p' && node.tagName !== 'article') return;
    // Nested paragraph records are represented by their parent rbox only.
    if (!isRecord) {
      for (let parent = node.parentNode; parent; parent = parent.parentNode) {
        if (attr(parent, 'class').split(/\s+/).includes('rbox')) return;
      }
    }
    const raw = text(node);
    const starts = [...raw.matchAll(/(?:^|\n)\s*([A-Z0-9][A-Z0-9 ,’'()\/–—\n-]{1,100})\.\s+/g)];
    for (let i = 0; i < starts.length; i++) {
      const match = starts[i];
      const term = clean(match[1]);
      const value = clean(raw.slice(match.index + match[0].length, starts[i + 1]?.index));
      if (!/[A-Z]/.test(term) || value.length < 8) continue;
      results.push({ term, text: value, anchor: attr(node, 'id') || attr(node.parentNode || {}, 'id'),
        referenceOnly: /^See\b/i.test(value) });
    }
  });
  return results;
}
const report = { schemaVersion: 1, scope: 'web-and-ios-source-corpus',
  status: 'candidate inventory; applicability and pop-up coverage require verification', books: [] };
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const directory = path.join(root, entry.name);
  let bundle;
  try { bundle = JSON.parse(await readFile(path.join(directory, 'bundle.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  const definitionChapters = bundle.chapters.filter(c => /definition/i.test(c.title));
  const htmlFiles = await filesUnder(directory);
  for (const chapter of definitionChapters) {
    const category = bundle.codeSections.find(c => c.id === chapter.codeSectionID);
    const prefix = { 'Building Code': 'bc', 'Plumbing Code': 'pc', 'Mechanical Code': 'mc',
      'Fuel Gas Code': 'fgc', 'Administrative Provisions': 'ac' }[category?.name?.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())];
    const slug = category?.slug || category?.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const nestedRoot = path.join(directory, 'code-sections', slug || '', 'chapters');
    const nestedFiles = htmlFiles.filter(file => path.dirname(file) === nestedRoot);
    const names = [`${chapter.chapterNumber}.html`, `Chapter ${chapter.chapterNumber}.html`, `Appendix ${chapter.chapterNumber}.html`];
    const candidates = nestedFiles.length
      ? nestedFiles.filter(file => names.includes(path.basename(file)))
      : htmlFiles.filter(file => path.dirname(file) === path.join(directory, 'chapters') &&
          (prefix ? path.basename(file) === `${prefix}-${chapter.chapterNumber}.html`
            : path.basename(file) === `${chapter.id}.html` || names.includes(path.basename(file))));
    const book = { bundle: entry.name, code: category?.name || '', chapterID: chapter.id,
      chapter: chapter.chapterNumber, sourceFiles: candidates.map(f => path.relative(root, f)),
      status: candidates.length === 1 ? 'candidate terms extracted; scope not yet validated' : 'source mapping requires review', terms: [] };
    if (candidates.length === 1) {
      const document = parse(await readFile(candidates[0], 'utf8'));
      book.terms = definitionCandidates(document);
      book.referenceOnlyCount = book.terms.filter(t => t.referenceOnly).length;
      book.duplicateTerms = [...new Set(book.terms.filter((t, i, all) => all.findIndex(x => x.term === t.term) !== i).map(t => t.term))];
      if (!book.terms.length) book.status = 'definition format requires an additional parser; no coverage claim';
    }
    report.books.push(book);
  }
}
const output = process.argv[2] || '/tmp/permitext-reader-definition-audit.json';
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output, definitionChapters: report.books.length,
  candidateTerms: report.books.reduce((n, b) => n + b.terms.length, 0),
  referenceOnly: report.books.reduce((n, b) => n + (b.referenceOnlyCount || 0), 0),
  unresolvedChapters: report.books.filter(b => !b.terms.length).map(b => `${b.bundle}/${b.chapter}`) }, null, 2));
