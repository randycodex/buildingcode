import assert from 'node:assert/strict';
import { parseActiveCodeSearchScope, ActiveCodeSearchScopeError } from '../active-code-search-scope.mjs';
const a={canonicalEdition:'2022',jurisdictionID:1,codeID:1,categoryID:4};
const b={...a,canonicalEdition:'admin'};
const installed=[a,b];
const params=sources=>new URLSearchParams({sourceScope:JSON.stringify({version:1,enabledSources:sources})});
assert.equal(parseActiveCodeSearchScope(new URLSearchParams(),installed),null);
const empty=parseActiveCodeSearchScope(params([]),installed);
assert.equal(empty.isEmpty,true); assert.equal(empty.isEnabled(a),false);
const partial=parseActiveCodeSearchScope(params([b]),installed);
assert.equal(partial.isEnabled(b),true); assert.equal(partial.isEnabled(a),false);
assert.equal(parseActiveCodeSearchScope(params([a,b,a]),installed).token,parseActiveCodeSearchScope(params([b,a]),installed).token);
for(const raw of ['', 'null', '{}', '{', JSON.stringify({version:2,enabledSources:[]}),JSON.stringify({version:1,enabledSources:[{...a,categoryID:'4'}]})]) {
 assert.throws(()=>parseActiveCodeSearchScope(new URLSearchParams({sourceScope:raw}),installed),ActiveCodeSearchScopeError);
}
assert.throws(()=>parseActiveCodeSearchScope(params([{...a,canonicalEdition:'missing'}]),installed),ActiveCodeSearchScopeError);
const duplicate=params([a]);duplicate.append('sourceScope',duplicate.get('sourceScope'));
assert.throws(()=>parseActiveCodeSearchScope(duplicate,installed),ActiveCodeSearchScopeError);
assert.throws(()=>parseActiveCodeSearchScope(new URLSearchParams({sourceScope:' '.repeat(8193)}),installed),ActiveCodeSearchScopeError);
assert.deepEqual(installed,[a,b]);
console.log('Search scope passed: absent/empty distinction, exact source identity, canonical token, malformed/unknown/duplicate rejection.');
