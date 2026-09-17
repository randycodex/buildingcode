import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { extractDefinitionEntries, resolveDefinitionReferences, definitionKey } from '../reader-definition-index.mjs';
import { bindStormwaterDefinitions } from './definition-sources/bind-stormwater-definitions.mjs';
import { bindCitationMismatches } from './definition-sources/bind-citation-mismatches.mjs';
import { bindEarthquakeDefinition, bindSeismicDefinitionScopes } from './definition-sources/bind-earthquake-definition.mjs';
import { bindConstructionTypes } from './definition-sources/bind-construction-types.mjs';
import {isDeedRestrictionChapter,extractDeedRestrictionDefinitions} from './definition-sources/deed-restriction-definitions.mjs';

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
  const definitionChapters = bundle.chapters.filter(c => isDeedRestrictionChapter(entry.name,c) || scopedQuotedSource(entry.name,c) || housingDefinitions(entry.name,c) || /definition/i.test(c.title) ||
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
    const deedSource = isDeedRestrictionChapter(entry.name,chapter);
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
      book.terms = (deedSource ? extractDeedRestrictionDefinitions(source) : extractDefinitionEntries(source, { definitionChapter: true,
        definitionSectionOnly: !/definition/i.test(chapter.title),
        titleCaseLabels: /ELECTRICAL CODE/.test(category?.name || ''),
        quotedLegalLabels:Boolean(quotedSource), numberedLegalLabels:numberedSource })).filter(term => (!embeddedFireDefinitions || term.sectionNumber === '202')
          && (!quotedSource || term.sectionNumber === quotedSource.sectionNumber)
          && (!numberedSource || term.sectionNumber === numberedSource.sectionNumber)).map(term => ({
        ...term, bundle: entry.name, code: category?.name || '', scope,
        // §24-102 also names the board/department of health. Exact-token
        // matching cannot yet distinguish those agencies from §24-104's DEP
        // and environmental control board meanings. Retain, but do not link.
        applicability: deedSource ? term.applicability : numberedSource ? 'review-required' : quotedSource ? (['Board','Department'].includes(term.term) ? 'review-required' : 'definition-chapter') : /ZONING RESOLUTION/.test(category?.name || '') ||
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
      for (const administrative of bundle.codeSections.filter(code => /^(?:GENERAL )?ADMINISTRATIVE (?:CODE|PROVISIONS)$/i.test(code.name) ||
        (code.name==='BUILDING CODE' && book.terms.some(term=>/(?:of|in) the New York city building code\b/i.test(term.text))))) {
        if (administrative.id === category?.id) continue;
        const referencedPrefix = administrative.name==='BUILDING CODE' ? 'bc' : 'ac';
        const adminSlug = administrative.slug || administrative.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const adminRoot = path.join(directory, 'code-sections', adminSlug, 'chapters');
        const nestedAdminFiles = htmlFiles.filter(file => path.dirname(file) === adminRoot);
        // Use the same canonical layout as the reader. Legacy flat copies can
        // differ in formatting/content and must not compete with nested sources.
        const adminFiles = nestedAdminFiles.length ? nestedAdminFiles : htmlFiles.filter(file =>
          path.dirname(file) === path.join(directory, 'chapters') && path.basename(file).startsWith(`${referencedPrefix}-`));
        for (const file of adminFiles) {
          supportEntries.push(...extractDefinitionEntries(await readFile(file, 'utf8')).map(term => ({
            ...term, bundle: entry.name, code: administrative.name, scope: 'general',
            chapter: sourceChapter(file, bundle.chapters.filter(c => c.codeSectionID === administrative.id), referencedPrefix),
            sourceFile: path.relative(root, file),
          })));
        }
      }
      if (entry.name === '2025-specialty-codes' && category?.name === '2025 ENERGY CONSERVATION CODE' && scope === 'C') {
        const sourceFile = `${entry.name}/chapters/32000010.html`;
        const targets = [{term:'COMMISSIONING PLAN',sectionNumber:'C408.2.1',heading:'Commissioning plan.',nextSection:'C408.2.2'}];
        const definitions = extractDefinitionEntries(await readFile(path.join(root,sourceFile),'utf8'),{citedSectionRanges:targets})
          .filter(term=>term.term==='COMMISSIONING PLAN' && term.sectionNumber==='C408.2.1');
        if (definitions.length !== 1) throw Error('Energy commissioning definition requires review');
        supportEntries.push({...definitions[0],bundle:entry.name,code:category.name,scope,chapter:'C4',sourceFile});
      }
      // Explicit Energy Code referrals share Title 28, not an energy-edition
      // copy. Bind only the reviewed terms and retain the actual source bundle.
      if (entry.name === '2025-specialty-codes' && category?.name === '2025 ENERGY CONSERVATION CODE' && ['R','C'].includes(scope)) {
        const binding = JSON.parse(await readFile(path.join(repo, 'permitext-sync-server/scripts/definition-sources/energy-administrative-definition-binding.json'), 'utf8'));
        if (binding.targetBundle !== entry.name || binding.targetCode !== category.name || !binding.targetScopes.includes(scope))
          throw Error('Energy administrative binding identity changed; review required');
        const sources = await Promise.all([binding.sourceFile,binding.comparisonFile].map(file=>readFile(path.join(root,file),'utf8')));
        if (sources.some((source,i)=>createHash('sha256').update(source).digest('hex') !== [binding.sourceSHA256,binding.comparisonSHA256][i]))
          throw Error('Energy administrative source changed; review required');
        const definitions = sources.map(source=>extractDefinitionEntries(source).filter(term=>term.sectionNumber===binding.targetSection && binding.terms.includes(term.term)));
        for (const label of binding.terms) {
          const matches = definitions.map(terms=>terms.filter(term=>term.term===label));
          if (matches.some(terms=>terms.length!==1 || terms[0].referenceOnly) || definitionKey(matches[0][0].text)!==definitionKey(matches[1][0].text))
            throw Error(`Energy administrative definition changed: ${label}`);
          supportEntries.push({...matches[0][0], bundle:entry.name, code:binding.sourceCode, scope,
            sourceBundle:binding.sourceBundle, chapter:binding.sourceChapter, sourceFile:binding.sourceFile, publication:binding.publication});
        }
      }
      // Explicit, reviewed references to the separately published Building Code.
      if (['2026-existing-building-code','2026-enacted-administrative-code'].includes(entry.name)) {
        const manifest = JSON.parse(await readFile(path.join(repo,'permitext-sync-server/scripts/definition-sources/building-code-definition-bindings.json'),'utf8'));
        const binding = manifest.bindings.find(item => item.targetBundle === entry.name && item.targetCode === category?.name && item.targetScope === scope);
        if (binding) {
          const html = await readFile(path.join(root,manifest.sourceFile),'utf8');
          if (createHash('sha256').update(html).digest('hex') !== manifest.sourceSHA256)
            throw Error('Reviewed Building Code reference source changed');
          const definitions = extractDefinitionEntries(html).filter(term => binding.terms.includes(term.term) && term.sectionNumber === '202');
          if (definitions.length !== binding.terms.length) throw Error('Reviewed Building Code reference labels changed');
          supportEntries.push(...definitions.map(term => ({...term, bundle:entry.name, scope,
            sourceBundle:manifest.sourceBundle, sourceFile:manifest.sourceFile, chapter:manifest.sourceChapter,
            code:manifest.sourceCode, publication:binding.publication})));
        }
      }
      // LL42/2026 §4 restates §28-101.5 for the EBC effective regime.
      // Its reviewed supplement is confined to this exact collection and scope;
      // it must never replace historical/current administrative definitions.
      if (entry.name === '2026-existing-building-code' && category?.name === 'EXISTING BUILDING CODE' && scope === 'general') {
        const relative = `${entry.name}/references/ll42-2026-section4`;
        const provenance = JSON.parse(await readFile(path.join(root, `${relative}.provenance.json`), 'utf8'));
        const html = await readFile(path.join(root, `${relative}.html`), 'utf8');
        if (createHash('sha256').update(html).digest('hex') !== provenance.htmlSHA256 ||
            provenance.targetBundle !== entry.name || provenance.targetCode !== category.name || provenance.targetScope !== scope)
          throw Error('EBC administrative supplement changed; source review required');
        const definitions = extractDefinitionEntries(html).filter(term => term.sectionNumber === '28-101.5');
        if (definitions.length !== provenance.termCount || definitions.some(term => term.referenceOnly))
          throw Error('EBC administrative supplement must contain the reviewed direct definitions');
        supportEntries.push(...definitions.map(term => ({...term, bundle:entry.name, code:'ADMINISTRATIVE CODE',
          scope:'general', chapter:'1', sourceFile:`${relative}.html`, publication:provenance.publication})));
      }
      book.terms = resolveDefinitionReferences(book.terms, [...book.terms, ...supportEntries]);
      const citationMismatches = JSON.parse(await readFile(path.join(repo,'permitext-sync-server/scripts/definition-sources/reviewed-citation-mismatches.json'),'utf8'));
      book.terms = await bindCitationMismatches(book, citationMismatches.bindings, file => readFile(path.join(root,file),'utf8'));
      if (book.bundle === '2014-construction-codes' && book.code === 'BUILDING CODE' && book.scope === 'general') {
        const binding = JSON.parse(await readFile(path.join(repo,'permitext-sync-server/scripts/definition-sources/construction-type-binding.json'),'utf8'));
        book.terms = bindConstructionTypes(book, binding, await readFile(path.join(root,binding.sourceFile),'utf8'));
        const earthquake = JSON.parse(await readFile(new URL('./definition-sources/earthquake-definition-binding.json', import.meta.url), 'utf8'));
        book.terms = bindEarthquakeDefinition(book, earthquake, await readFile(path.join(root,earthquake.sourceFile),'utf8'));
        const seismicScopes = JSON.parse(await readFile(new URL('./definition-sources/seismic-definition-scopes.json', import.meta.url), 'utf8'));
        book.terms = bindSeismicDefinitionScopes(book, seismicScopes, await readFile(path.join(root,seismicScopes.sourceFile),'utf8'));
      }
      // Three LL42 §4 referrals continue beyond §28-101.5. Keep the
      // original referral, but publish the complete, reviewed terminal source.
      if (book.bundle === '2026-existing-building-code' && book.code === 'EXISTING BUILDING CODE' && book.scope === 'general') {
        const binding = JSON.parse(await readFile(path.join(repo,'permitext-sync-server/scripts/definition-sources/ebc-onward-definition-bindings.json'),'utf8'));
        if (binding.targetBundle !== book.bundle || binding.targetCode !== book.code || binding.targetScope !== book.scope ||
            createHash('sha256').update(await readFile(path.join(repo,binding.bridgeEvidence.file))).digest('hex') !== binding.bridgeEvidence.sha256)
          throw Error('EBC onward reference identity changed; review required');
        for (const source of binding.sources) {
          const html = await readFile(path.join(root,source.file),'utf8');
          if (createHash('sha256').update(html).digest('hex') !== source.sha256) throw Error('EBC onward source changed; review required');
          const entries = extractDefinitionEntries(html);
          for (const target of source.entries) {
            const matches = entries.filter(item => item.term === target.term && !item.referenceOnly &&
              (item.sectionNumber === target.sectionNumber || (source.sourceBundle === 'new-york-state-public-service-law' && item.sectionNumber === '2')));
            if (matches.length !== 1) throw Error(`EBC onward definition missing: ${target.term}`);
            book.terms = book.terms.map(term => term.term === target.term && term.resolution === 'unresolved-reference' && term.text === binding.originalReference
              ? {...term, aliases:[...new Set([...(term.aliases || []),...(target.aliases || [])])], resolution:'resolved-reference', referenceText:term.text, definition:{...matches[0],
                sectionNumber:target.sectionNumber, sourceFile:source.file, sourceBundle:source.sourceBundle,
                code:source.code, chapter:source.chapter, publication:source.publication}} : term);
          }
        }
      }
      // §410.2.2 expressly limits the performance/worship platform meaning
      // to §410. Keep the distinct work-platform meaning elsewhere.
      if (book.bundle === '2022-construction-codes' && book.code === 'BUILDING CODE' && book.scope === 'general') {
        if (!book.terms.some(term => term.term === 'PLATFORM (SPECIAL USE)' && term.resolution === 'resolved-reference' && term.definition?.sectionNumber === '410.2.2'))
          throw Error('Special-use platform source requires review before applying its scope');
        book.terms = book.terms.map(term => term.term === 'PLATFORM (SPECIAL USE)' && term.resolution === 'resolved-reference'
          ? {...term, aliases:[...new Set([...(term.aliases || []),'PLATFORM'])], applicableSections:['410']}
          : term.term === 'PLATFORM' && !term.referenceOnly ? {...term, excludedSections:['410']} : term);
      }
      if (['2014-construction-codes','2022-construction-codes'].includes(book.bundle) &&
          ['BUILDING CODE','PLUMBING CODE'].includes(book.code) && book.scope === 'general') {
        const binding = JSON.parse(await readFile(path.join(repo,'permitext-sync-server/scripts/definition-sources/stormwater-definition-binding.json'),'utf8'));
        const bridge = binding.bridges.find(item => item.bundle === book.bundle);
        book.terms = bindStormwaterDefinitions(book, binding,
          await readFile(path.join(root,binding.sourceFile),'utf8'), await readFile(path.join(root,bridge.file),'utf8'));
      }
      // Reviewed Chapter 10 occurrences use material classification, not the
      // finished-ground meaning of §27-232. Do not suppress other sections:
      // nearby material language can coexist with legitimate above/below grade.
      if (book.bundle === '2026-enacted-administrative-code' && book.code === '1968 BUILDING CODE' && book.scope === 'general') {
        const materialSource = '2026-enacted-administrative-code/chapters/30000067.html';
        if (createHash('sha256').update(await readFile(path.join(root,materialSource))).digest('hex') !==
            'c65126a7a49f6aff86426a13c273a18eead1dc0af8ff51e234c0cbac9dc96dbf')
          throw Error('1968 material-grade contexts changed; scope review required');
        const grade = book.terms.filter(term => term.term === 'GRADE');
        if (grade.length !== 1 || grade[0].sectionNumber !== '27-232' ||
            grade[0].sourceFile !== '2026-enacted-administrative-code/chapters/30000059.html' ||
            grade[0].text !== 'The finished surface of the ground, either paved or unpaved.')
          throw Error('1968 GRADE definition changed; scope review required');
        book.terms = book.terms.map(term => term === grade[0] ? {...term, excludedSections:
          ['27-588','27-599','27-601','27-604','27-617','27-618','27-619','27-622','27-630','27-641']} : term);
      }
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
// The Chapter 2 referral does not expand D201's express appendix-only meaning.
const heightBundle = '2026-existing-building-code';
for (const [chapter,sha] of [
  ['2','939c0dc49ac7ec9632e7409ba738388b48ef7d52e04ed51339e4b9a3b74b6196'],
  ['D1','9e944e07902e94a08592f6a67cb0656807c840cc2619956db3291fdac4fa589f'],
  ['D2','5dd10e6a40f872670648d1fbea115a30e21b699726e1c8aaa533107e01df7db8']
]) {
  if (createHash('sha256').update(await readFile(path.join(root,heightBundle,'chapters',chapter+'.html'))).digest('hex') !== sha)
    throw Error('EBC HEIGHT appendix scope source changed; review required');
}
const heightBooks = report.books.filter(book => book.bundle === heightBundle && ['2','D2'].includes(book.chapter));
if (heightBooks.length !== 2) throw Error('EBC HEIGHT scope books changed; review required');
for (const book of heightBooks) {
  const heights = book.terms.filter(term => term.term === 'HEIGHT (MDL 4(35))');
  const source = heights[0]?.definition || heights[0];
  if (heights.length !== 1 || source.sourceFile !== heightBundle+'/chapters/D2.html' ||
      !source.text.startsWith('Notwithstanding the definition of height in the New York City Building Code, for the purposes of this appendix,'))
    throw Error('EBC HEIGHT terminal definition changed; review required');
  book.terms = book.terms.map(term => term === heights[0] ? {...term,
    applicableChapters:Array.from({length:10},(_,i)=>'D'+(i+1))} : term);
}
// Occurrence-specific exclusions preserve valid meanings within mixed sections.
const occurrenceSources = [
  ['2026-enacted-administrative-code/chapters/30000071.html','969ce6e9ca8f558b6e1784d94fdef8c24932d060ce5aec3f3774cd06e60b4ed4'],
  ['2026-existing-building-code/chapters/D3.html','5afcadc02ae4e72720dac4a28c66f9aeab1cbeeda9da1d83049e0695a4b5cd3c'],
  ['2026-existing-building-code/chapters/D6.html','7a0308986e8507c35b13a526553a23b391d92cc7fe397d42d740ea6905e88e7c'],
  ['2026-existing-building-code/chapters/D7.html','6ef3854f0480c5e1d3a79f6a35b059a50db9ee816e3e396ced2d4965464ba5b7']
];
for (const [file,sha] of occurrenceSources) {
  if(createHash('sha256').update(await readFile(path.join(root,file))).digest('hex')!==sha)
    throw Error('Mixed definition occurrence source changed; review required: '+file);
}
for(const book of report.books) {
  book.terms=book.terms.map(term=> {
    if(book.bundle==='2026-enacted-administrative-code' && book.code==='1968 BUILDING CODE' && book.scope==='general' && term.term==='GRADE')
      return {...term,excludedOccurrences:[{section:'27-828',phrases:[{text:'commercial grade oils',occurrence:0}]},{section:'27-830',phrases:['same grade of oil','grade B seamless'].map(text=>({text,occurrence:0}))}]};
    if(heightBooks.includes(book) && term.term==='HEIGHT (MDL 4(35))')
      return {...term,excludedOccurrences:Object.entries({
        D305:['height of such court','outer court at any given height','Such dwelling unit has at least one-half of its height'],
        D306:['30 inches (762 mm) or more in clear height','passageways shall be not less than 7 feet (2134 mm) in height'],
        D602:['Every living room shall have a minimum height'],
        D603:['treads and risers of every stair shall be of uniform height','each riser shall not exceed 7 ¾ inches (197 mm) in height','height of the riser'],
        D604:['3. Shall have a minimum height'],
        D702:['Such penthouses shall have a clear inside height','shall not exceed 12 feet (3658 mm) in height from the high point of the main roof'],
        D703:['multiple dwelling shall be of uniform height and width in any 1 flight','each riser shall not exceed 7.75 inches (197 mm) in height','height of the riser','height of the floor beams','stair stringers 10 inches (254 mm) or less in height'],
        D704:['flat base not exceeding 10 inches (254 mm) in height']
      }).map(([section,phrases])=>({section,phrases:phrases.map(text=>({text,occurrence:0}))}))};
    return term;
  });
}
const output = process.argv[2] || '/tmp/permitext-reader-definition-audit.json';
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output, definitionChapters: report.books.length,
  candidateTerms: report.books.reduce((n, b) => n + b.terms.length, 0),
  referenceOnly: report.books.reduce((n, b) => n + (b.referenceOnlyCount || 0), 0),
  unresolvedChapters: report.books.filter(b => !b.terms.length).map(b => `${b.bundle}/${b.chapter}`) }, null, 2));
