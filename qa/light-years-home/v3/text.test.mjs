// Light Years Home v3: the phone text budget (final.md 18.1, story §3.3) over every string the world data shows:
// lines, mission titles, objectives and toasts, event titles and gate names, labels, scale cards, fact cards,
// rumours and jump labels. Owner: WP6. node qa/light-years-home/v3/text.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkLine, LIMITS, SPEAKERS } from '../../../public/light-years-home/core/world/schema.js';
import {
  ZONE_IDS, loadZone, MISSIONS, LINE_LIST, FACT_LIST, JUMP_LIST, OPENING,
} from '../../../public/light-years-home/core/world/index.js';
import { EARLIER } from '../../../public/light-years-home/core/milestones.js';

const zones = await Promise.all(ZONE_IDS.map(loadZone));
const events = zones.flatMap((z) => z.events);
const LABEL = 26;              // ring, gate and far labels: one row, the toast budget
const SCALE = 60;              // the scale card: two rows of the grey info box
const NUMBER = 32;             // a scan's number in the info box
const CARD_WORDS = 25;

// Objectives start with a verb (story §3.3). New verbs go here.
const VERBS = new Set(['CATCH', 'GRAB', 'SCAN', 'FLY', 'DRIFT', 'FIND', 'HOOK', 'SLING', 'HAUL', 'CROSS', 'DROP',
  'TAKE', 'CARRY', 'RIDE', 'SHAKE', 'FOLLOW', 'BEAT', 'LAP', 'DELIVER', 'TOW', 'ESCORT', 'ESCAPE', 'REACH']);

// Templates as talk.js fills them: {n} a chain length, {short} an event title.
const titleCase = (s) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
function expand(text) {
  let out = [text];
  if (text.includes('{n}')) out = out.map((t) => t.replace('{n}', '99'));
  if (text.includes('{short}')) out = out.flatMap((t) => events.map((e) => t.replace('{short}', titleCase(e.title))));
  return out;
}

const labels = [];
for (const z of zones) {
  for (const r of z.rings || []) if (r.label) labels.push([z.id, r.label]);
  for (const f of z.far || []) if (f.label) labels.push([z.id, f.label]);
  for (const b of z.bodies || []) if (b.label) labels.push([z.id, b.label]);
  for (const a of z.actors || []) if (a.label) labels.push([z.id, a.label]);
  for (const s of z.scans || []) if (s.label) labels.push([z.id, s.label]);
  for (const s of Object.values(z.sets || {})) labels.push([z.id, s.label]);
  if (z.exit) labels.push([z.id, z.exit.label]);
  for (const e of z.events) for (const g of e.gates || []) if (g.name) labels.push([e.id, g.name]);
  for (const e of z.events) if (e.start?.name) labels.push([e.id, e.start.name]);
}
for (const j of JUMP_LIST) {
  for (const p of j.pieces) labels.push([j.id, p.label]);
  if (j.fork) labels.push([j.id, j.fork.a], [j.id, j.fork.b]);
  if (j.tutorial) labels.push([j.id, j.tutorial]);
}

test('titles at most 18 characters, in capitals', () => {
  const titles = [...MISSIONS.map((m) => m.title), ...events.map((e) => e.title)];
  assert.ok(titles.length >= 12);
  for (const t of titles) {
    assert.ok(t.length <= LIMITS.title, `"${t}" is ${t.length} characters`);
    assert.equal(t, t.toUpperCase(), t);
  }
});

test('objectives at most 26 characters and starting with a verb', () => {
  const objectives = MISSIONS.flatMap((m) => m.beats.map((b) => b.objective));
  assert.ok(objectives.length >= 10);
  for (const o of objectives) {
    assert.ok(o.length <= LIMITS.objective, `"${o}" is ${o.length} characters`);
    assert.equal(o, o.toUpperCase(), o);
    assert.ok(VERBS.has(o.split(/\s+/)[0]), `"${o}" starts with a verb`);
  }
});

test('lines 2 to 8 words and 44 characters (core/world/schema.js checkLine), templates filled in', () => {
  assert.ok(LINE_LIST.length >= 90, `${LINE_LIST.length} lines`);
  const ids = new Set();
  for (const l of LINE_LIST) {
    assert.ok(!ids.has(l.id), `${l.id} twice`);
    ids.add(l.id);
    assert.deepEqual(checkLine(l), [], l.id);
    assert.ok(SPEAKERS.includes(l.speaker));
    for (const t of expand(l.text)) {
      const w = t.trim().split(/\s+/).length;
      assert.ok(w >= 2 && w <= 8 && t.length <= LIMITS.lineChars, `${l.id} filled in: "${t}"`);
    }
  }
});

