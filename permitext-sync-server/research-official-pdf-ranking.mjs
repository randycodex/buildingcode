// Rank complete PDF pages. Normalization affects search terms only; returned
// evidence, page references and content hashes always retain the original text.
export const researchOfficialPDFRankingVersion = "20260909-pdf-question-weighting-v1";

const stopWords = new Set((
  "about after also and are current does from have include into official page that the their this those under using " +
  "what when where which with without should has how can may will must for not than any its been context"
).split(" "));

function terms(value) {
  return (String(value || "").toLowerCase()
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    .replace(/(\d)\s*%/g, "$1 percent")
    .match(/[a-z]+|\d+(?:\.\d+)?/g) || [])
    .filter((term) => !stopWords.has(term) && (term.length >= 3 || /^\d/.test(term)));
}

function reportedQuestionTerms(query) {
  // A scenario may report what the user asks, followed by an uninformative
  // "What is the right answer?". Give that explicit subject extra weight;
  // preserve all other query terms and do not infer a missing question.
  const reported = String(query || "").match(
    /(?:^|\b(?:and|but|user|owner|applicant|client)\s+)(?:asks|is asking)\s+(?:about|which|whether|how|what|if)\s+([^.!?]+(?:\.(?=\d)[^.!?]+)*)/i
  )?.[1] || "";
  return new Set(terms(reported));
}

export function researchOfficialPDFPageScores(passages, query) {
  const documents = passages.filter((passage) => passage?.kind === "pdf_page").map((passage) => {
    const frequencies = new Map();
    const words = terms(passage.text);
    for (const word of words) frequencies.set(word, (frequencies.get(word) || 0) + 1);
    return { passage, frequencies, length: words.length };
  });
  if (!documents.length) return new Map();
  const queryTerms = [...new Set(terms(query))];
  const intentTerms = reportedQuestionTerms(query);
  const averageLength = documents.reduce((sum, document) => sum + document.length, 0) / documents.length || 1;
  const weights = new Map(queryTerms.map((term) => {
    const frequency = documents.filter((document) => document.frequencies.has(term)).length;
    return [term, Math.log(1 + (documents.length - frequency + 0.5) / (frequency + 0.5)) *
      (intentTerms.has(term) ? 3 : 1)];
  }));
  return new Map(documents.map(({ passage, frequencies, length }) => [passage,
    queryTerms.reduce((score, term) => {
      const frequency = frequencies.get(term) || 0;
      // BM25-style saturation and modest page-length normalization prevent
      // long pages repeating generic filing words from dominating the result.
      return score + weights.get(term) * frequency * 2.2 /
        (frequency + 1.2 * (0.65 + 0.35 * length / averageLength));
    }, 0)
  ]));
}
