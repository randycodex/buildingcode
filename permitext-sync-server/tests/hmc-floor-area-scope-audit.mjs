import test from 'node:test';
import assert from 'node:assert/strict';
import {auditHMCFloorArea} from '../scripts/audit-hmc-floor-area-applicability.mjs';
test('full production matcher agrees with every reviewed floor area occurrence',async()=>{const result=await auditHMCFloorArea();assert.equal(result.prospectiveMatches,28);assert.equal(result.original.applicability,'definition-chapter');assert.deepEqual(result.counts,{definition:7,roomSpace:28,localCoolingDeclaration:1,localLivableCalculation:5,zoningRatio:3,buildingHousingAggregate:6,plural:0});});
