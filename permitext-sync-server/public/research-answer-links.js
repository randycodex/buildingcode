const validID = value => typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\s\u0000-\u001f\u007f]/.test(value);
export function researchAnswerURL(answerID) {
  return validID(answerID) ? `https://per.codes/workspace?researchAnswer=${encodeURIComponent(answerID)}` : '';
}
export function linkedResearchAnswerID(url) {
  try {
    const id = new URL(url).searchParams.get('researchAnswer');
    return validID(id) ? id : '';
  } catch { return ''; }
}