test('toasts at most 26 characters; labels, scale cards, card numbers and cards fit their boxes', () => {
  const toasts = MISSIONS.flatMap((m) => [...(m.fails || []), ...m.beats.flatMap((b) => b.fails || [])])
    .map((f) => f.toast).filter(Boolean);
  assert.ok(toasts.length >= 3);
  for (const t of toasts) assert.ok(t.length <= LIMITS.toast && t === t.toUpperCase(), `toast "${t}"`);
  for (const [where, l] of labels) {
    assert.ok(l.length <= LABEL && l === l.toUpperCase(), `${where}: label "${l}" (${l.length})`);
  }
  for (const z of zones) assert.ok(z.scaleCard.length <= SCALE && z.scaleCard === z.scaleCard.toUpperCase(), z.id);
  for (const c of FACT_LIST) {
    assert.ok(c.text.trim().split(/\s+/).length <= CARD_WORDS, `card ${c.id}`);
    if (c.number) assert.ok(c.number.length <= NUMBER, `card ${c.id} number`);
  }
  for (const z of zones) for (const r of z.rumours || []) assert.ok(r.text.split(/\s+/).length <= CARD_WORDS, r.id);
});

// Every string a player reads in the world data, for the dash and narration checks.
function allText() {
  const out = [];
  const push = (where, s) => { if (typeof s === 'string' && s) out.push([where, s]); };
  for (const l of LINE_LIST) for (const t of expand(l.text)) push(l.id, t);
  for (const m of MISSIONS) {
    push(m.id, m.title);
    for (const b of m.beats) push(m.id, b.objective);
    for (const f of [...(m.fails || []), ...m.beats.flatMap((b) => b.fails || [])]) push(m.id, f.toast);
  }
  for (const e of events) push(e.id, e.title);
  for (const [where, l] of labels) push(where, l);
  for (const z of zones) {
    push(z.id, z.name);
    push(z.id, z.scaleCard);
    for (const r of z.rumours || []) push(r.id, r.text);
  }
  for (const c of FACT_LIST) { push(c.id, c.title); push(c.id, c.text); push(c.id, c.number); }
  for (const m of EARLIER) push(m.id, m.text);
  return out;
}

test('no em or en dashes', () => {
  const all = allText();
  assert.ok(all.length > 250, `${all.length} strings`);
  for (const [where, s] of all) assert.ok(!/[—–]/.test(s), `${where}: "${s}"`);
});

// v1's normalising (qa/light-years-home/route.test.mjs) and FNV-1a hashes (base 36) of every 6-word run of the
// source video's narration (scratchpad video-notes.md). Hashes, so the narration itself is not copied into the repo.
const SPELL = { centre: 'center', grey: 'gray', neighbour: 'neighbor', neighbours: 'neighbors', colour: 'color',
  metres: 'meters' };
