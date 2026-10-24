import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { publicCodeCorpusRevision } from '../chapter-body-contract.mjs';
import { codeAssetRevision } from '../code-asset-manifest.mjs';
import { webAppVersion } from '../public/web-client-version.js';

// Deployment metadata only: use the same bundled revision sources as the API.
// This build step must never depend on an account, database, or live service.
export async function buildPublicCodeRevision(output) {
  const manifest = {
    corpusRevision: await publicCodeCorpusRevision(),
    assetRevision: await codeAssetRevision(),
    cacheContract: 1,
    webAppVersion,
  };
  await writeFile(join(output, 'code-revision.json'), JSON.stringify(manifest));
  return manifest;
}
