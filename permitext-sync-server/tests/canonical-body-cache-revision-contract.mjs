import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createReaderSearchProjection } from '../scripts/reader-search-projection.mjs';
import { verifyReaderSearchIndex } from '../scripts/verify-reader-search-index.mjs';
import { projectChapter } from '../scripts/generate-reader-search-index.mjs';
import { canonicalServedSourceRevision, chapterBodyContractResponse,
  publicCodeCorpusRevision } from '../chapter-body-contract.mjs';
import { researchConstructionDefinitionContentVersion } from '../research-construction-definition-content.mjs';
import { codeAssetRevision } from '../code-asset-manifest.mjs';

globalThis.fetch = () => { throw Error('No providers or network in canonical cache contract.'); };
const root = await mkdtemp(join(tmpdir(), 'permitext-canonical-cache-'));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const version = family => `CodeContent/authored/new-york-city/${family}/bundle.json#1`;
try {
  const source = 'b'.repeat(64);
  const transformed = canonicalServedSourceRevision(source, version('2022-construction-codes'));
  assert.equal(transformed, hash({ source, canonicalBodyVersion: researchConstructionDefinitionContentVersion }));
  assert.notEqual(transformed, source, 'The current canonical loader change invalidates the served-source identity.');
  assert.notEqual(transformed, hash({ source, canonicalBodyVersion: 'previous-body-loader' }),
    'A different loader revision changes identity even when raw source bytes are identical.');
  for (const family of ['2014-construction-codes', '2026-zoning-resolution',
    '2026-enacted-administrative-code', '2026-existing-building-code', '2025-specialty-codes']) {
    assert.equal(canonicalServedSourceRevision(source, version(family)), source,
      `${family} does not inherit a current Construction loader version.`);
  }
  assert.throws(() => canonicalServedSourceRevision('invalid', version('2022-construction-codes')));
  assert.throws(() => canonicalServedSourceRevision(source, '2022'));

  // Independently reconstruct the old public identity from the unchanged
  // authored manifests. The actual exported aggregate must now include only
  // the applicable body-loader dependency, alongside its existing asset hash.
  const families = ['2014-construction-codes', '2022-construction-codes',
    '2025-specialty-codes', '2026-enacted-administrative-code',
    '2026-existing-building-code', '2026-zoning-resolution'].sort();
  const sources = await Promise.all(families.map(async family => [family,
    JSON.parse(await readFile(new URL(`../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/${family}/prepared/searchTextManifest.json`, import.meta.url), 'utf8')).sourceRevision]));
  const assetRevision = await codeAssetRevision();
  const legacyPublicRevision = hash({ publicResponseContract: 1, sources, assetRevision });
  const expectedPublicRevision = hash({ publicResponseContract: 1,
    sources: sources.map(([family, revision]) => [family, canonicalServedSourceRevision(revision, version(family))]), assetRevision });
  assert.equal(await publicCodeCorpusRevision(), expectedPublicRevision,
    'The production public cache/offline download pin uses the same served-source identity.');
  assert.notEqual(expectedPublicRevision, legacyPublicRevision);

  // Exercise the actual chapter/window identity path against unchanged source
  // fixtures. Existing historical identities remain byte-for-byte identical.
  for (const family of ['2022-construction-codes', '2014-construction-codes']) {
    const prepared = join(root, family, 'prepared');
    await mkdir(prepared, { recursive: true });
    await writeFile(join(prepared, 'searchTextManifest.json'), JSON.stringify({ sourceRevision: source }));
    const chapter = { id: 'chapter', codePrefix: 'BC', chapterNumber: '1', codeVersion: version(family),
      sections: [{ id: 'section', title: 'Source fixture', blocks: [{ id: 'p', plainText: 'Complete body.' }] }] };
    const { sections, ...metadata } = chapter;
    const summaries = sections.map(({ blocks, ...section }) => section);
    const legacyRevision = hash({ contract: 2, source, metadata, sections: summaries });
    const options = { enabled: true, authoredRoot: root, defaultCodeVersion: chapter.codeVersion };
    const manifest = await chapterBodyContractResponse(chapter, options);
    const window = await chapterBodyContractResponse({ ...chapter,
      bodyRange: { start: 0, end: 1, total: 1, complete: true } }, { ...options, compactWindow: true });
    assert.equal(manifest.bodyContract, 2, 'Cache invalidation does not relabel the response schema or legal edition.');
    assert.equal(manifest.codeVersion, chapter.codeVersion);
    assert.equal(window.corpusRevision, manifest.corpusRevision);
    assert.deepEqual(window.sections[0].blocks, chapter.sections[0].blocks);
    if (family === '2022-construction-codes') assert.notEqual(manifest.corpusRevision, legacyRevision);
    else assert.equal(manifest.corpusRevision, legacyRevision);
    assert.equal(await chapterBodyContractResponse(chapter, { ...options, enabled: false }), chapter);
  }

  const projector = await createReaderSearchProjection();
  const summary = { id: 'fixture', codePrefix: 'BC', bodyContract: 2,
    codeVersion: 'edition#1', corpusRevision: 'a'.repeat(64),
    sections: [{ id: 's1', sectionNumber: '1', title: 'Fixture rule' }] };
  let freshText = 'Original complete public enacted source.';
  let additionalBlocks = [];
  const get = async path => {
    if (path === '/code/chapters') return { chapters: [summary] };
    if (path.startsWith('/code/chapters?version=')) return { chapters: [] };
    assert(path.startsWith('/code/chapters/fixture?'));
    if (!path.includes('include=body')) return { chapter: summary };
    return { chapter: { ...summary,
      bodyRange: { start: 0, end: 1, total: 1, complete: true },
      sections: [{ ...summary.sections[0], blocks: [{ id: 'p1', kind: 'html',
        html: `<p>${freshText}</p>`, plainText: freshText }, ...additionalBlocks] }] } };
  };
  const original = await projectChapter('fixture', get, projector);
  await writeFile(join(root, 'fixture.json.gz'), gzipSync(JSON.stringify(original)));
  const verify = () => verifyReaderSearchIndex({ get, outputDirectory: root, chapterIDs: ['fixture'], projector });
  await verify();
  freshText = 'Recovered complete public enacted source with an additional qualification.';
  await assert.rejects(verify, /projected body|fresh projected|enacted bod/i,
    'Unchanged metadata cannot validate stale stored Reader text after a canonical-body repair.');
  additionalBlocks = [{ id: 'table-and-note', kind: 'html',
    html: '<table><tr><th>Item</th><th>Limit</th></tr><tr><td>Fixture</td><td>20</td></tr></table><p>Note: The separate qualification remains applicable.</p>' }];
  const rich = await projectChapter('fixture', get, projector);
  assert.match(rich.sections[0].blocks.map(block => block.text).join(' '), /Note: The separate qualification/);
  await writeFile(join(root, 'fixture.json.gz'), gzipSync(JSON.stringify(rich)));
  await verify();
  additionalBlocks[0].html = additionalBlocks[0].html.replace('<td>20</td>', '<td>21</td>');
  await assert.rejects(verify, /fresh projected enacted bod/i, 'Fresh table cell content must match the stored projection.');
  additionalBlocks[0].html = additionalBlocks[0].html.replace('<td>21</td>', '<td>20</td>').replace(/<p>Note:[\s\S]*?<\/p>/, '');
  await assert.rejects(verify, /fresh projected enacted bod/i, 'Closing notes cannot disappear behind unchanged metadata.');
  console.log('Canonical body cache dependency and actual Reader projection verification passed: current-only identities, public/offline pins, historical bytes, windows, stale text/table/note negatives.');
} finally {
  await rm(root, { recursive: true, force: true });
}
