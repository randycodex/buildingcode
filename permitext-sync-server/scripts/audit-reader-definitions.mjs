import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { extractDefinitionEntries, resolveDefinitionReferences } from '../reader-definition-index.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const root = path.join(repo, 'NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city');
// §24-101 identifies Chapter 1 as the Air Pollution Control Code;
// §24-104 explicitly limits these definitions to that code.
const scopedQuotedSource = (bundle, chapter) => bundle === '2026-enacted-administrative-code'
  && chapter.codeSectionID === 1 && chapter.chapterNumber === '1'
  ? {sectionNumber:'24-104', applicableChapters:['1']} : null;
// HMC §27-2004(a) uses numbered, often multi-paragraph definitions.
// Retain these for scope review before enabling links in application prose.
const housingDefinitions = (bundle, chapter) => bundle === '2026-enacted-administrative-code'
  && chapter.codeSectionID === 5 && chapter.chapterNumber === '1'
  ? {sectionNumber:'27-2004', terms:{
    1:'Department',3:'Dwelling',4:'Family',6:'Private dwelling',7:'Multiple dwelling',
    9:'Class B multiple dwelling',10:'Converted dwelling',11:'Tenement',12:'Hotel',
    13:'Dwelling unit',14:'Apartment',15:'Rooming unit',16:'Rooming house',
    17:'Single room occupancy',18:'Lodging house',19:'Public hall',20:'Public part of a dwelling',
    21:'Living room',22:'Floor area',23:'Dining space',24:'Foyer',25:'Kitchen',26:'Kitchenette',
    27:'Dormitory',28:'Premises',29:'Structure',30:'Alteration',32:'Fire-retarded',
    34:'Court',35:'Story',37:'Cellar',38:'Basement',39:'Shaft',40:'Stair',41:'Firestair',
    42:'Firetower',43:'Fire escape',45:'Owner',46:'Summer resort dwelling',
  }} : null;
