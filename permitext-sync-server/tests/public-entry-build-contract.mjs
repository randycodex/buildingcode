import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPublicEntry } from '../scripts/build-public-entry.mjs';
const temp = await mkdtemp(join(tmpdir(), 'permitext-static-entry-'));
try {
  const source = join(temp, 'source'), output = join(temp, 'output');
  await mkdir(source);
  await writeFile(join(source, 'index.html'), 'existing workspace');
  await writeFile(join(source, 'home.html'), 'selected homepage');
  await writeFile(join(source, 'asset.js'), 'existing asset');
  await buildPublicEntry(source, output);
  assert.equal(await readFile(join(output, 'index.html'), 'utf8'), 'selected homepage', 'Static filesystem root must serve marketing even before rewrites');
  assert.equal(await readFile(join(output, 'workspace.html'), 'utf8'), 'existing workspace');
  assert.equal(await readFile(join(source, 'index.html'), 'utf8'), 'existing workspace', 'Source app shell stays intact');
  assert.equal(await readFile(join(output, 'asset.js'), 'utf8'), 'existing asset');
  const revision = JSON.parse(await readFile(join(output, 'code-revision.json'), 'utf8'));
  assert.equal(revision.cacheContract, 1);
  assert.match(revision.webAppVersion, /^\d{8}-/);
  assert.match(revision.corpusRevision, /^[a-f0-9]{64}$/);
  assert.match(revision.assetRevision, /^[a-f0-9]{64}$/);
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url)));
  assert.equal(config.outputDirectory, 'deployment-public');
  assert.equal(config.buildCommand, 'npm run build:production');
  const scripts = JSON.parse(await readFile(new URL('../package.json', import.meta.url))).scripts;
  assert.match(scripts['build:production'], /scripts\/build-public-entry.mjs$/);
  console.log('Static homepage and workspace deployment separation passed.');
} finally { await rm(temp, { recursive: true, force: true }); }
