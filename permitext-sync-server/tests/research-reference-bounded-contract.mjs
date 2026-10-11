import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const app=await readFile(new URL('../app.mjs',import.meta.url),'utf8');
const start=app.indexOf('async function ownedProjectTargetExists(');
const end=app.indexOf('\nfunction deterministicFoundationLinkID(',start);
const context=vm.createContext({listStoredResearchAnswers:async (userID,options={})=>{
  assert.equal(userID,'owner');
  // Model a large account where downloading all answers exceeds the database
  // response limit. Existence checks must select only the requested identity.
  if (!options.idsOnly || options.ids?.length !== 1) throw new Error('response too large (67108864 bytes)');
  return options.ids[0] === 'saved-answer' ? [{id:'saved-answer'}] : [];
}});
vm.runInContext(app.slice(start,end),context);
assert.equal(await context.ownedProjectTargetExists('owner','researchAnswer','saved-answer'),true);
assert.equal(await context.ownedProjectTargetExists('owner','researchAnswer','missing'),false);
console.log('Research reference validation stays bounded for large accounts and rejects unavailable answers.');
