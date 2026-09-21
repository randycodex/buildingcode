import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { handleRequest, searchTextMatchesExactQuery } from '../app.mjs';
import { historicalConstructionSyncCodeVersion } from '../public/sync-identity.js';

const server = createServer(handleRequest).listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
async function search(parameters) {
  const response = await fetch(`${origin}/code/search?${new URLSearchParams(parameters)}`);
  assert.equal(response.status, 200);
  return response.json();
}
try {
  const query = {q:'101.1', code:'BC', match:'exact', limit:'250'};
  const all = await search({...query, version:'all'});
  const historical = await search({...query, version:historicalConstructionSyncCodeVersion});
  const current = await search(query);
  assert(all.results.some(row => row.codeVersion === historicalConstructionSyncCodeVersion));
  assert(all.results.some(row => row.codeVersion !== historicalConstructionSyncCodeVersion));
  assert(historical.results.length > 0);
  assert(historical.results.every(row => row.codeVersion === historicalConstructionSyncCodeVersion));
  assert(current.results.every(row => row.codeVersion !== historicalConstructionSyncCodeVersion));
  assert.equal(new Set(all.results.map(row => `${row.codeVersion}:${row.id}`)).size, all.results.length);
  const seen = [];
  let offset = 0, candidateOffset = 0, hasMore = true;
  for (let page = 0; hasMore && page < 100; page++) {
    const result = await search({...query,version:'all',limit:'1',offset:String(offset),candidateOffset:String(candidateOffset)});
    seen.push(...result.results.map(row => `${row.codeVersion}:${row.id}`));
    offset=result.nextOffset; candidateOffset=result.nextCandidateOffset; hasMore=result.hasMore;
  }
  assert.equal(hasMore,false);
  assert.deepEqual(new Set(seen),new Set(all.results.map(row => `${row.codeVersion}:${row.id}`)));
  assert.equal(seen.length,new Set(seen).size);
  assert(searchTextMatchesExactQuery(['An enclosed stair enclosure is required'], 'stair enclosure'));
  assert(!searchTextMatchesExactQuery(['An enclosure for each stair is required'], 'stair enclosure'));
  assert(!searchTextMatchesExactQuery(['Stair enclosures'], 'stair enclosure'));
  console.log(`Cross-platform search: current + 2014 scope, exact phrase, and pagination passed (${all.results.length} BC matches).`);
} finally { server.close(); server.closeAllConnections(); }
