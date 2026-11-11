// A complete citation names a code and an identifier, not two prose terms.
// Keep ordinary/quoted queries intact and intersect with the caller's scope.
export function searchCitationQuery(value) {
  const query = String(value || '').trim();
  const match = query.match(/^(?:(?:section|table)\s+)?(AC|BC|EBC|ECC|EC|FC|FGC|MC|PC|ZR|HMC|T24|T25|T26|T28)\s*(?:(?:section|table)\s+|§+\s*)?([A-Z]?\d+(?:[-.]\d+[A-Z]?)*(?:\([\dA-Z]+\))*)\.?$/i);
  return { query: match ? match[2] : query, codePrefix: match ? match[1].toUpperCase() : null };
}