const words = (t) => t.toLowerCase().replace(/[’']/g, '').replace(/(\d),(\d)/g, '$1$2').split(/[^a-z0-9]+/)
  .filter(Boolean).map((w) => SPELL[w] || w);
const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
};
const NARRATION_6 = new Set([
  'j1dzf9', '1od7jbv', '16dsr44', '14lld0g', '1xqqm0y', '1mb4mhu', '16kzy2y', 'wgfb7w', '18x8uam', 'dfm9d3',
  '1fqtye0', '1xt95qn', '5sxpxr', 'xxyevy', '1ifz19z', 'vjjln7', '83wczl', '1i3i2ub', '165x1v', '16m8m5i', '1ruka7d',
  'ug5u6w', 'optiw4', '1v677qh', '10qjvro', 'q6ugek', '1fxhhtj', 'ih4q7i', '10chtx9', '1qados9', 'w81xsa', '1py8xbt',
  'osc8l7', '155t2ro', '1q5u1kz', '1growes', '4toh2k', '16ux8mw', '37v8a2', '1l4e2h3', '1bez6b0', 'wf3n3j', '1e84krb',
  'ml1j2n', '1mpdkyb', '135sbaq', '1m90rjd', 'fxdiga', 'rc99yz', 'yr5u2c', '1xdzgev', '1xsnaei', 'tdn7rz', '12ts2c1',
  'ja5x7x', '1chkp9o', 'k2drn', 'jnyzyu', '1litcma', '99g7b8', 'f7ewyq', 'xlft85', '19wqwmd', 'z6m4ve', '1hdoz73',
  '33b5h9', '1e6tske', '1rbwp4d', '75o3mj', '177609y', 'zlullr', 'n9z3ja', '1rd08wp', 'avb5q8', '11jmjvj', '8n54pd',
  '13vxznq', '1uktsm0', 'cv293k', '1bojjtn', '4d9drv', '1lwfilu', 'c6fdzt', 'ce4jto', '14cjr36', '1aa3v2z', '1lew5hk',
  '5go8qi', 'wlu6c7', '16x0zak', '7blgbx', '1ayyxyj', 'hp8q6h', 'nkrtmi', '1eppoce', 'i5wh9i', 'qnrtyt', '1lfx9p3',
  '14dvdcj', 'rp5rj3', '171821y', '1h0rgd9', 'jxlhsz', 'y254m7', 'wbzhrf', 'va6h3p', '181ac1z', 'imvggf', '10j1n6b',
  'hyw9an', 'pejw7p', '6xmnr9', '1ekjkb5', 'gfhmd5', '10wba8k', '1kef4n2', '1wojd07', '1id0an4', '10ti23r', '15m7k7j',
  'oukiti', 'lkwkf0', '11z2atm', '1xbzyll', '16tqe6r', '1xsklb8', '1l3kzbw', '1oxbe5a', '156vnjy', 'hryod9', 'hf2afi',
  'sd2sus', 'hcyvb6', 'bs0t79', '1usff0j', 'pt6rlg', '1qze4i8', '1lvqbpl', '1in4qsp', 'fef2px', 'pr9vjt', 'op6a1l',
  '15g2sge', '1qqkseu', 'p388q2', '1c78k80', '9inu65', '1skgaqv', '1ngpjiz', 'lqmjx3', 'fj5efs', '1c7i1df', '18fyiur',
  '8ajnef', 'wzak2m', '10ww1br', '3ohmzx', '1786sp1', '1nkf55n', '2gaq7d', '1dnr5s', '1v3tdjy', '1i1dwx1', '295zbi',
  '17vojxc', '97yq53', '2if4o6', '1ljdxtt', '1x71df4', '19vh97j', '1tupyj3', '1ey7ne', '78269b', 'qb6clc', 'lepcwl',
  '10r8iz3', '1jyagyj', '152h2qu', '60hv2q', 'hnmwr0', '1clv1tp', '1xkb1cm', '1odxn00', '1nj0s5j', 'ibcu88',
  '1d8igqt', '14t64bz', '1ikqy7b', '8w4ypp', 'ofcgoy', '1dszqra', '1t8bodl', 't4zyu1', '1vycf6m', '15ovo62',
  '19qe563', '182753f', '1keawab', '1xy54mu', '103697n', '14v6c5b', 'n3dr0m', '1u0l1rn', '10h5dx5', '1ttr606',
  '7f9cj2', '1tge6zf', '1wruiem', 'ri214', 'jzfdr3', '18m9z75', 'sawixz', 'wvwl92', 'igm1sy', '1110uid', '1muiskk',
  'qjvnad', 'n87hkg', '5gzzet', '1mndrr6', 'a4gr8r', '1osytrv', 'z9sy6c', 'fs4edf', '1u26i3x', '1746um', '1ehthjq',
  'q9nbmk', 'ywvjhv', '11jyies', '1ufbxq0', '6kchrq', '14joqcy', 'tor83q', '5x3llf', 'tygrdq', '1fea4s7', '126jky8',
  'ysh306', '8dvep4', 'o7ny5n', '1veaxz4', '1sgtqcz', '11mgs1v', '1amgqkv', 'gmafbl', '12o9jdr', '78c4ak', 'tmopw0',
  '1thyovz', '1ljpikc', '192jy5z', 'fiwjtk', 'rd4ing', '1fncj0r', '32m5ks', 'ybg68t', '14w69va', '11s7jer', '18l80jd',
  '1fjlrts', '1wqvo9l', '1fvljtc', '1nvnhl4', '1umacwq', 'bvumgo', 'fezhw0', '18yvaf0',
]);

function noRun(where, text) {
  const w = words(text);
  for (let i = 0; i + 6 <= w.length; i++) {
    const run = w.slice(i, i + 6).join(' ');
    assert.ok(!NARRATION_6.has(fnv(run).toString(36)), `${where}: "${text}" repeats the narration: "${run}"`);
  }
}

test("no 6-word run from the video's narration", () => {
  assert.equal(NARRATION_6.size, 268);
  // The check works: a run straight from the narration is caught.
  assert.ok(NARRATION_6.has(fnv(words('surrounded by galaxies laniakea is too').join(' ')).toString(36)));
  for (const [where, s] of allText()) noRun(where, s);
  // Captions follow one another, so a run may cross from one line into the next: the opening plays in order.
  const opening = OPENING.lines.map((o) => LINE_LIST.find((l) => l.id === o.line).text).join(' ');
  noRun('the opening', opening);
});
