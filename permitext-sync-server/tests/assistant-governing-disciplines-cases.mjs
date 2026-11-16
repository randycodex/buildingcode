// Evaluation expectations only; no case or section list is imported by the engine.
export const naturalFollowupCases=[
 {id:'residential-roof',description:'Proposed new eight-story NYC Group R-2 building, 56 apartments containing Type B+NYC and Type B units, passenger elevator, and a 1,100-SF common rooftop terrace for residents. No alternative accessible route to the roof is proposed. Sprinklers are proposed throughout. Roof occupancy load and elevator design remain unverified.',turns:[
  ['Does my elevator need to go to the roof?',/accessible|accessibility|1107/i],
  ['But only residents can use it. Does that change anything?',/residen|common|accessible/i],
  ['What if we provide stairs instead?',/accessible|stairs|route/i]
 ]},
 {id:'shared-laundry',description:'A proposed new six-story NYC R-2 apartment building with Type B dwelling units has an elevator serving the residential floors. The owner wants the only common laundry room in the cellar; no elevator stop or ramp currently serves that level.',turns:[
  ['Can we move the shared laundry down to the cellar?',/accessible|accessibility|route/i],
  ['What if there is another machine on the first floor?',/laundry|accessible|machine/i]
 ]},
 {id:'courtyard-dining',description:'A proposed NYC ground-floor restaurant wants 24 outdoor seats in a rear courtyard. Customers reach it through a door with one step. The courtyard also contains a required exit discharge path. Zoning use, seating occupant load and passage clear width remain unverified.',turns:[
  ['Can I put dining tables out there?',/egress|exit|accessible|accessibility/i],
  ['Can I just keep a narrow path between them?',/accessible|egress|exit|width/i]
 ]},
 {id:'bedroom-skylight',description:'A proposed NYC R-2 apartment building includes a bedroom with no exterior wall window. The architect proposes a roof skylight and mechanical ventilation. Zoning district and room dimensions remain unverified.',turns:[
  ['Can that bedroom just have a skylight?',/light|ventilat|window|skylight/i]
 ]},
 {id:'drain-control',description:'A NYC renovation proposes a horizontal sanitary drainage branch. The pipe size has not been selected. Residential roof and amenity questions are unrelated.',turns:[
  ['How much slope does that drain need?',/slope|drain/i]
 ]}
];
