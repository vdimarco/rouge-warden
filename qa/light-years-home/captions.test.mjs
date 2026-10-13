// Light Years Home: checks of the karaoke captions, and of the two small overlay helpers that sit beside them
// (tap picking and label placement). node qa/light-years-home/captions.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chunk, timings, wordAt, wordTime, MAX_WORDS, MAX_CHARS, WORD_BASE, PER_LETTER, PUNCT_PAUSE, CHUNK_GAP, SLOW,
} from '../../public/light-years-home/core/captions.js';
import { classifyPointer, hitTest, TAP_MS, TAP_PX, HIT_MIN } from '../../public/light-years-home/core/pick.js';
import { placeLabels, MAX_LABELS } from '../../public/light-years-home/core/labels.js';

const LINES = [
  'You wake up a billion light-years from home.',
  'Your map is gone. Read the sky. Get home.',
  'Home is in that ring. Too big to aim at.',
  'Find a crowd of a thousand galaxies with two giants at its heart.',
  'Hold to go faster.',
  'Nothing is faster than light. Not even you.',
  'Galaxy ahead. Let go!',
  'The Coma Cluster. A thousand galaxies. Home is 323 million light-years away.',
  'Now find a hub of about 1,500 galaxies. A jet streams from the giant at its heart.',
  "That's Leo. One giant, not two.",
  "That's Shapley, a supercluster. Many hearts, not one.",
  'The Fornax Cluster. Between here and home: a flat sheet of galaxies, and an empty void.',
  'Into our own arm: the Orion Arm. A small spur, far from the centre.',
  'Andromeda. A trillion stars. Our big neighbour.',
  'Triangulum. With Andromeda, it marks out the Local Group.',
  'Aldebaran. From Earth it seems to sit in the Hyades. It is twice as close.',
  'Planets appear. Giants far out, rocky worlds close in. Find the small blue one with a big grey moon.',
  'It is Tuesday, 13 October 2026. You are home.',
  'For you: 4 years, 355 days.',
  'You left before there were animals on Earth.',
  'Your shield gives out near Sirius. On Earth it is 2009.',
  'About 1.2 billion years before today. Life is mostly single cells.',
  'The light here left 8.6 years ago.',
  'Shield cracked.',
  'Home.',
];
const words = (s) => s.trim().split(/\s+/).filter(Boolean);
const chars = (s) => [...s].length;

test('chunks: at most 3 words and 18 characters, in order, nothing lost', () => {
  assert.equal(MAX_WORDS, 3);
  assert.equal(MAX_CHARS, 18);
  for (const line of LINES) {
    const cs = chunk(line);
    assert.equal(cs.join(' '), words(line).join(' '), `order kept: ${line}`);
    for (const c of cs) {
      assert.ok(words(c).length <= 3, `"${c}" has more than 3 words`);
      assert.ok(chars(c) <= 18, `"${c}" is longer than 18 characters`);
      assert.ok(c.length > 0);
    }
  }
  assert.deepEqual(chunk(''), []);
  assert.deepEqual(chunk('   '), []);
  assert.deepEqual(chunk(null), []);
});

test('chunks: no lone last word when two words fit together', () => {
  for (const line of LINES) {
    const ws = words(line), cs = chunk(line);
    const pair = ws.slice(-2).join(' ');
    if (ws.length > 1 && chars(pair) <= MAX_CHARS) assert.ok(words(cs[cs.length - 1]).length >= 2, `${line} → ${cs.join(' / ')}`);
  }
  assert.deepEqual(chunk('Read the sky. Home.').slice(-1).map((c) => words(c).length >= 2), [true]);
});

