// Light Years Home: route checks. The landmark order, the leg and route lengths from real positions, the zones of every
// flight (lengths add up, screen time per leg, densities match the gas model inside the Milky Way, cluster gas lies
// inside the cluster), the seeded draws (exactly one candidate fits every clue), sources, and that no game text
// shares a 6-word run with the source video's narration.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { OBJECTS, KINDS, LAYERS, distanceLy, AU_LY } from '../../public/light-years-home/core/objects.js';
import {
  CHAPTERS, STOPS, SCANS, INTRO, DENSITY, legLengthLy, routeLengthLy, straightLineLy, zonesFor, legPoints, legScreenTime,
  resolve, candidate,
} from '../../public/light-years-home/core/route.js';
import { checkZones, pointAlong } from '../../public/light-years-home/core/gas.js';

const CORE = new URL('../../public/light-years-home/core/', import.meta.url);
const ORDER = ['coma', 'virgo', 'fornax', 'andromeda', 'milky-way', 'carina', 'orions-belt', 'orion-nebula', 'betelgeuse',
  'pleiades', 'aldebaran', 'sirius', 'alpha-centauri', 'sun', 'earth'];
const ROUTE_LY = 1215266893;
const STRAIGHT_LY = 999996220;
const ZONE_KINDS = ['void', 'filament', 'cluster', 'waypoint', 'halo', 'disc', 'arm', 'interarm', 'bubble', 'cloud',
  'nebula', 'belt', 'wind', 'arrive'];
const MILKY_WAY_FIRST = ORDER.indexOf('carina');   // legs 6 to 15 fly inside the Milky Way
const branchesOf = (stop) => (stop.branches ? ['sheet', 'void'] : ['sheet']);
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);

test('the stops run in the video order, in four chapters', () => {
  assert.deepEqual(STOPS.map((s) => s.id), ORDER);
  assert.deepEqual(CHAPTERS.flatMap((c) => c.stops), ORDER);
  STOPS.forEach((s) => assert.equal(CHAPTERS[s.chapter].stops.includes(s.id), true, s.id));
  assert.deepEqual(CHAPTERS.map((c) => STOPS.findIndex((s) => s.id === c.stops[0])), [0, 3, 6, 10]);
});

test('chapter starts agree with save.js', async () => {
  if (!fs.existsSync(new URL('save.js', CORE))) return;
  const save = await import(new URL('save.js', CORE));
  if (!save.CHAPTER_STARTS) return;
  assert.deepEqual(save.CHAPTER_STARTS, CHAPTERS.map((c) => STOPS.findIndex((s) => s.id === c.stops[0])));
});

test('spots: Triangulum after Andromeda, Antares after the Pleiades; one fork, on the Andromeda stop', () => {
  const order = SCANS.map((s) => `${s.mode}:${s.id}`);
  assert.equal(order.indexOf('spot:triangulum'), order.indexOf('stop:andromeda') + 1);
  assert.equal(order.indexOf('spot:antares'), order.indexOf('stop:pleiades') + 1);
  assert.deepEqual(SCANS.filter((s) => s.mode === 'spot').map((s) => s.id), ['triangulum', 'antares']);
  assert.deepEqual(STOPS.filter((s) => s.branches).map((s) => s.id), ['andromeda']);
  const a = STOPS.find((s) => s.id === 'andromeda');
  assert.ok(a.fork && a.fork.prompt && a.fork.sheet.label && a.fork.void.label);
});

test('route length from positions: 1,215,266,893 ly ± 0.1 %; straight line 999,996,220 ly', () => {
  const total = routeLengthLy();
  assert.ok(rel(total, ROUTE_LY) < 1e-3, `route ${total}`);
  assert.ok(rel(straightLineLy(), STRAIGHT_LY) < 1e-3, `straight ${straightLineLy()}`);
  const extra = (total / straightLineLy() - 1) * 100;
  assert.ok(Math.abs(extra - 21.5) < 0.1, `detour ${extra.toFixed(2)} %`);
});

