import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile, readdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {constructionHTMLBodyForSection} from '../construction-html-content.mjs';

const serverRoot = new URL('../', import.meta.url);
const root = new URL('../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2022-construction-codes/', serverRoot);
const legacy = new URL('../NYC CC APP/NYCCCApp/Resources/CodeContent/authored/new-york-city/2022-construction-codes/prepared/sections/', serverRoot);
const write = process.argv.includes('--write');
assert(process.argv.slice(2).every(arg => ['--write', '--check'].includes(arg)) &&
  !(write && process.argv.includes('--check')), 'Use --write or --check.');
const readJSON = async path => JSON.parse(await readFile(path, 'utf8'));
const optionalJSON = async path => {try {return await readJSON(path);} catch(error) {if(error.code === 'ENOENT') return null; throw error;}};
const pending = new Map();
async function saveJSON(path, value) {
  const raw = await readFile(path, 'utf8').catch(error => {if(error.code === 'ENOENT') return ''; throw error;});
  if (raw && isDeepStrictEqual(JSON.parse(raw), value)) return;
  let text = JSON.stringify(value, null, raw.includes('\n  ') ? 2 : undefined);
  // Keep the native JSONEncoder format when repairing its numeric metadata.
  if (/^\s*"[^"\n]+" : /m.test(raw)) text = text
    .replace(/^(\s*"(?:[^"\\]|\\.)+"):/gm, '$1 :')
    .replace(/^(\s*)("[^"\n]+" : )\[\](,?)$/gm, '$1$2[\n\n$1]$3')
    .replace(/\//g, '\\/');
  text += '\n';
  pending.set(path.href, text);
  if (write) await writeFile(path, text);
}
const bundlePath = new URL('bundle.json', root), manifestPath = new URL('prepared/manifest.json', root);
const compactPath = new URL('prepared/chapterCatalog.json', root), indexPath = new URL('prepared/searchIndex.json', root);
const idsPath = new URL('config/canonical-section-ids.json', serverRoot);
const [bundle, manifest, compact, index, ids] = await Promise.all([bundlePath, manifestPath, compactPath, indexPath, idsPath].map(readJSON));
const prefixes = {1:'BC',3:'AC',4:'FGC',5:'PC',6:'MC'};
const chapters = new Map();
for (const meta of manifest.chapters) chapters.set(meta.chapterID, await readJSON(new URL(`prepared/chapters/${meta.chapterID}.json`, root)));
const existingIDs = new Set([...chapters.values()].flatMap(chapter => chapter.groups.flatMap(group => group.sections.map(section => section.id))));
const before = new Map();
for (const name of await readdir(new URL('prepared/sections/', root))) {
  if (/^\d+\.json$/.test(name)) before.set(Number.parseInt(name), await readFile(new URL(`prepared/sections/${name}`, root), 'utf8'));
}

const standards = [
  {codePrefix:'BC',chapterID:35,chapterNumber:'35',sectionNumber:'3502'},
  {codePrefix:'FGC',chapterID:73,chapterNumber:'8',sectionNumber:'802'},
  {codePrefix:'MC',chapterID:96,chapterNumber:'15',sectionNumber:'1502'},
  {codePrefix:'PC',chapterID:118,chapterNumber:'15',sectionNumber:'1502'}
];
for (const spec of standards) {
  const chapter = chapters.get(spec.chapterID);
  let section = chapter.groups.flatMap(group => group.sections).find(section => section.sectionNumber === spec.sectionNumber);
  if (!section) {
    const id = ids.byCodeChapterSection[`${spec.codePrefix}:${spec.chapterNumber}:${spec.sectionNumber}`] || bundle.nextSectionID++;
    assert(!existingIDs.has(id), `Section ID ${id} is already assigned.`);
    existingIDs.add(id);
    section = {id,kind:'textBlock',sectionNumber:spec.sectionNumber,title:`SECTION ${spec.sectionNumber}: Standards`};
    const headerLine = `SECTION ${spec.codePrefix} ${spec.sectionNumber}`;
    chapter.groups.push({headerLine,headingLine:'STANDARDS',id:headerLine,sections:[section]});
    await saveJSON(new URL(`prepared/chapters/${spec.chapterID}.json`, root), chapter);
  }
  spec.id = section.id;
  const key = `${spec.codePrefix}:${spec.chapterNumber}:${spec.sectionNumber}`;
  assert(!ids.byCodeChapterSection[key] || ids.byCodeChapterSection[key] === section.id, `Existing identity changed for ${key}.`);
  ids.byCodeChapterSection[key] = section.id;
  const body = await constructionHTMLBodyForSection({...spec,title:section.title});
  assert(body?.blocks.some(block => /<table\b/i.test(block.html || '')), `Missing official standards tables for ${key}.`);
  await saveJSON(new URL(`prepared/sections/${section.id}.json`, root), body);
  const entry = compact.chapters.find(entry => entry[0] === spec.chapterID);
  assert(entry, `Missing compact chapter ${spec.chapterID}.`);
  entry[1] = chapter.groups.map(group => [group.id,group.headerLine,group.headingLine ?? null,
    group.headerRTFData ?? null,group.headingRTFData ?? null,
    group.sections.map(section => [section.id,section.sectionNumber,section.title,section.kind])]);
}
await saveJSON(bundlePath, bundle);
await saveJSON(idsPath, ids);
await saveJSON(compactPath, compact);

// Check mode never runs preparation against a hypothetical, unwritten catalog.
if (!write && pending.size) {
  console.error(`Construction standards metadata/bodies need repair (${pending.size} files); run with --write.`);
  process.exitCode = 1;
} else {
  const prepared = spawnSync(process.execPath, [fileURLToPath(new URL('prepare-construction-section-bodies.mjs', import.meta.url)), write ? '--write' : '--check'],
    {cwd:fileURLToPath(serverRoot), encoding:'utf8'});
  if (prepared.stdout) process.stdout.write(prepared.stdout);
  assert.equal(prepared.status, 0, prepared.stderr || 'Construction preparation failed.');
  const changedIDs = new Set(standards.map(section => section.id));
  const allSections = new Map([...chapters.values()].flatMap(chapter => chapter.groups.flatMap(group =>
    group.sections.map(section => ({...section,chapterID:chapter.chapterID}))))
    .map(section => [section.id, section]));
  for (const [id, raw] of before) {
    const current = await readFile(new URL(`prepared/sections/${id}.json`, root), 'utf8').catch(error => {if(error.code === 'ENOENT') return null; throw error;});
    if (current !== raw) changedIDs.add(id);
  }
  const parentChapters = new Set();
  for (const name of await readdir(new URL('prepared/sections/', root))) {
    if (!/^\d+\.json$/.test(name)) continue;
    const id = Number.parseInt(name), section = allSections.get(id);
    if (!before.has(id)) changedIDs.add(id);
    if (section?.kind !== 'textBlock') continue;
    const body = await readJSON(new URL(`prepared/sections/${name}`, root));
    if (body.sourceHTMLPath) {changedIDs.add(id);parentChapters.add(section.chapterID);}
  }
  // Match AuthoredCodeStore's whole-token index without changing any unrelated
  // posting. Standards terms move to their own stable section identities.
  const tokenize = text => (text.toLowerCase().match(/[\p{L}\p{N}.-]+/gu) || []).filter(token => [...token].length >= 2);
  for (const token of Object.keys(index.tokens)) {
    index.tokens[token] = index.tokens[token].filter(id => !changedIDs.has(id));
    if (!index.tokens[token].length) delete index.tokens[token];
  }
  for (const id of changedIDs) {
    const section = allSections.get(id);assert(section, `Missing section metadata ${id}.`);
    const body = await optionalJSON(new URL(`prepared/sections/${id}.json`, root));
    const text = [section.sectionNumber,section.title,...(body?.blocks || []).map(block => block.plainText || '')].join(' ');
    for (const token of new Set(tokenize(text))) {
      index.tokens[token] ||= [];
      index.tokens[token].push(id);
      index.tokens[token].sort((left, right) => left - right);
    }
  }
  await saveJSON(indexPath, index);
  for (const chapterID of new Set([...standards.map(section => section.chapterID),71,...parentChapters])) {
    const chapter = chapters.get(chapterID), meta = manifest.chapters.find(meta => meta.chapterID === chapterID);
    const sections = chapter.groups.flatMap(group => group.sections);
    const bodies = await Promise.all(sections.map(async section => await optionalJSON(new URL(`prepared/sections/${section.id}.json`, root)) || await optionalJSON(new URL(`${section.id}.json`, legacy))));
    meta.sectionCount = sections.length;
    meta.preparedSectionCount = bodies.filter(Boolean).length;
    meta.blockCount = bodies.reduce((sum, body) => sum + (body?.blocks?.length || 0), 0);
  }
  await saveJSON(manifestPath, manifest);
  console.log(JSON.stringify({mode:write?'write':'check',standards,updatedFiles:pending.size,refreshedSearchSections:changedIDs.size}));
  if (!write && pending.size) process.exitCode = 1;
}
