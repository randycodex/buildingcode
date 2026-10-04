// Equipment vocabulary is search intent, never authority or a legal result.
import { researchPositiveSearchText as positiveCurrentText } from './research-search-vocabulary.mjs';
export const researchEquipmentSearchIntentVersion = '20261003-shared-positive-equipment-language-v3';

const hoseEquipment = /\b(?:hose[-\s]+(?:faucets?|taps?|bibb?s?|connections?|outlets?)|sillcocks?|(?:faucets?|taps?|spigots?|outlets?)\b[^.!?;]{0,120}\b(?:garden[-\s]+)?hoses?(?:[-\s]+threads?)?|(?:attach|connect|hook\s+up)\b[^.!?;]{0,30}\b(?:garden[-\s]+)?hoses?\b[^.!?;]{0,60}\b(?:faucets?|taps?|spigots?|outlets?))\b/i;
const technicalHoseEquipment = /\b(?:sillcocks?|hose[-\s]+bibbs?|hose[-\s]+connections?)\b/i;
const otherEquipment = /\b(?:lavator\w*|sinks?|drinking[-\s]+fountains?|toilets?|showers?|water[-\s]+heaters?|boilers?|ducts?|extinguishers?)\b/i;

function hoseSearchIntent(question = '') {
  const original = String(question || '');
  if (!original.trim() || original.length > 4000) return null;
  const current = original.split(/\b(?:new\s+(?:topic|question)|switch\s+(?:topics?|subjects?))\s*[:;,]?/i).at(-1);
  const positive = positiveCurrentText(current);
  if (!hoseEquipment.test(positive)) return null;
  // Generic hoses/outlets occur in several disciplines. Only positive water
  // intent or an ordinary water fitting may supply this plumbing search hint.
  if (/\b(?:gas|propane|LPG|liquefied[-\s]+petroleum|compressed[-\s]+air|pneumatic|fire[-\s]+department|fire[-\s]?hoses?|firefighting|firefighters?)\b/i.test(positive)) return null;
  const waterFitting = /\b(?:faucets?|taps?|spigots?|sillcocks?|hose[-\s]+bibb?s?)\b/i.test(positive);
  if (!waterFitting && !/\b(?:water|plumbing|garden[-\s]+hoses?)\b/i.test(positive)) return null;
  // A current named book owns the foreground. Construction Code is a broader
  // family; it does not by itself prohibit the plumbing search hint.
  const namedOtherAuthority = /\b(?:Building|Mechanical|Fuel[-\s]+Gas|Fire|Administrative|Existing[-\s]+Building)\s+(?:Code|Rules|Regulations)\b|\bZoning\s+(?:Resolution|Rules|Regulations)\b|\b(?:BC|MC|FGC|FC|AC|EBC|ZR)\b/i.test(positive);
  const namedPlumbing = /\bPlumbing\s+(?:Code|Rules|Regulations)\b|\bPC\b/i.test(positive);
  if (namedOtherAuthority && !namedPlumbing) return null;
  const questions = positive.match(/[^.!?]*\?/g) || [];
  const requested = questions.at(-1) || positive.split(/[.!]/).filter(value => value.trim()).at(-1) || positive;
  // A prior equipment mention in this same message is incidental when the
  // actual request names another object. Multiple named equipment requests
  // retain ordinary cross-topic retrieval rather than forcing one foreground.
  if (otherEquipment.test(requested) ||
      (/\b(?:compar\w*|both)\b/i.test(positive) && otherEquipment.test(positive))) return null;
  const terms = ['hose', 'connection', 'bibb', 'sillcock'];
  if (/\b(?:drinking|potable)[-\s]+water\b/i.test(positive)) terms.push('potable', 'water');
  if (/\bbackflow\b|\bwater\b[^.!?;]{0,45}\b(?:backward|backwards|back\s+into)\b|\b(?:backward|backwards)\b[^.!?;]{0,45}\bwater\b/i.test(positive)) terms.push('backflow');
  return { version: researchEquipmentSearchIntentVersion, kind: 'positive_equipment_subject',
    subject: 'hose_connection', codePrefix: 'PC', query: terms.join(' '), terms };
}

const airCovering = /\b(?:louvers?|louvres?|grilles?|dampers?)\b/i;
const airOpening = /\b(?:air|airflow|intakes?|ventilation|openings?)\b/i;
const gasEquipment = /\b(?:gas[- ](?:fired|burning)|gas\s+(?:equipment|appliances?|boilers?|heaters?|furnaces?))\b/i;

