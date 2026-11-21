import {readFile} from 'node:fs/promises';
import {publicCodeCorpusRevision} from './chapter-body-contract.mjs';
import {preparedSearchRuntime} from './prepared-search-runtime.mjs';

const catalogDirectory = new URL('./generated/search-catalogs/', import.meta.url);

// These are exact projections of the authoritative catalogs, rebuilt in every
// deployment. Loading metadata must not hydrate every rich chapter into memory.
export async function loadPreparedSearchCatalog(family, sourceLoader, {
  directory = catalogDirectory,
  sourceOnly = process.env.PERMITEXT_BUILD_SEARCH_CATALOGS === '1'
} = {}) {
  if (sourceOnly) return sourceLoader();
  if (directory === catalogDirectory) {
    const compiled = await preparedSearchRuntime.catalog(family);
    if (compiled) return compiled;
  }
  let payload;
  try {
    payload = JSON.parse(await readFile(new URL(`${family}.json`, directory), 'utf8'));
  } catch (error) {
    // A local checkout can run without the deployment build step.
    if (error.code === 'ENOENT') return sourceLoader();
    throw error;
  }
  if (payload.schemaVersion !== 1 || payload.family !== family ||
      !Array.isArray(payload.sections) || !payload.sections.length ||
      payload.sections.some(section => section.id == null || !section.codePrefix)) {
    throw new Error(`Invalid prepared search catalog: ${family}`);
  }
  return payload.sections;
}

// The chapter list has its own small projection so opening the Reader does
// not decode the full section catalog or load individual chapter files.
export async function loadPreparedConstructionChapters(sourceLoader, {
  directory = catalogDirectory,
  sourceOnly = process.env.PERMITEXT_BUILD_SEARCH_CATALOGS === '1'
} = {}) {
  if (sourceOnly) return sourceLoader();
  let payload;
  try {
    payload = JSON.parse(await readFile(new URL('construction-chapters.json', directory), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return sourceLoader();
    throw error;
  }
  if (payload.schemaVersion !== 1 || payload.buildCommit !== (process.env.VERCEL_GIT_COMMIT_SHA || null) ||
      !Array.isArray(payload.chapters) || !payload.chapters.length ||
      payload.chapters.some(chapter => !Number.isSafeInteger(chapter?.id) || !chapter.codePrefix ||
        typeof chapter.fullTitle !== 'string' || !Number.isSafeInteger(chapter.sectionCount))) {
    throw new Error('Invalid prepared construction chapters');
  }
  // Local content refreshes can precede a new build. Serve current source
  // summaries when the installed artifact belongs to an older corpus.
  if (payload.corpusRevision !== await publicCodeCorpusRevision()) return sourceLoader();
  return payload.chapters;
}