test('chunks: numbers are never split', () => {
  const cases = [
    ['Home is 323 million light-years away.', '323 million'],
    ['Earth is 1,215,266,893 years older.', '1,215,266,893'],
    ['About 1.2 billion years before today.', '1.2 billion'],
    ['It is 13 October 2026 at home.', '2026'],
    ['You wake up a billion light-years from home.', 'a billion'],
  ];
  for (const [line, num] of cases) {
    const cs = chunk(line);
    assert.ok(cs.some((c) => c.includes(num)), `"${num}" kept whole in ${cs.join(' / ')}`);
  }
  // a number longer than the limit still stays whole, as a chunk of its own
  const long = chunk('Total 1,215,266,893,000,000,000 ly.');
  assert.ok(long.includes('1,215,266,893,000,000,000'), long.join(' / '));
});

test('chunks: the opening lines read as designed', () => {
  assert.deepEqual(chunk('You wake up a billion light-years from home.'), ['You wake up', 'a billion', 'light-years', 'from home.']);
  assert.deepEqual(chunk('Your map is gone. Read the sky. Get home.'), ['Your map', 'is gone.', 'Read the sky.', 'Get home.']);
  assert.deepEqual(chunk('Find a crowd of a thousand galaxies with two giants at its heart.'),
    ['Find a crowd', 'of a thousand', 'galaxies', 'with two giants', 'at its heart.']);
  assert.deepEqual(chunk('Hold to go faster.'), ['Hold', 'to go faster.']);
  assert.deepEqual(chunk('Galaxy ahead. Let go!'), ['Galaxy ahead.', 'Let go!']);
  assert.deepEqual(chunk('Shield cracked.'), ['Shield cracked.']);
});

test('timings: word time 0.26 s + 0.03 s a letter + 0.15 s after punctuation, 0.12 s between chunks', () => {
  assert.ok(Math.abs(wordTime('Galaxy') - (WORD_BASE + 6 * PER_LETTER)) < 1e-12);
  assert.ok(Math.abs(wordTime('ahead.') - (WORD_BASE + 5 * PER_LETTER + PUNCT_PAUSE)) < 1e-12);
  assert.ok(Math.abs(wordTime('1,500') - (WORD_BASE + 4 * PER_LETTER)) < 1e-12, 'digits count as letters');
  const tm = timings(['Galaxy ahead.', 'Let go!']);
  const starts = tm.words.map((w) => w.start);
  assert.deepEqual(tm.words.map((w) => w.text), ['Galaxy', 'ahead.', 'Let', 'go!']);
  assert.equal(starts[0], 0);
  assert.ok(Math.abs(starts[1] - 0.44) < 1e-12);
  assert.ok(Math.abs(starts[2] - (0.44 + 0.56 + CHUNK_GAP)) < 1e-12);
  assert.ok(Math.abs(tm.total - (starts[3] + wordTime('go!'))) < 1e-12);
  assert.equal(tm.chunks.length, 2);
});

test('timings: start times rise; Slow multiplies everything by 1.5', () => {
  for (const line of LINES) {
    const cs = chunk(line);
    const a = timings(cs), b = timings(cs, true);
    for (let i = 1; i < a.words.length; i++) assert.ok(a.words[i].start > a.words[i - 1].start, `rising in ${line}`);
    assert.equal(a.words.length, b.words.length);
    for (let i = 0; i < a.words.length; i++) {
      assert.ok(Math.abs(b.words[i].start - SLOW * a.words[i].start) < 1e-9);
      assert.ok(Math.abs(b.words[i].end - SLOW * a.words[i].end) < 1e-9);
    }
    assert.ok(Math.abs(b.total - SLOW * a.total) < 1e-9);
  }
  assert.equal(SLOW, 1.5);
});