function airOpeningSearchIntent(question, options) {
  const current = String(question || '').split(/\b(?:new\s+(?:topic|question)|switch\s+(?:topics?|subjects?))\s*[:;,]?/i).at(-1);
  const positive = positiveCurrentText(current);
  const namedMechanical = /\b(?:Mechanical\s+(?:Code|Rules|Regulations)|MC)\b/i.test(positive);
  const namedFuel = /\b(?:Fuel[- ]Gas\s+(?:Code|Rules|Regulations)|FGC)\b/i.test(positive);
  if (/\b(?:Building|Plumbing|Fire|Administrative|Existing[- ]Building)\s+(?:Code|Rules|Regulations)\b|\b(?:BC|PC|FC|AC|EBC|ZR)\b|\bZoning\s+Resolution\b/i.test(positive)) return null;
  const questions = positive.match(/[^.!?]*\?/g) || [];
  const requested = questions.at(-1) || positive;
  if (/\b(?:hose|faucet|lavator\w*|toilet|shower|drain|trap|piping|egress|exit)\b/i.test(requested)) return null;
  // Only the continuity planner's active human topics can resolve a short
  // equipment follow-up. Checked source titles and assistant claims are never
  // accepted here as a supplied air purpose or equipment premise.
  const continuing = options?.contextDependentFollowUp === true &&
    !/\b(?:new\s+(?:topic|question)|switch\s+(?:topics?|subjects?))\b/i.test(question);
  const currentEditions = current.match(/\b(?:19|20)\d{2}\b(?=[^.!?]{0,35}\b(?:code|edition|version)\b)/gi) || [];
  const humanTopics = continuing ? (options?.humanTopics || []).filter(value => typeof value === 'string').slice(0, 2)
    .filter(value => !currentEditions.length || !/\b(?:19|20)\d{2}\b/.test(value) || currentEditions.some(year => value.includes(year)))
    .map(value => positiveCurrentText(value.slice(0, 640))) : [];
  const context = humanTopics.join(' ');
  const combined = `${positive} ${context}`;
  if (!airCovering.test(combined) || !airOpening.test(combined)) return null;
  // A current explicit absence cannot revive the old covering from context.
  if (!airCovering.test(positive) && airCovering.test(current)) return null;
  const area = /\b(?:fraction|percent(?:age)?|(?:free|open|net)[- ]area|usable\b[^.!?]{0,25}\barea|area\b[^.!?]{0,25}\bcount)\b/i.test(positive);
  const size = /\b(?:how\s+(?:big|large)|siz(?:e|ing)|opening\b[^.!?]{0,30}\bdimensions?)\b/i.test(positive);
  const damper = /\b(?:dampers?|hand[- ]operated|manual(?:ly)?|adjustable|operable)\b/i.test(positive);
  if (!(area || size || damper) || (!airCovering.test(positive) && !/\bopenings?\b/i.test(positive))) return null;
  const ventilationOnly = /\b(?:only|solely|just)\b[^.!?]{0,45}\b(?:general\s+)?(?:room|office|space)?\s*ventilation\b|\b(?:not|no)\s+(?:for\s+)?combustion(?:[- ]air)?\b/i.test(current);
  const gasExcluded = (gasEquipment.test(current) && !gasEquipment.test(positive)) ||
    /\b(?:no|not)\s+(?:gas[- ](?:fired|burning)|gas)\s+(?:equipment|appliances?|boilers?|heaters?|furnaces?)\b|\b(?:does?\s+not|doesn['’]t)\s+(?:contain|have|serve)\s+(?:any\s+)?gas\s+(?:equipment|appliances?)\b/i.test(current);
  const fuelRecall = !ventilationOnly && !gasExcluded && !namedMechanical &&
    (namedFuel || gasEquipment.test(combined) || /\bcombustion[- ]air\b/i.test(positive));
  const terms = ['air', 'opening'];
  if (/\b(?:louvers?|louvres?)\b/i.test(combined)) terms.push('louver');
  else if (/\bgrilles?\b/i.test(combined)) terms.push('grille');
  if (area || size) terms.push('free', 'area');
  if (size) terms.push('size');
  if (damper) terms.push('damper', 'manual');
  if (/\b(?:outdoor|outside)\b/i.test(combined)) terms.push('outdoor');
  if (fuelRecall) terms.push('gas', 'equipment');
  return { version: researchEquipmentSearchIntentVersion, kind: 'positive_equipment_subject', subject: 'air_opening',
    codePrefixes: namedFuel ? (namedMechanical ? ['MC', 'FGC'] : ['FGC']) : fuelRecall ? ['MC', 'FGC'] : ['MC'], query: terms.join(' '), terms,
    aspect: size ? 'size' : area ? 'area' : 'damper', purposeUnresolved: fuelRecall && !/\bcombustion[- ]air\b/i.test(positive) };
}

export function researchEquipmentSearchIntent(question = '', options = {}) {
  if (!String(question || '').trim() || String(question).length > 4000) return null;
  return hoseSearchIntent(question) || airOpeningSearchIntent(question, options);
}

export function researchEquipmentSubjectMatches(text, intent) {
  const positive = positiveCurrentText(text);
  if (intent?.subject === 'hose_connection') return technicalHoseEquipment.test(positive);
  if (intent?.subject !== 'air_opening' || !/\b(?:air|combustion|ventilation)\b/i.test(positive) ||
      !/\b(?:openings?|louvers?|louvres?|grilles?|dampers?)\b/i.test(positive)) return false;
  if (intent.aspect === 'area') return /\b(?:net\s+)?free[- ]area\b/i.test(positive);
  if (intent.aspect === 'size') return /\b(?:siz(?:e|ing)|dimensions?|(?:net\s+)?free[- ]area)\b/i.test(positive);
  return /\b(?:dampers?|manual(?:ly)?|operable)\b/i.test(positive);
}
