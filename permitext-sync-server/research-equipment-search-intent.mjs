// Equipment vocabulary is search intent, never authority or a legal result.
export const researchEquipmentSearchIntentVersion = '20261003-positive-equipment-language-v1';

const hoseEquipment = /\b(?:hose[-\s]+(?:faucets?|taps?|bibb?s?|connections?|outlets?)|sillcocks?|(?:faucets?|taps?|spigots?|outlets?)\b[^.!?;]{0,120}\b(?:garden[-\s]+)?hoses?(?:[-\s]+threads?)?|(?:attach|connect|hook\s+up)\b[^.!?;]{0,30}\b(?:garden[-\s]+)?hoses?\b[^.!?;]{0,60}\b(?:faucets?|taps?|spigots?|outlets?))\b/i;
const technicalHoseEquipment = /\b(?:sillcocks?|hose[-\s]+bibbs?|hose[-\s]+connections?)\b/i;
const otherEquipment = /\b(?:lavator\w*|sinks?|drinking[-\s]+fountains?|toilets?|showers?|water[-\s]+heaters?|boilers?|ducts?|extinguishers?)\b/i;

function positiveCurrentText(question) {
  // Quoted examples and contrasted/negated objects cannot nominate equipment.
  // Clause boundaries retain a following affirmative correction.
  return String(question || '').replace(/`[^`]*`|"[^"\n]*"|“[^”\n]*”|(?<!\p{L})'[^'\n]+'(?!\p{L})/gu, ' ')
    .replace(/\b(?:not|no|never|without|excluding|instead\s+of|rather\s+than|unlike|(?:do|does|did)\s+not|don['’]t)\b[^.;!?]*?(?=\s*[;.!?]|\bbut\b|$)/gi, ' ')
    .replace(/\b(?:compare[ds]?\s+with|compared\s+to|in\s+contrast\s+to)\b[^.;!?]*?(?=\s*[,;.!?]|\bbut\b|$)/gi, ' ');
}

export function researchEquipmentSearchIntent(question = '') {
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

export function researchEquipmentSubjectMatches(text, intent) {
  return intent?.subject === 'hose_connection' && technicalHoseEquipment.test(positiveCurrentText(text));
}
