// Rule-based clean-up for spoken text. Runs fully on-device, no AI.
// It removes English hesitation sounds and stutters, fixes capitals and closes sentences, and
// starts a new paragraph where you paused. The untouched transcript is always kept on the clip.

export type TimedSegment = {
  text: string;
  /** Milliseconds after recording started when this utterance was finalised. */
  atMs: number;
};

const PARAGRAPH_PAUSE_MS = 7000;
const MAX_SEGMENTS_PER_PARAGRAPH = 5;

const FILLERS = /(^|\s)(?:u+m+|u+h+|e+r+m*|a+h+|h+m+|m{2,})(?=[\s,.!?]|$)[,]?/gi;
const STUTTER = /\b([A-Za-z']+)(?:\s+\1\b)+/gi;
const QUESTION_START =
  /^(?:what|why|how|when|where|who|which|is|are|am|do|does|did|can|could|should|would|will|shall|have|has)\b/i;
const DEVANAGARI = /[ऀ-ॿ]/;

function closeSentence(text: string) {
  if (/[.!?।…:;]$/.test(text)) return text;
  const lastChar = text.slice(-1);
  if (DEVANAGARI.test(lastChar)) return `${text}।`;
  if (QUESTION_START.test(text)) return `${text}?`;
  return `${text}.`;
}

export function tidySegment(raw: string) {
  let text = ` ${raw} `
    .replace(FILLERS, '$1')
    .replace(STUTTER, '$1')
    .replace(/\s+([,.!?।])/g, '$1')
    .replace(/,{2,}/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^[,.\s]+/, '');
  if (!text) return '';
  text = text
    .replace(/\bi\b/g, 'I')
    .replace(/\bi'(m|ve|ll|d)\b/gi, (_, rest: string) => `I'${rest.toLowerCase()}`)
    .replace(/^[a-z]/, (letter) => letter.toUpperCase())
    .replace(/([.!?]\s+)([a-z])/g, (_, gap: string, letter: string) => gap + letter.toUpperCase());
  return closeSentence(text);
}

export function tidyTranscript(segments: TimedSegment[]) {
  const paragraphs: string[][] = [];
  let current: string[] = [];
  let lastAt = 0;
  for (const segment of segments) {
    const text = tidySegment(segment.text);
    if (!text) continue;
    const paused = current.length > 0 && segment.atMs - lastAt > PARAGRAPH_PAUSE_MS;
    if (paused || current.length >= MAX_SEGMENTS_PER_PARAGRAPH) {
      paragraphs.push(current);
      current = [];
    }
    current.push(text);
    lastAt = segment.atMs;
  }
  if (current.length) paragraphs.push(current);
  return paragraphs.map((sentences) => sentences.join(' ')).join('\n\n');
}

export function rawTranscript(segments: TimedSegment[]) {
  return segments
    .map((segment) => segment.text.trim())
    .filter(Boolean)
    .join(' ');
}

export function countWords(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}