function sourceChapter(file, chapters, prefix = '') {
  const name = path.basename(file);
  const matches = chapters.filter(chapter => [
    `${chapter.id}.html`, `${chapter.chapterNumber}.html`,
    `Chapter ${chapter.chapterNumber}.html`, `Appendix ${chapter.chapterNumber}.html`,
    ...(prefix ? [`${prefix}-${chapter.chapterNumber}.html`] : []),
  ].includes(name));
  return matches.length === 1 ? matches[0].chapterNumber : null;
}
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
const report = { schemaVersion: 1, scope: 'web-and-ios-source-corpus',
  status: 'candidate inventory; applicability and pop-up coverage require verification', books: [], codesRequiringSectionDiscovery: [] };
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const directory = path.join(root, entry.name);
  let bundle;
  try { bundle = JSON.parse(await readFile(path.join(directory, 'bundle.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  const definitionChapters = bundle.chapters.filter(c => scopedQuotedSource(entry.name,c) || housingDefinitions(entry.name,c) || /definition/i.test(c.title) ||
    (c.chapterNumber === '2' && bundle.codeSections.find(code => code.id === c.codeSectionID)?.name === 'FIRE CODE') ||
    (c.chapterNumber === '1' && /^(?:GENERAL )?ADMINISTRATIVE (?:PROVISIONS|CODE)$|^ADMINISTRATIVE CODE TITLE 28$|ELECTRICAL CODE/.test(
      bundle.codeSections.find(code => code.id === c.codeSectionID)?.name || '')));
  for (const code of bundle.codeSections) {
    if (!definitionChapters.some(chapter => chapter.codeSectionID === code.id)) {
      report.codesRequiringSectionDiscovery.push({bundle: entry.name, code: code.name, codeSectionID: code.id,
        reason: 'No chapter titled Definitions; inspect definition sections before claiming complete coverage'});
    }
  }
  const htmlFiles = await filesUnder(directory);
  for (const chapter of definitionChapters) {
    const quotedSource = scopedQuotedSource(entry.name,chapter);
    const numberedSource = housingDefinitions(entry.name,chapter);
    const category = bundle.codeSections.find(c => c.id === chapter.codeSectionID);
    const embeddedFireDefinitions = category?.name === 'FIRE CODE' && chapter.chapterNumber === '2';
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
    const book = { bundle: entry.name, code: category?.name || '', codeSectionID: chapter.codeSectionID, chapterID: chapter.id,
      chapter: chapter.chapterNumber, excludeWholeChapter: /definitions|defined terms/i.test(chapter.title), sourceFiles: candidates.map(f => path.relative(root, f)),
      status: candidates.length === 1 ? 'candidate terms extracted; scope not yet validated' : 'source mapping requires review', terms: [] };
    if (candidates.length === 1) {
      const source = await readFile(candidates[0], 'utf8');
      book.sourceSHA256 = createHash('sha256').update(source).digest('hex');
      const scope = /^[RC]\d/.test(chapter.chapterNumber) ? chapter.chapterNumber[0]
        : /^[A-Z]\d/.test(chapter.chapterNumber) ? `appendix-${chapter.chapterNumber[0]}` : 'general';
      book.scope = scope;
      book.terms = extractDefinitionEntries(source, { definitionChapter: true,
        definitionSectionOnly: !/definition/i.test(chapter.title),
        titleCaseLabels: /ELECTRICAL CODE/.test(category?.name || ''),
        quotedLegalLabels:Boolean(quotedSource), numberedLegalLabels:numberedSource }).filter(term => (!embeddedFireDefinitions || term.sectionNumber === '202')
          && (!quotedSource || term.sectionNumber === quotedSource.sectionNumber)
          && (!numberedSource || term.sectionNumber === numberedSource.sectionNumber)).map(term => ({
        ...term, bundle: entry.name, code: category?.name || '', scope,
        // §24-102 also names the board/department of health. Exact-token
        // matching cannot yet distinguish those agencies from §24-104's DEP
        // and environmental control board meanings. Retain, but do not link.
        applicability: numberedSource ? 'review-required' : quotedSource ? (['Board','Department'].includes(term.term) ? 'review-required' : 'definition-chapter') : /ZONING RESOLUTION/.test(category?.name || '') ||
          (/ADMINISTRATIVE (?:PROVISIONS|CODE)/.test(category?.name || '') && term.sectionNumber !== '28-101.5')
          ? 'review-required' : 'definition-chapter',
        chapterID: chapter.id, chapter: chapter.chapterNumber, sourceFile: book.sourceFiles[0],
        ...(quotedSource ? {applicableChapters:quotedSource.applicableChapters} : {}),
      }));
      const citedAppendices=new Set(book.terms.flatMap(term=>{
        const letter=term.text.match(/^See Section ([A-Z])\d+(?:\.\d+)*\.$/i)?.[1]?.toUpperCase();
        return letter ? [letter] : [];
      }));
      const scopedChapters = bundle.chapters.filter(other => other.codeSectionID === chapter.codeSectionID &&
        (scope === 'general' ? !/^[A-Z]\d/.test(other.chapterNumber) || citedAppendices.has(other.chapterNumber[0])
          : other.chapterNumber.startsWith(scope.startsWith('appendix-') ? scope.slice(-1) : scope)));
      const allowedNames = new Set(scopedChapters.flatMap(other => nestedFiles.length
        ? [`${other.chapterNumber}.html`, `Chapter ${other.chapterNumber}.html`, `Appendix ${other.chapterNumber}.html`]
        : prefix ? [`${prefix}-${other.chapterNumber}.html`]
          : [`${other.id}.html`, `${other.chapterNumber}.html`, `Chapter ${other.chapterNumber}.html`]));
      const supportFiles = htmlFiles.filter(file => path.dirname(file) ===
        (nestedFiles.length ? nestedRoot : path.join(directory, 'chapters')) && allowedNames.has(path.basename(file)));
      const supportEntries = [];
      const sentenceDefinitionTargets=book.terms.flatMap(term=>{
        const sectionNumber=term.text.match(/^See Section ((?:\d{2}-)?[A-Z]?\d+(?:\.\d+)*)\.$/i)?.[1];
        return sectionNumber ? [{term:term.term,sectionNumber}] : [];
      });
      for (const file of supportFiles) {
        if (file === candidates[0]) continue;
        supportEntries.push(...extractDefinitionEntries(await readFile(file, 'utf8'),{sentenceDefinitionTargets}).map(term => ({
          ...term, bundle: entry.name, code: category?.name || '',
          scope: /^[A-Z]/.test(sourceChapter(file, scopedChapters, prefix) || '') && scope === 'general'
            ? `appendix-${sourceChapter(file, scopedChapters, prefix)[0]}` : scope,
          chapter: sourceChapter(file, scopedChapters, prefix),
          sourceFile: path.relative(root, file),
        })));
      }
      // Explicit references may point to this edition's Administrative Code.
      // Never substitute the current edition for a historical source.
      for (const administrative of bundle.codeSections.filter(code => /^(?:GENERAL )?ADMINISTRATIVE (?:CODE|PROVISIONS)$/i.test(code.name))) {
        if (administrative.id === category?.id) continue;
        const adminSlug = administrative.slug || administrative.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const adminRoot = path.join(directory, 'code-sections', adminSlug, 'chapters');
        const nestedAdminFiles = htmlFiles.filter(file => path.dirname(file) === adminRoot);
        // Use the same canonical layout as the reader. Legacy flat copies can
        // differ in formatting/content and must not compete with nested sources.
        const adminFiles = nestedAdminFiles.length ? nestedAdminFiles : htmlFiles.filter(file =>
          path.dirname(file) === path.join(directory, 'chapters') && path.basename(file).startsWith('ac-'));
        for (const file of adminFiles) {
          supportEntries.push(...extractDefinitionEntries(await readFile(file, 'utf8')).map(term => ({
            ...term, bundle: entry.name, code: administrative.name, scope: 'general',
            chapter: sourceChapter(file, bundle.chapters.filter(c => c.codeSectionID === administrative.id), 'ac'),
            sourceFile: path.relative(root, file),
          })));
        }
      }
      book.terms = resolveDefinitionReferences(book.terms, [...book.terms, ...supportEntries]);
      book.referenceOnlyCount = book.terms.filter(t => t.referenceOnly).length;
      book.duplicateTerms = [...new Set(book.terms.filter((t, i, all) => all.findIndex(x => x.term === t.term) !== i).map(t => t.term))];
      if (!book.terms.length) book.status = 'definition format requires an additional parser; no coverage claim';
    }
    report.books.push(book);
  }
  if (entry.name === '2026-enacted-administrative-code') {
    const chapter = bundle.chapters.find(c=>c.codeSectionID===5 && c.chapterNumber==='2');
    if (!chapter) throw Error('Housing Maintenance scope source chapter missing');
    const sourceFile = `${entry.name}/chapters/${chapter.id}.html`;
    const html = await readFile(path.join(root,sourceFile),'utf8');
    const terms = extractDefinitionEntries(html,{sentenceDefinitionTargets:[{term:'Private dwelling',sectionNumber:'27-2045'}]})
      .filter(term=>term.term==='Private dwelling' && term.sectionNumber==='27-2045');
    if (terms.length!==1) throw Error('Housing Maintenance private dwelling source changed; review required');
    report.books.push({bundle:entry.name,code:'HOUSING MAINTENANCE CODE',codeSectionID:5,scope:'general',
      chapter:'2',chapterID:chapter.id,excludeWholeChapter:false,sourceFiles:[sourceFile],
      sourceSHA256:createHash('sha256').update(html).digest('hex'),
      terms:terms.map(term=>({...term,bundle:entry.name,code:'HOUSING MAINTENANCE CODE',scope:'general',
        chapter:'2',chapterID:chapter.id,sourceFile,resolution:'direct',applicability:'definition-chapter',
        applicableChapters:['2'],applicableSections:['27-2045']}))});
  }
}
// Explicit appendix references may cross the general/appendix scope boundary,
// but only to the named appendix of this exact code and bundle.
const indexedTerms = report.books.flatMap(book => book.terms);
for (const book of report.books) {
  book.terms = book.terms.map(term => /^See Appendix [A-Z]\.$/i.test(term.text)
    ? resolveDefinitionReferences([term], indexedTerms)[0] : term);
}
const output = process.argv[2] || '/tmp/permitext-reader-definition-audit.json';
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output, definitionChapters: report.books.length,
  candidateTerms: report.books.reduce((n, b) => n + b.terms.length, 0),
  referenceOnly: report.books.reduce((n, b) => n + (b.referenceOnlyCount || 0), 0),
  unresolvedChapters: report.books.filter(b => !b.terms.length).map(b => `${b.bundle}/${b.chapter}`) }, null, 2));