test('wordAt: the lit word at sample times', () => {
  const cs = chunk('Nothing is faster than light. Not even you.');
  const tm = timings(cs);
  for (const [i, w] of tm.words.entries()) {
    for (const t of [w.start, w.start + 0.01, (w.start + w.end) / 2, w.end - 1e-6]) {
      const at = wordAt(tm, t);
      assert.deepEqual([at.chunk, at.word, at.index, at.done], [w.chunk, w.word, i, false], `t ${t}`);
    }
  }
  // in the gap between chunks the last word of the chunk stays lit
  const c0 = tm.chunks[0];
  const gap = wordAt(tm, c0.end + CHUNK_GAP / 2);
  assert.deepEqual([gap.chunk, gap.word], [0, c0.words - 1]);
  assert.deepEqual(wordAt(tm, -1).index, 0);
  assert.equal(wordAt(tm, tm.total).done, true);
  assert.equal(wordAt(tm, 999).index, tm.words.length - 1);
  // chunks can be passed straight in
  assert.deepEqual(wordAt(cs, 0.3), wordAt(tm, 0.3));
  assert.deepEqual(wordAt(cs, 0.3 * SLOW, true), wordAt(timings(cs, true), 0.3 * SLOW));
  assert.equal(wordAt(timings([]), 0).done, true);
});

test('pick: a tap is a press and release within 250 ms and 10 px', () => {
  assert.equal(TAP_MS, 250);
  assert.equal(TAP_PX, 10);
  const down = { x: 100, y: 200, t: 1000 };
  assert.equal(classifyPointer(down, { x: 104, y: 203, t: 1200 }), 'tap');
  assert.equal(classifyPointer(down, { x: 106, y: 208, t: 1250 }), 'tap');
  assert.equal(classifyPointer(down, { x: 100, y: 200, t: 1251 }), 'hold');
  assert.equal(classifyPointer(down, { x: 111, y: 200, t: 1100 }), 'drag');
  assert.equal(classifyPointer(down, { x: 300, y: 200, t: 3000 }), 'drag');
  assert.equal(classifyPointer(down, { x: NaN, y: 200, t: 1100 }), 'hold');
  assert.equal(classifyPointer(null, down), 'hold');
});

test('pick: a ring is hit within max(radius, 22 px); live rings beat grey ones', () => {
  assert.equal(HIT_MIN, 22);
  const small = { id: 'a', x: 100, y: 100, r: 14 }, big = { id: 'b', x: 300, y: 100, r: 30 };
  assert.equal(hitTest([small, big], 121, 100), small);
  assert.equal(hitTest([small, big], 100, 123), null);
  assert.equal(hitTest([small, big], 329, 100), big);
  assert.equal(hitTest([small, big], 331, 100), null);
  const near = { id: 'c', x: 130, y: 100, r: 14 };
  assert.equal(hitTest([small, near], 112, 100), small, 'nearest centre');
  assert.equal(hitTest([small, near], 118, 100), near, 'nearest centre');
  assert.equal(hitTest([{ ...small, grey: true }, near], 112, 100).id, 'c', 'live beats grey');
  assert.equal(hitTest([{ ...small, onScreen: false }], 100, 100), null, 'off-screen rings are not hit');
  assert.equal(hitTest(null, 1, 1), null);
});

