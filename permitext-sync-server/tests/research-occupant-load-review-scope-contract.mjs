import assert from 'node:assert/strict';
for (const key of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(key)) delete process.env[key];
process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA='1';
globalThis.fetch=()=>{throw new Error('Offline corpus check');};
const {assembledResearchEvidenceForTurn}=await import('../app.mjs');
const {requiredResearchClaimsFromEvidence}=await import('../research-required-claim-coverage.mjs');
for (const question of [
 'Calculate occupant load for 2400 gross square feet of ordinary business office and a separate 600 net square feet assembly room with unconcentrated tables and chairs, without fixed seats under 2022 NYC BC.',
 'Explain 2022 BC 1004.1.1.2 for cumulative occupant load in Group R-2.'
]) {
 const result=await assembledResearchEvidenceForTurn({question,messages:[],projectFacts:[],pinnedEvidence:[]});
 const claims=requiredResearchClaimsFromEvidence(result.sources);
 if(question.startsWith('Calculate')) {
  for(const section of ['1004.1.2','1004.1.3']) assert(claims.some(c=>c.label.includes(`BC ${section} —`)),JSON.stringify(claims));
  assert(!claims.some(c=>/BC 1004\.1\.1\.2(?:\.| —)/.test(c.label)), 'Residential alternatives must not force an unrelated claim.');
  assert(!claims.some(c=>/BC 1004\.1\.3\.2 —/.test(c.label)), 'Unlisted-function rule stays available without mandatory coverage for listed functions.');
 } else assert(claims.some(c=>c.label.includes('BC 1004.1.1.2 —')), 'Explicit residential reference still requires coverage.');
}
console.log('Occupant-load review scope preserves core calculation and explicit reference coverage.');