test('each leg length matches the design table within 2 %', () => {
  const table = [737321302, 271909334, 141648564, 61874788, 2445098, 57763, 8430, 94, 748, 315, 383, 61, 9.5, 4.3,
    40 * AU_LY];
  STOPS.forEach((s, i) => assert.ok(rel(legLengthLy(i), table[i]) < 0.02, `${s.id}: ${legLengthLy(i)} vs ${table[i]}`));
});

test('every zone is well formed; each leg has one fill zone and ends with an arrival at its target', () => {
  STOPS.forEach((stop, i) => {
    for (const br of branchesOf(stop)) {
      const raw = stop.branches ? stop.branches[br] : stop.zones;
      assert.equal(raw.filter((z) => z.ly === 'fill').length, 1, `${stop.id} ${br}: one fill zone`);
      raw.forEach((z) => {
        assert.ok(ZONE_KINDS.includes(z.kind), `${stop.id}: kind ${z.kind}`);
        assert.ok(Number.isFinite(z.n) && z.n > 0, `${stop.id} ${z.label}: n`);
        assert.ok(z.screen > 0 && typeof z.label === 'string' && z.label.length > 0, `${stop.id} ${z.label}`);
        assert.match(z.src, /^https:\/\//, `${stop.id} ${z.label}: density source`);
        if (z.at) assert.ok(OBJECTS[z.at], `${stop.id}: zone at ${z.at}`);
      });
      const last = raw[raw.length - 1];
      assert.equal(last.kind, 'arrive', `${stop.id} ends with a drop-out`);
      assert.equal(last.at, stop.to, `${stop.id}: arrives at ${stop.to}`);
      assert.equal(raw.filter((z) => z.kind === 'arrive').length, 1);
    }
  });
});

test('Σ zone ly equals the leg length, with no empty zone', () => {
  STOPS.forEach((stop, i) => {
    for (const br of branchesOf(stop)) {
      const zones = zonesFor(i, br);
      const sum = zones.reduce((s, z) => s + z.ly, 0);
      assert.ok(rel(sum, legLengthLy(i, br)) < 1e-12, `${stop.id} ${br}: ${sum} vs ${legLengthLy(i, br)}`);
      zones.forEach((z, k) => {
        assert.ok(z.ly > 0, `${stop.id} ${br} zone ${k} ${z.label}: ${z.ly}`);
        assert.equal(z.startLy, k ? zones[k - 1].endLy : 0);
      });
    }
  });
});

test('zonesFor returns copies', () => {
  const a = zonesFor(0);
  a[0].ly = -1;
  a[0].label = 'changed';
  assert.notEqual(zonesFor(0)[0].ly, -1);
  assert.equal(STOPS[0].zones[0].label, 'Sloan Great Wall');
});

test('each leg takes 7 to 15 s of screen time at the notch', () => {
  STOPS.forEach((stop, i) => {
    for (const br of branchesOf(stop)) {
      const t = legScreenTime(i, br);
      assert.ok(t >= 7 - 1e-9 && t <= 15 + 1e-9, `${stop.id} ${br}: ${t} s`);
    }
  });
});

test('both fork branches have the same length and reach Andromeda', () => {
  const i = ORDER.indexOf('andromeda');
  assert.equal(legLengthLy(i, 'sheet'), legLengthLy(i, 'void'));
  const sheet = zonesFor(i, 'sheet'), empty = zonesFor(i, 'void');
  assert.equal(sheet.at(-1).endLy, empty.at(-1).endLy);
  assert.ok(sheet.filter((z) => z.kind === 'waypoint').length >= 3, 'the sheet branch threads galaxies');
  assert.equal(empty.filter((z) => z.kind === 'waypoint').length, 0, 'the void branch has none');
  assert.ok(empty.some((z) => z.info), 'the void branch has its info box');
});

test('every Milky Way zone is within × 3 of the gas model', () => {
  for (let i = MILKY_WAY_FIRST; i < STOPS.length; i++) {
    for (const c of checkZones(legPoints(i), zonesFor(i))) {
      const why = `n ${c.n} vs model ${c.model.toPrecision(3)} (× ${c.ratio.toFixed(2)})`;
      assert.ok(c.ok, `${STOPS[i].id} zone ${c.index} ${c.label}: ${why}`);
    }
  }
});

test('cluster gas zones lie within the cluster radius of the path', () => {
  let count = 0;
  STOPS.forEach((stop, i) => {
    for (const br of branchesOf(stop)) {
      const pts = legPoints(i, br);
      for (const z of zonesFor(i, br)) {
        const o = z.at && OBJECTS[z.at];
        if (!o || o.kind !== 'cluster' || (z.kind !== 'cluster' && z.kind !== 'arrive')) continue;
        count++;
        for (let k = 0; k <= 8; k++) {
          const p = pointAlong(pts, z.startLy + ((z.endLy - z.startLy) * k) / 8);
          assert.ok(distanceLy(p, o.pos) <= o.radiusLy, `${stop.id} ${z.label} at ${k}/8: ${distanceLy(p, o.pos)} ly`);
        }
      }
    }
  });
  assert.ok(count >= 10, `checked ${count} cluster zones`);
});

test('every referenced object exists and has a source; passes and coaching are well formed', () => {
  for (const [id, o] of Object.entries(OBJECTS)) {
    assert.match(o.source, /^https:\/\/\S+$/, `${id} source`);
    assert.ok(typeof o.name === 'string' && o.name.length, `${id} name`);
    assert.ok(KINDS.includes(o.kind), `${id} kind ${o.kind}`);
    assert.ok(LAYERS.includes(o.layer), `${id} layer ${o.layer}`);
    assert.ok(o.pos.length === 3 && o.pos.every(Number.isFinite), `${id} pos`);
    if (o.kind === 'star' || o.kind === 'pair') assert.ok(o.T > 1000 && o.radiusSun > 0, `${id} T and radius`);
  }
  for (const stop of STOPS) {
    for (const id of [stop.from, stop.to, ...stop.via]) assert.ok(OBJECTS[id], `${stop.id}: ${id}`);
    for (const p of stop.passes) {
      assert.ok(OBJECTS[p.id], `${stop.id} pass ${p.id}`);
      assert.ok(p.p >= 0 && p.p <= 1);
    }
    for (const c of [...stop.coach, ...stop.lines]) {
      assert.ok(typeof c.text === 'string' && c.text.length);
      assert.ok(c.at === 'flight' || c.at === 'notch' || c.at === 'radio' || Number.isInteger(c.atZone), c.text);
      if (Number.isInteger(c.atZone)) assert.ok(c.atZone < zonesFor(STOPS.indexOf(stop)).length);
    }
  }
  for (const d of Object.values(DENSITY)) assert.match(d.src, /^https:\/\//);
});

test('every candidate is a real object with three facts; decoys say why not', () => {
  for (const { id, entry } of SCANS) {
    assert.ok(entry.clue && entry.reveal, id);
    assert.ok(entry.scan.fovMin > 0 && entry.scan.fovMax > entry.scan.fovMin && entry.scan.fovMax <= 100, `${id} fov`);
    assert.ok(OBJECTS[entry.target.id], `${id} target`);
    assert.equal(entry.target.facts.length, 3, `${id} target facts`);
    assert.ok(entry.decoys.length === 2 || entry.decoys.length === 3, `${id} decoys`);
    assert.equal(entry.decoys.filter((d) => d.trap).length, 1, `${id}: one trap`);
    for (const d of entry.decoys) {
      assert.ok(OBJECTS[d.id], `${id} decoy ${d.id}`);
      assert.equal(d.facts.length, 3, `${id} ${d.id} facts`);
      assert.match(d.whyNot, /^That's /, `${id} ${d.id} whyNot`);
      assert.ok(d.has.filter((t) => entry.needs.includes(t)).length <= entry.needs.length - 1, `${id} ${d.id} tags`);
    }
    assert.ok(entry.needs.every((t) => entry.target.has.includes(t)), `${id} target has every needed tag`);
  }
});

test('every draw: three letters, the trap always in, and exactly one candidate fits the clue', () => {
  for (let seed = 0; seed < 400; seed++) {
    const draw = resolve(seed);
    for (const { id, entry } of SCANS) {
      const d = draw[id];
      assert.ok(d, `${seed} ${id}`);
      const ids = [d.A, d.B, d.C];
      assert.equal(new Set(ids).size, 3);
      assert.ok(ids.includes(entry.target.id));
      assert.ok(ids.includes(entry.decoys.find((x) => x.trap).id), `${seed} ${id}: trap drawn`);
      const fits = ids.filter((cid) => entry.needs.every((t) => candidate(entry, cid).has.includes(t)));
      assert.deepEqual(fits, [entry.target.id], `${seed} ${id}`);
    }
  }
});

test('draws are seeded: same seed, same draw; the answer moves between letters', () => {
  assert.deepEqual(resolve(7), resolve(7));
  assert.notDeepEqual(resolve(7), resolve(8));
  const where = { A: 0, B: 0, C: 0 };
  for (let seed = 1; seed <= 300; seed++) {
    const d = resolve(seed).coma;
    for (const k of ['A', 'B', 'C']) if (d[k] === 'coma') where[k]++;
  }
  for (const k of ['A', 'B', 'C']) assert.ok(where[k] > 60, `coma at ${k}: ${where[k]}`);
  const thirds = new Set();
  for (let seed = 1; seed <= 200; seed++) thirds.add(resolve(seed)['alpha-centauri'].A);
  assert.ok(thirds.size === 4, 'the third decoy varies with the seed');
});

// ---------- writing ----------

const SPELL = { centre: 'center', grey: 'gray', neighbour: 'neighbor', neighbours: 'neighbors', colour: 'color',
  metres: 'meters' };
const words = (t) => t.toLowerCase().replace(/[’']/g, '').replace(/(\d),(\d)/g, '$1$2').split(/[^a-z0-9]+/).filter(Boolean)
  .map((w) => SPELL[w] || w);
const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
};

// FNV-1a hashes (base 36) of every 6-word run of the narration in the source video (scratchpad video-notes.md), after
// the same normalising as words() above. Hashes, so the narration itself is not copied into the repo.
const NARRATION_6 = new Set(['j1dzf9', '1od7jbv', '16dsr44', '14lld0g', '1xqqm0y', '1mb4mhu', '16kzy2y', 'wgfb7w', '18x8uam',
  'dfm9d3', '1fqtye0', '1xt95qn', '5sxpxr', 'xxyevy', '1ifz19z', 'vjjln7', '83wczl', '1i3i2ub', '165x1v', '16m8m5i',
  '1ruka7d', 'ug5u6w', 'optiw4', '1v677qh', '10qjvro', 'q6ugek', '1fxhhtj', 'ih4q7i', '10chtx9', '1qados9', 'w81xsa',
  '1py8xbt', 'osc8l7', '155t2ro', '1q5u1kz', '1growes', '4toh2k', '16ux8mw', '37v8a2', '1l4e2h3', '1bez6b0', 'wf3n3j',
  '1e84krb', 'ml1j2n', '1mpdkyb', '135sbaq', '1m90rjd', 'fxdiga', 'rc99yz', 'yr5u2c', '1xdzgev', '1xsnaei', 'tdn7rz',
  '12ts2c1', 'ja5x7x', '1chkp9o', 'k2drn', 'jnyzyu', '1litcma', '99g7b8', 'f7ewyq', 'xlft85', '19wqwmd', 'z6m4ve',
  '1hdoz73', '33b5h9', '1e6tske', '1rbwp4d', '75o3mj', '177609y', 'zlullr', 'n9z3ja', '1rd08wp', 'avb5q8', '11jmjvj',
  '8n54pd', '13vxznq', '1uktsm0', 'cv293k', '1bojjtn', '4d9drv', '1lwfilu', 'c6fdzt', 'ce4jto', '14cjr36', '1aa3v2z',
  '1lew5hk', '5go8qi', 'wlu6c7', '16x0zak', '7blgbx', '1ayyxyj', 'hp8q6h', 'nkrtmi', '1eppoce', 'i5wh9i', 'qnrtyt',
  '1lfx9p3', '14dvdcj', 'rp5rj3', '171821y', '1h0rgd9', 'jxlhsz', 'y254m7', 'wbzhrf', 'va6h3p', '181ac1z', 'imvggf',
  '10j1n6b', 'hyw9an', 'pejw7p', '6xmnr9', '1ekjkb5', 'gfhmd5', '10wba8k', '1kef4n2', '1wojd07', '1id0an4', '10ti23r',
  '15m7k7j', 'oukiti', 'lkwkf0', '11z2atm', '1xbzyll', '16tqe6r', '1xsklb8', '1l3kzbw', '1oxbe5a', '156vnjy', 'hryod9',
  'hf2afi', 'sd2sus', 'hcyvb6', 'bs0t79', '1usff0j', 'pt6rlg', '1qze4i8', '1lvqbpl', '1in4qsp', 'fef2px', 'pr9vjt',
  'op6a1l', '15g2sge', '1qqkseu', 'p388q2', '1c78k80', '9inu65', '1skgaqv', '1ngpjiz', 'lqmjx3', 'fj5efs', '1c7i1df',
  '18fyiur', '8ajnef', 'wzak2m', '10ww1br', '3ohmzx', '1786sp1', '1nkf55n', '2gaq7d', '1dnr5s', '1v3tdjy', '1i1dwx1',
  '295zbi', '17vojxc', '97yq53', '2if4o6', '1ljdxtt', '1x71df4', '19vh97j', '1tupyj3', '1ey7ne', '78269b', 'qb6clc',
  'lepcwl', '10r8iz3', '1jyagyj', '152h2qu', '60hv2q', 'hnmwr0', '1clv1tp', '1xkb1cm', '1odxn00', '1nj0s5j', 'ibcu88',
  '1d8igqt', '14t64bz', '1ikqy7b', '8w4ypp', 'ofcgoy', '1dszqra', '1t8bodl', 't4zyu1', '1vycf6m', '15ovo62', '19qe563',
  '182753f', '1keawab', '1xy54mu', '103697n', '14v6c5b', 'n3dr0m', '1u0l1rn', '10h5dx5', '1ttr606', '7f9cj2', '1tge6zf',
  '1wruiem', 'ri214', 'jzfdr3', '18m9z75', 'sawixz', 'wvwl92', 'igm1sy', '1110uid', '1muiskk', 'qjvnad', 'n87hkg',
  '5gzzet', '1mndrr6', 'a4gr8r', '1osytrv', 'z9sy6c', 'fs4edf', '1u26i3x', '1746um', '1ehthjq', 'q9nbmk', 'ywvjhv',
  '11jyies', '1ufbxq0', '6kchrq', '14joqcy', 'tor83q', '5x3llf', 'tygrdq', '1fea4s7', '126jky8', 'ysh306', '8dvep4',
  'o7ny5n', '1veaxz4', '1sgtqcz', '11mgs1v', '1amgqkv', 'gmafbl', '12o9jdr', '78c4ak', 'tmopw0', '1thyovz', '1ljpikc',
  '192jy5z', 'fiwjtk', 'rd4ing', '1fncj0r', '32m5ks', 'ybg68t', '14w69va', '11s7jer', '18l80jd', '1fjlrts', '1wqvo9l',
  '1fvljtc', '1nvnhl4', '1umacwq', 'bvumgo', 'fezhw0', '18yvaf0']);

const SKIP_KEYS = new Set(['id', 'source', 'src', 'kind', 'layer', 'at', 'from', 'to', 'via', 'has', 'needs', 'members',
  'group', 'parent', 'glow', 'color', 'ring', 'overlay', 'shape']);

function gameText(value, out = [], key = '') {
  if (typeof value === 'string') {
    if (!SKIP_KEYS.has(key) && !/^https?:/.test(value)) out.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((v) => gameText(v, out, key));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) gameText(v, out, k);
  }
  return out;
}

async function allText() {
  const texts = gameText([STOPS, CHAPTERS, INTRO, DENSITY, OBJECTS]);
  if (fs.existsSync(new URL('milestones.js', CORE))) {
    const m = await import(new URL('milestones.js', CORE));
    gameText(m.MILESTONES, texts);
  }
  return texts;
}

test('no text shares a 6-word run with the video narration', async () => {
  const texts = await allText();
  assert.ok(texts.length > 300, `scanned ${texts.length} strings`);
  for (const t of texts) {
    const w = words(t);
    for (let i = 0; i + 6 <= w.length; i++) {
      const run = w.slice(i, i + 6).join(' ');
      assert.ok(!NARRATION_6.has(fnv(run).toString(36)), `"${t}" repeats the narration: "${run}"`);
    }
  }
});

// Captions play one after another, so a run can also cross from one line into the next (the Triangulum reveal into
// the Milky Way clue once did). Check the lines in the order a journey plays them, and each why-not line between the
// clue before it and the flight lines after it.
test('no 6-word run from the narration, across lines in play order', () => {
  const script = INTRO.map((l) => l.text);
  const pairs = [];
  STOPS.forEach((s) => {
    const flight = [...s.coach, ...s.lines].map((c) => c.text);
    script.push(s.clue);
    for (const d of s.decoys) pairs.push([s.clue, d.whyNot, ...(s.fork ? [s.fork.prompt] : flight)].join(' '));
    if (s.fork) script.push(s.fork.prompt);
    script.push(...flight, s.reveal);
    if (s.spot) {
      script.push(s.spot.clue);
      for (const d of s.spot.decoys) pairs.push([s.spot.clue, d.whyNot, s.spot.reveal].join(' '));
      script.push(s.spot.reveal);
    }
    const ending = CHAPTERS.find((c) => c.stops[c.stops.length - 1] === s.id);
    if (ending && ending.end) script.push(ending.end);
  });
  assert.ok(script.length >= 45 && pairs.length >= 30, `${script.length} lines, ${pairs.length} why-not runs`);
  for (const t of [script.join(' '), ...pairs]) {
    const w = words(t);
    for (let i = 0; i + 6 <= w.length; i++) {
      const run = w.slice(i, i + 6).join(' ');
      assert.ok(!NARRATION_6.has(fnv(run).toString(36)), `lines in play order repeat the narration: "${run}"`);
    }
  }
});

test('the 6-word check catches a copied line', () => {
  const copied = 'Ahead is the Carina Nebula, a huge star-forming region.';
  const w = words(copied);
  let hit = false;
  for (let i = 0; i + 6 <= w.length; i++) if (NARRATION_6.has(fnv(w.slice(i, i + 6).join(' ')).toString(36))) hit = true;
  assert.ok(hit);
});

test('player-facing lines are plain: no em dashes, numbers as digits', () => {
  const lines = [];
  for (const { entry } of SCANS) {
    lines.push(entry.clue, entry.reveal, ...entry.target.facts);
    for (const d of entry.decoys) lines.push(d.whyNot, ...d.facts);
  }
  for (const s of STOPS) lines.push(...s.coach.map((c) => c.text), ...s.lines.map((c) => c.text));
  lines.push(...INTRO.map((l) => l.text), ...CHAPTERS.map((c) => c.end || ''));
  for (const t of lines) {
    assert.ok(!t.includes('—'), `em dash: ${t}`);
    assert.ok(!/\b(one|two|three|four|five|six|seven|eight|nine|ten) (thousand|hundred|million|billion)\b/i.test(t), t);
  }
});

test('every milestone has a source URL', async () => {
  if (!fs.existsSync(new URL('milestones.js', CORE))) return;
  const { MILESTONES } = await import(new URL('milestones.js', CORE));
  assert.ok(MILESTONES.length > 0);
  for (const m of MILESTONES) assert.match(m.source, /^https:\/\/\S+$/, m.id);
});