test('labels: at most 6, inside the free area, never overlapping, flipped to the left at the right edge', () => {
  const W = 390, H = 844;
  const items = Array.from({ length: 10 }, (_, i) => ({ id: 'r' + i, x: 60 + (i % 3) * 120, y: 120 + Math.floor(i / 3) * 140,
    r: 14, text: 'Ring ' + i, width: 50 }));
  const out = placeLabels(items, { width: W, height: H });
  assert.equal(MAX_LABELS, 6);
  assert.ok(out.length === 6, `placed ${out.length}`);
  for (const [i, a] of out.entries()) {
    assert.ok(a.rect.x >= 0 && a.rect.y >= 0 && a.rect.x + a.rect.w <= W && a.rect.y + a.rect.h <= H, `${a.id} inside`);
    for (const b of out.slice(i + 1)) {
      const hit = a.rect.x < b.rect.x + b.rect.w && b.rect.x < a.rect.x + a.rect.w
        && a.rect.y < b.rect.y + b.rect.h && b.rect.y < a.rect.y + a.rect.h;
      assert.ok(!hit, `${a.id} and ${b.id} overlap`);
    }
  }
  // a ring at the right edge gets its label on the left
  const edge = placeLabels([{ id: 'e', x: 370, y: 300, r: 14, text: 'Laniakea Supercluster', width: 130 }], { width: W, height: H });
  assert.equal(edge[0].side, 'left');
  assert.equal(edge[0].align, 'right');
  // a second label next to a placed one moves to its free side
  const pair = placeLabels([
    { id: 'p', x: 150, y: 300, r: 14, text: 'A · 718 Mly', width: 70, priority: 2 },
    { id: 'q', x: 190, y: 290, r: 14, text: 'B · 533 Mly', width: 70, priority: 1 },
  ], { width: W, height: H });
  assert.equal(pair.length, 2);
  assert.equal(pair[0].id, 'p', 'higher priority first');
  assert.ok(pair[1].side !== pair[0].side || pair[1].up !== pair[0].up, 'q moved to a free spot');
  // HUD rects are avoided: the top row blocks labels above a ring near the top
  const top = placeLabels([{ id: 't', x: 200, y: 60, r: 14, text: 'Coma Cluster', width: 80 }],
    { width: W, height: H, avoid: [{ x: 0, y: 0, w: W, h: 44 }] });
  assert.equal(top[0].up, false);
  assert.deepEqual(placeLabels([{ id: 'off', x: 10, y: 10, r: 14, text: 'x', onScreen: false }], { width: W, height: H }), []);
});

// A ring is a thin outline. Inside the Milky Way the galaxy's ring is far bigger than the screen; it once blocked
// every candidate label on the Carina scan because labels were kept off the whole disc of every ring.
test('labels: rings inside a big ring still get labels; outlines and centres stay clear', () => {
  const W = 1440, H = 900;
  const big = { id: 'mw', x: 700, y: 450, r: 1900, text: 'Milky Way', width: 60 };
  const out = placeLabels([big,
    { id: 'A', x: 300, y: 300, r: 14, text: 'A · 27,000 ly', width: 80 },
    { id: 'B', x: 1000, y: 500, r: 14, text: 'B · 8,500 ly', width: 80 }], { width: W, height: H });
  assert.deepEqual(out.map((l) => l.id).sort(), ['A', 'B']);
  // a label that would cross a ring's outline goes to another side
  const ring = { id: 'm31', x: 400, y: 400, r: 120, text: 'Andromeda', width: 60, priority: 0 };
  const inner = { id: 'C', x: 470, y: 330, r: 14, text: 'C · 2.9 Mly', width: 70, priority: 1 };
  const [c] = placeLabels([ring, inner], { width: W, height: H });
  const corners = [[c.rect.x, c.rect.y], [c.rect.x + c.rect.w, c.rect.y], [c.rect.x, c.rect.y + c.rect.h],
    [c.rect.x + c.rect.w, c.rect.y + c.rect.h]].map(([x, y]) => Math.hypot(x - ring.x, y - ring.y));
  const clear = Math.max(...corners) < ring.r - 2 || Math.min(...corners) > ring.r + 2;
  assert.ok(clear, `C's label crosses the ring: ${corners}`);
  // nothing covers the object at a ring's centre
  const centre = placeLabels([{ id: 'x', x: 400, y: 400, r: 300, text: 'Big', width: 30, priority: 0 },
    { id: 'y', x: 380, y: 420, r: 14, text: 'Small one', width: 60, priority: 1 }], { width: W, height: H });
  const y = centre.find((l) => l.id === 'y');
  const nx = Math.max(y.rect.x, Math.min(400, y.rect.x + y.rect.w));
  const ny = Math.max(y.rect.y, Math.min(400, y.rect.y + y.rect.h));
  assert.ok(Math.hypot(400 - nx, 400 - ny) >= 14, 'label over the big ring\'s centre');
});
