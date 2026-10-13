// Light Years Home: karaoke captions. Splits a line of text into small chunks (at most 3 words and 18 characters,
// so one chunk fits a 390 px phone at caption size), times each word, and says which word is lit at a given moment.
// Pure: the HUD draws the chunks; the engine keeps the timings in its plain-data state.

export const MAX_WORDS = 3;
export const MAX_CHARS = 18;
export const WORD_BASE = 0.26;     // seconds per word
export const PER_LETTER = 0.03;    // plus this per letter
export const PUNCT_PAUSE = 0.15;   // plus this after punctuation
export const CHUNK_GAP = 0.12;     // between chunks
export const SLOW = 1.5;           // Captions: Slow

// Words that read badly at the end of a chunk, and that make a good place to start the next one.
const WEAK = new Set(['a', 'an', 'the', 'of', 'to', 'in', 'at', 'on', 'by', 'and', 'or', 'but', 'with', 'from', 'for',
  'into', 'than', 'your', 'its', 'our', 'my', 'their', 'his', 'her', 'own']);
const SCALE = new Set(['hundred', 'thousand', 'million', 'billion', 'trillion']);
const LEAD = new Set(['a', 'one']);

const bare = (w) => w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
const len = (s) => [...s].length;
const endsSentence = (w) => /[.!?…]["')\]]*$/u.test(w);
const endsClause = (w) => /[,;:]["')\]]*$/u.test(w);
const hasDigit = (w) => /\p{N}/u.test(w);

// Groups of words that must stay together: a number with its scale words ('323 million', '1.2 billion', and
// 'a billion' too). Returns an array of word arrays.
function groupWords(words) {
  const groups = [];
  const joins = (j) => j < words.length && SCALE.has(bare(words[j])) && !endsSentence(words[j - 1])
    && !endsClause(words[j - 1]);
  for (let i = 0; i < words.length;) {
    const w = words[i];
    let j = i + 1;
    if (hasDigit(w) || (LEAD.has(bare(w)) && joins(j))) {
      while (joins(j)) j++;
    }
    groups.push(words.slice(i, j));
    i = j;
  }
  return groups;
}

// Best split of a run of groups by dynamic programming. Hard rules: at most 3 words and 18 characters per chunk, and
// a group is never split (a group too long on its own becomes a chunk of its own). Soft rules, by cost: fewer chunks,
// no lone word at the very end, few one-word chunks, no chunk ending on a small word ('a', 'of', 'your'), breaks at
// commas and before small words.
function splitRun(groups, final) {
  const n = groups.length;
  const total = groups.reduce((s, g) => s + g.length, 0);
  const best = new Array(n + 1).fill(Infinity), from = new Array(n + 1).fill(-1);
  best[0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = i - 1; j >= 0; j--) {
      const words = groups.slice(j, i).flat();
      const fits = words.length <= MAX_WORDS && len(words.join(' ')) <= MAX_CHARS;
      if (!fits && i - j > 1) break;
      if (!(best[j] < Infinity)) continue;
      const last = words[words.length - 1];
      let cost = 1 + (fits ? 0 : 5);
      if (words.length === 1 && total > 1) cost += i === n && final ? 100 : 1;
      if (words.slice(0, -1).some((w) => endsClause(w) || endsSentence(w))) cost += 0.5;
      if (i < n) {
        if (WEAK.has(bare(last)) && !endsClause(last)) cost += 0.8;
        if (endsClause(last) || endsSentence(last)) cost -= 0.5;
        else if (WEAK.has(bare(groups[i][0]))) cost -= 0.3;
      }
      if (best[j] + cost < best[i]) { best[i] = best[j] + cost; from[i] = j; }
    }
  }
  const chunks = [];
  for (let i = n; i > 0; i = from[i]) chunks.unshift(groups.slice(from[i], i).flat().join(' '));
  return chunks;
}

// Text → chunks (strings), in order. A chunk does not run across the end of a sentence, except that a one-word last
// sentence may join the one before it, so the text never ends on a lone word when that can be helped.
export function chunk(text) {
  const words = String(text ?? '').trim().split(/\s+/u).filter(Boolean);
  const sentences = [];
  let sentence = [];
  for (const w of words) {
    sentence.push(w);
    if (endsSentence(w)) { sentences.push(sentence); sentence = []; }
  }
  if (sentence.length) sentences.push(sentence);
  if (sentences.length > 1 && sentences[sentences.length - 1].length === 1) {
    const tail = sentences.pop();
    sentences[sentences.length - 1].push(...tail);
  }
  return sentences.flatMap((s, k) => splitRun(groupWords(s), k === sentences.length - 1));
}

// Seconds one word stays lit.
export function wordTime(word, slow = false) {
  const letters = (word.match(/[\p{L}\p{N}]/gu) || []).length;
  const punct = /[^\p{L}\p{N}]$/u.test(word) ? PUNCT_PAUSE : 0;
  return (WORD_BASE + PER_LETTER * letters + punct) * (slow ? SLOW : 1);
}

// Chunks → timings: { words: [{ chunk, word, text, start, end }], chunks: [{ start, end, words }], total }.
// A chunk stays on screen through the gap after it.
export function timings(chunks, slow = false) {
  const words = [], spans = [];
  let t = 0;
  (Array.isArray(chunks) ? chunks : []).forEach((c, ci) => {
    if (ci > 0) t += CHUNK_GAP * (slow ? SLOW : 1);
    const start = t;
    const list = String(c).split(/\s+/u).filter(Boolean);
    list.forEach((text, wi) => {
      const d = wordTime(text, slow);
      words.push({ chunk: ci, word: wi, text, start: t, end: t + d });
      t += d;
    });
    spans.push({ start, end: t, words: list.length });
  });
  return { words, chunks: spans, total: t };
}

// Which word is lit at time t: { chunk, word, index, done }. index counts words across all chunks.
// Takes a timings() result, or chunks (then timed with slow).
export function wordAt(timing, t, slow = false) {
  const tm = Array.isArray(timing) ? timings(timing, slow) : timing;
  const ws = tm && tm.words ? tm.words : [];
  if (!ws.length) return { chunk: -1, word: -1, index: -1, done: true };
  if (!(t >= tm.total)) {
    let lo = 0, hi = ws.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (ws[mid].start <= t) lo = mid; else hi = mid - 1;
    }
    return { chunk: ws[lo].chunk, word: ws[lo].word, index: lo, done: false };
  }
  const k = ws.length - 1;
  return { chunk: ws[k].chunk, word: ws[k].word, index: k, done: true };
}
