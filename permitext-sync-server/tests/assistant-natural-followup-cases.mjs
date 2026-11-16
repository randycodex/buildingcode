// Evaluation-only subjects and expectations. Never imported by the Assistant.
export const naturalFollowupCases=[
 {id:'mechanical',description:'A proposed office fit-out in NYC has a supply-air duct crossing a one-hour corridor wall. Full sprinklers are proposed. The building also has a separate smoke barrier; no duct construction details are verified.',turns:[
  ['Does that duct need a fire damper?',/damper|duct/i],
  ["What if we're sprinklered throughout?",/damper|duct|corridor/i],
  ["Actually, I meant the smoke barrier, not the corridor wall.",/smoke.*barrier|barrier.*smoke/i],
  ['Does the same exception still work?',/smoke|damper|barrier/i]
 ]},
 {id:'plumbing',description:'A proposed NYC cafe has a 900 SF customer area and a 250 SF kitchen. Twelve customer seats are proposed, with four staff. One single-user toilet room is proposed. Occupant load and fixture calculations are not verified.',turns:[
  ['Can we have just one toilet room for the cafe?',/toilet|fixture|restroom/i],
  ['Even with only twelve seats?',/toilet|fixture|occupant|restroom/i],
  ['Can the staff use that one too?',/staff|employee/i],
  ['Where does it say that?',/toilet|fixture|employee|staff/i]
 ]},
 {id:'zoning',description:'A hypothetical NYC residential enlargement is assumed to be in R6B, unverified. The owner is considering a cellar recreation room. Grade elevations, lot coverage and existing floor area remain unverified. An unrelated shop entrance has one step.',turns:[
  ['Does the cellar count toward my allowed floor area?',/cellar|floor area/i],
  ['What if I put a gym down there?',/cellar|gym|floor area/i],
  ["No, it's more than halfway above curb level.",/basement|cellar|curb|grade/i],
  ['Does that change whether it counts?',/floor area|basement|cellar/i]
 ]},
 {id:'accessibility',description:'A proposed NYC three-story office building has a passenger elevator and an occupied roof terrace for tenants. Elevator roof service and roof use classification remain undecided. There is an unrelated cellar storage room.',turns:[
  ['Does the elevator have to go all the way to the roof terrace?',/elevator|accessible|roof/i],
  ['What if only employees can use it?',/roof|terrace|accessible/i],
  ['Separate question: can our entrance have one step?',/entrance|step|accessible/i],
  ['Back to the roof: what if nobody is allowed up there?',/roof|occupied|unoccupied/i]
 ]},
 {id:'fuel-gas',description:'A hypothetical NYC gas furnace is proposed next to a combustible wall. Manufacturer listing, required clearance and protection assembly remain unverified. Roof use and apartment count are unrelated to this installation.',turns:[
  ['Can I put the furnace closer to that wall if I protect it?',/furnace|clearance|protection/i],
  ['What if I just add sheet metal?',/metal|clearance|protection/i],
  ['Does that need an air gap?',/air|gap|ventilat/i],
  ['Where can I see the table you used?',/table|308\.2|clearance/i]
 ]}
];
