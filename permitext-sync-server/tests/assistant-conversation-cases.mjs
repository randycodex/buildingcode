// Synthetic conversational cases; no case-specific rules are used by the engine.
export const contextCases=[
 ['stairs',['Does the roof need two exits?','Roof exit count depends on use and occupants.','Can both stairs be next to each other?','Exit separation usually matters; check the applicable separation rule.'],"But this is a residential building. Doesn't that make a difference?"],
 ['pronoun',['How many plumbing fixtures?','Fixture count depends on occupancy.','Can the restroom door swing into the corridor?','That depends on encroachment and egress width.'],'Can I make it narrower?'],
 ['correction',['Can I put a generator on the roof?','Loading and clearances matter.','Does this duct need a fire damper?','A shaft penetration may require one.'],'No, I mean it goes through an exterior wall, not a shaft.'],
 ['earlier',['How many bicycle spaces are required?','That depends on use and floor area.','Does the elevator need roof access?','Roof use and accessibility matter.'],'Back to the bicycle spaces: do visitors count?'],
 ['citation',['Can I reduce the rear yard?','We need district provisions.','Can a bedroom open only onto a court?','Court dimensions and light and air requirements matter.'],'Where does the code say that?'],
 ['hypothetical',['Is a fire alarm required?','Occupancy and size matter.','Can the shop entrance have one step?','An accessible entrance generally needs an accessible route.'],'What if it is an existing building?'],
 ['new-topic',['Can the two exits be adjacent?','Separation matters.'],'Unrelated: what permits do I need for a sidewalk shed?'],
 ['ambiguous',['Can I reduce the lobby or the vestibule?','Both have different minimum dimensions.'],'Can I make it smaller?']
];
// Synthetic catalog labels used only to evaluate relevance selection, not legal content.
export const contextEvidenceCatalog=[
 {id:'R1',title:'Exit stair separation: special building provisions',summary:'Remoteness of interior exit stairways; occupancy exception.'},
 {id:'R2',title:'Duct fire damper exceptions at exterior walls',summary:'Requirements and exceptions for duct penetrations.'},
 {id:'R3',title:'Bicycle parking counting rules',summary:'Required resident and visitor bicycle spaces.'},
 {id:'R4',title:'Light and air for rooms opening onto courts',summary:'Court dimensions and bedroom openings.'},
 {id:'R5',title:'Accessible entrances in existing buildings',summary:'Alterations, existing entrances and exceptions.'}
];
