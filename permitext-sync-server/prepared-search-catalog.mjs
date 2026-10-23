import {readFile} from 'node:fs/promises';
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
