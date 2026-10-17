import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseFragment} from 'parse5';
import {occupantLoadTable, occupantLoadTableInput, occupantLoadSuggestedRow, calculateOccupantLoad, calculationNoteBlocks} from '../public/occupant-load-calculation.js';

export const source = {sectionID:'2152',sectionNumber:'1004.1.3',codePrefix:'BC',codeVersion:'CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1'};
export const {blocks} = JSON.parse(await readFile(new URL('../../NYC CC APP/NYCCCApp/Resources/CodeContent/authored/new-york-city/2022-construction-codes/prepared/sections/2152.json',import.meta.url),'utf8'));
export const readTable = (body = blocks, identity = source) => occupantLoadTable(body,identity,parseFragment);
const table = readTable();
assert.deepEqual(readTable([{kind:'html',html:blocks.map(b=>b.html).join('')}]),table,'The live API merged HTML shape must preserve every table row and footnote.');
assert.equal(table.rows.length,52,'Every function and subfunction in the canonical table must be represented.');
assert.equal(new Set(table.rows.map(r=>r.id)).size,table.rows.length);
const find = label => {const row=table.rows.find(r=>r.label===label);assert(row,label);return row;};
const business=find('Business areas, including accessory areas on terraces and rooftops');
assert.equal(business.factor,'100');assert.equal(business.areaBasis,'gross');
assert.deepEqual(business.footnotes.map(n=>n.marker),['a','b','d']);
assert.match(business.description,/permanent fixtures and amenities/);
assert.match(business.description,/exceeds 74 persons/);
for(const [label,factor,basis] of [
 ['Educational — Classroom area','20','net'],
 ['Assembly without fixed seats — Dance floor (ballroom)','10','net'],
 ['Assembly without fixed seats — Unconcentrated (tables and chairs)','15','net'],
 ['Library — Stack area','100','gross'],
 ['Passenger terminal — Waiting areas (Seated)','5','net'],
 ['Residential — Indoor residential amenity spaces accessory to Group R-2 (unconcentrated)','50','net']
]) {assert.equal(find(label).factor,factor);assert.equal(find(label).areaBasis,basis);}
assert.deepEqual(find('Residential — Rooftop and terrace accessory to Groups R-2 and R-3').footnotes.map(n=>n.marker),['a','b','c','d']);
assert.deepEqual(find('Residential — Indoor residential amenity spaces accessory to Group R-2 (concentrated)').footnotes.map(n=>n.marker),['a','e']);
for(const row of table.rows.filter(r=>/Bowling|Stages and platforms|Mall buildings|Passenger terminal or platform|Assembly with fixed seats/.test(r.label))) {
 const input=occupantLoadTableInput({area:'1500',factor:'1000',areaBasis:'gross',seating:'without-fixed-seating'},table,row.id);
 assert.notEqual(row.method,'area');assert.equal(input.factor,'');
 assert.equal(calculateOccupantLoad(input).previewPeople,null,'A special method must never reuse the previous numeric factor.');
}
assert.match(find('Passenger terminal — Passenger terminal or platform').description,/capacity of all passenger vehicles/);
const bound=occupantLoadTableInput({area:'1500',factor:'1000',factorBasis:'Manual override',seating:'without-fixed-seating'},table,business.id);
assert.equal(bound.factor,'100');assert.equal(bound.areaBasis,'gross');
assert.equal(calculateOccupantLoad(bound).people,15);
assert.equal(occupantLoadTableInput(bound,table,'not-a-row').factor,'');
assert.equal(occupantLoadSuggestedRow({spaceFunction:'office'},table),null,'An informal name alone cannot choose a code row.');
assert.equal(occupantLoadSuggestedRow({suggestions:[{label:'Occupant-load factor',quote:`${business.label} 100 gross b, d`}]},table)?.id,business.id);
assert.equal(occupantLoadSuggestedRow({suggestions:[{label:'Occupant-load factor',quote:`${business.label} 1000 gross`}]},table),null);
assert.equal(occupantLoadSuggestedRow({factor:'20',suggestions:[{label:'Occupant-load factor',quote:'Classroom area 20 net'}]},table)?.label,'Educational — Classroom area');
const reordered=readTable(blocks.map(b=>{
 if(b.kind!=='table') return b;
 const rows=[...b.html.matchAll(/<tr>[\s\S]*?<\/tr>/g)].map(m=>m[0]);
 const businessIndex=rows.findIndex(r=>r.includes(business.label));
 [rows[2],rows[businessIndex]]=[rows[businessIndex],rows[2]];
 let i=0;return {...b,html:b.html.replace(/<tr>[\s\S]*?<\/tr>/g,()=>rows[i++])};
}));
assert.equal(reordered.rows.find(r=>r.label===business.label).id,business.id,'Reordering the source table must not silently select a different function.');
assert.throws(()=>readTable(blocks,{...source,codeVersion:source.codeVersion.replace('2022','2014')}));
assert.throws(()=>readTable(blocks.filter(b=>b.kind!=='table')));
assert.throws(()=>readTable(blocks.map(b=>b.kind==='table'?{...b,html:b.html.replace('>b, d<','>z<')}:b)),'A missing footnote cannot be silently discarded.');
const changed=readTable(blocks.map(b=>b.kind==='table'?{...b,html:b.html.replace('100 gross \n','101 gross \n')}:b));
assert.equal(changed.rows.find(r=>r.id===business.id).factor,'101','Factors come from the loaded source rather than a copied catalogue.');
const note=JSON.stringify(calculationNoteBlocks(calculateOccupantLoad(bound),[{id:'source',label:'BC 1004.1.3'}]));
assert.match(note,/permanent fixtures and amenities/);assert.match(note,/100 ft²\/person/);
console.log('Actual BC table: 52 functions, exact factors/bases/footnotes, special methods, source drift and quoted prefill passed.');
