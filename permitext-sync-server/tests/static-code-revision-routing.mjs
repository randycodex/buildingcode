// Local acceptance adapter for Vercel's compiled deployment rules. The platform
// remains responsible for serving the generated file in production.
import { readFile } from 'node:fs/promises';
import { getTransformedRoutes } from '@vercel/routing-utils';
import assert from 'node:assert/strict';
import { join } from 'node:path';

const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url)));
const compiled = getTransformedRoutes({ rewrites: config.rewrites });
assert.equal(compiled.error, null);
export const compiledRevisionRoutes = compiled.routes;

export function matchesRouteCondition(condition, url, headers) {
  const value = condition.type === 'query' ? url.searchParams.get(condition.key)
    : condition.type === 'header' ? headers[condition.key.toLowerCase()] : null;
  return value != null && (!condition.value || new RegExp(`^(?:${condition.value})$`).test(value));
}

export function revisionDestination(url, headers = {}) {
  return compiledRevisionRoutes.find(route => route.src && new RegExp(route.src).test(url.pathname)
    && (route.has || []).every(condition => matchesRouteCondition(condition, url, headers))
    && !(route.missing || []).some(condition => matchesRouteCondition(condition, url, headers)))?.dest?.split('?')[0];
}

export async function serveStaticCodeRevision(req, res, url, output) {
  if (url.pathname !== '/code-revision.json' && revisionDestination(url, req.headers) !== '/code-revision.json') return false;
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, {allow:'GET, HEAD'}).end(); return true; }
  const bytes = await readFile(join(output, 'code-revision.json'));
  res.writeHead(200, {'content-type':'application/json; charset=utf-8', 'cache-control':'public, max-age=0, must-revalidate'});
  res.end(req.method === 'HEAD' ? undefined : bytes);
  return true;
}
