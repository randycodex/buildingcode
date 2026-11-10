// Generated labels stay short; the source question and calculation retain their full text.
export function generatedNoteTitle(value, fallback = 'Untitled', limit = 80) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return fallback;
  if (text.length <= limit) return text;
  const prefix = text.slice(0, limit - 1);
  const boundary = prefix.lastIndexOf(' ');
  return `${prefix.slice(0, boundary > limit / 2 ? boundary : prefix.length).trimEnd()}…`;
}
