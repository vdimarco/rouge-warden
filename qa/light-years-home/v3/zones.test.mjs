// Light Years Home v3: every zone file and the world data around it (final.md 18.1, 7, 8, 10, 11).
// Owner: WP6. Schema and references, fact cards, density, arrivals, race gates, story legs, Look Home and the
// story clock. node qa/light-years-home/v3/zones.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkZone, checkEvent, checkMission, TIMED_TYPES } from '../../../public/light-years-home/core/world/schema.js';
import {
  ZONES, ZONE_IDS, loadZone, MISSIONS, LINES, FACTS, FACT_LIST, JUMP_LIST, OPENING, REACTIONS, ROUTE, LEGS,
  routeTotalLy, aheadLyAt, lookHomeCard, setEarthClock,
} from '../../../public/light-years-home/core/world/index.js';
import { legOf } from '../../../public/light-years-home/core/world/legs.js';
import { skyPlaneXY } from '../../../public/light-years-home/core/world/skyplane.js';
import { OBJECTS } from '../../../public/light-years-home/core/objects.js';
import { ALL_MILESTONES, MILESTONES } from '../../../public/light-years-home/core/milestones.js';
import { milestonesBetween } from '../../../public/light-years-home/core/timeline.js';
import { buildTraffic, posAt } from '../../../public/light-years-home/core/traffic.js';
import { mulberry32 } from '../../../public/light-years-home/core/rng.js';
import { TUNE } from '../../../public/light-years-home/core/tune.js';
import { createGame } from '../../../public/light-years-home/core/game.js';

const zones = await Promise.all(ZONE_IDS.map(loadZone));
const zoneOf = Object.fromEntries(zones.map((z) => [z.id, z]));
const driven = zones.filter((z) => z.kind === 'pit' || z.kind === 'full');

const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], (a[2] || 0) - (b[2] || 0));
const words = (s) => s.trim().split(/\s+/).length;

// Distance from p to the segment a-b, in the plane.
function segDist(p, a, b) {
  const ux = b[0] - a[0], uy = b[1] - a[1];
  const l2 = ux * ux + uy * uy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ux + (p[1] - a[1]) * uy) / l2));
  return Math.hypot(p[0] - a[0] - ux * t, p[1] - a[1] - uy * t);
}
const polyDist = (p, pts) => pts.slice(1).reduce((m, b, i) => Math.min(m, segDist(p, pts[i], b)), Infinity);

// ---------------------------------------------------------------- the zone's geometry, resolved once per zone

const GEO = new Map();
function geo(z) {
  if (GEO.has(z.id)) return GEO.get(z.id);
  const tr = buildTraffic(z, 1);
  const roadTable = Object.fromEntries(tr.roads.map((r) => [r.id, r]));
  const roads = Object.fromEntries((z.roads || []).map((r) => [r.id, r]));
  const bodies = Object.fromEntries((z.bodies || []).map((b) => [b.id, b]));
  const rings = Object.fromEntries((z.rings || []).map((r) => [r.id, r]));
  const actors = Object.fromEntries((z.actors || []).map((a) => [a.id, a]));
  // A road's centre line as points: the traffic's own arc-length table, or the orbit's circle.
  const lineOf = (id) => {
    const r = roads[id];
    if (r.kind === 'road') {
      const t = roadTable[id], out = [];
      for (let j = 0; j < t.n; j += 8) out.push([t.x[j], t.y[j], t.z[j]]);
      out.push([t.x[t.n - 1], t.y[t.n - 1], t.z[t.n - 1]]);
      return out;
    }
    const rad = Array.isArray(r.r) ? (r.r[0] + r.r[1]) / 2 : r.r, out = [];
    for (let k = 0; k <= 72; k++) {
      const a = (k * Math.PI) / 36;
      out.push([r.centre[0] + rad * Math.cos(a), r.centre[1] + rad * Math.sin(a), 0]);
    }
    return out;
  };
  // Sparks where render/zoneview.js and core/zone.js put them (WP2's formula in contract.md).
  const sparks = [];
  for (const s of z.sparks || []) {
    if (s.pts) { sparks.push(...s.pts); continue; }
    if (!s.road) continue;
    const r = roads[s.road], lat = s.lateral || 0;
    for (let i = 0; i < s.n; i++) {
      const f = s.from + ((s.to - s.from) * i) / Math.max(1, s.n - 1);
      if (r.kind === 'road') {
        const t = roadTable[s.road], j = Math.round(f * (t.n - 1));
        sparks.push([t.x[j] + t.rx[j] * lat, t.y[j] + t.ry[j] * lat, t.z[j]]);
      } else {
        const rad = (Array.isArray(r.r) ? (r.r[0] + r.r[1]) / 2 : r.r) + lat, a = 2 * Math.PI * f;
        sparks.push([r.centre[0] + rad * Math.cos(a), r.centre[1] + rad * Math.sin(a), 0]);
      }
    }
  }
  const swarmPts = [];
  const out = [0, 0, 0];
  for (let i = 0; i < tr.n; i++) if (posAt(tr, i, 0, out) > 0.5) swarmPts.push([out[0], out[1], out[2]]);
  const g = { tr, roads, bodies, rings, actors, lineOf, sparks, traffic: swarmPts };
  GEO.set(z.id, g);
  return g;
}

// Every scan, stunt, event and so on as a "thing" with a distance function, for density and wander checks, and the
// range at which a driver notices it: start rings, giver rings, giants and the exit gate show from RACE.SEEN; set
// items shimmer from their set's shimmerWithin; a secret's faint ring shows inside 80 u; small rings, stunt marks
// and spark lines from SMALL.
const SEEN = TUNE.RACE.SEEN, SMALL = 150, SECRET = 80;
function things(z) {
  const g = geo(z), small = [], big = [];
  const at = (p) => (q) => d2(q, p);
  const near = (pts) => (q) => Math.min(...pts.map((p) => d2(q, p)));
  const along = (pts) => (q) => polyDist(q, pts);
  const disc = (c, r) => (q) => Math.max(0, d2(q, c) - r);
  // Small: spark lines, scans with a place, stunts.
  // Each spark line is one thing (g.sparks is in the zone's sparks order).
  let k = 0;
  for (const [i, s] of (z.sparks || []).entries()) {
    const n = s.pts ? s.pts.length : s.n;
    small.push({ id: `sparks:${s.road || i}`, dist: near(g.sparks.slice(k, k + n)) });
    k += n;
  }
  for (const s of z.scans || []) {
    const t = s.target || {};
    if (t.body) small.push({ id: `scan:${s.id}`, dist: at(g.bodies[t.body].pos) });
    else if (t.at) small.push({ id: `scan:${s.id}`, dist: near(Array.isArray(t.at[0]) ? t.at : [t.at]) });
    else if (t.roads) {
      const lines = t.roads.map((r) => g.lineOf(r));
      small.push({ id: `scan:${s.id}`, dist: (q) => Math.min(...lines.map((l) => polyDist(q, l))) });
    }
    else if (t.traffic && t.traffic !== 'any') small.push({ id: `scan:${s.id}`, dist: along(g.lineOf(t.traffic)) });
    else if (t.inside) small.push({ id: `scan:${s.id}`, dist: disc(t.inside.centre, t.inside.r) });
    else if (t.set) small.push({ id: `scan:${s.id}`, dist: near(z.sets[t.set].items) });
    else if (t.actor) {
      const a = g.actors[t.actor];
      small.push({ id: `scan:${s.id}`, dist: a.path ? along(a.path) : at(a.idleAt) });
    }
  }
  for (const e of z.events || []) {
    if (TIMED_TYPES.includes(e.type)) { big.push({ id: `event:${e.id}`, dist: at(e.start.pos), notice: SEEN }); continue; }
    if (e.area) small.push({ id: `stunt:${e.id}`, dist: disc(e.area.centre, e.area.r) });
    else if (e.ring) small.push({ id: `stunt:${e.id}`, dist: at(e.ring.pos) });
    else if (e.road) small.push({ id: `stunt:${e.id}`, dist: along(g.lineOf(e.road)) });
    else if (Array.isArray(e.pads)) small.push({ id: `stunt:${e.id}`, dist: near(e.pads) });
    else if (e.body) small.push({ id: `stunt:${e.id}`, dist: at(g.bodies[e.body].pos) });
  }
  // Each set item is a find of its own (they shimmer and show on the radar from 250 u).
  for (const [id, set] of Object.entries(z.sets || {})) {
    for (const [i, p] of (set.items || []).entries()) {
      small.push({ id: `set:${id}:${i}`, dist: at(p), notice: set.shimmerWithin ?? SMALL });
    }
  }
  // Big: race starts (above), secrets, mission starts, landmarks, the exit gate.
  for (const s of z.secrets || []) {
    if (s.when.at) big.push({ id: `secret:${s.id}`, dist: at(s.when.at), notice: SECRET });
    else if (s.when.ride) big.push({ id: `secret:${s.id}`, dist: along(g.lineOf(s.when.ride)), notice: SECRET });
  }
  for (const m of MISSIONS.filter((x) => x.zone === z.id)) {
    if (m.start.ring) big.push({ id: `mission:${m.id}`, dist: at(g.rings[m.start.ring].pos), notice: SEEN });
    else if (m.start.auto?.near) big.push({ id: `mission:${m.id}`, dist: at(m.start.auto.near.pos), notice: SMALL });
  }
  for (const b of z.bodies || []) {
    if (b.label && !b.hiddenUntil) big.push({ id: `body:${b.id}`, dist: at(b.pos), notice: SEEN });
  }
  if (z.exit) big.push({ id: 'exit', dist: at(z.exit.pos), notice: SEEN });
  return { small, big };
}

// ---------------------------------------------------------------- schema and references

test('every zone passes core/world/schema.js checkZone, and the registry loads what it names', async () => {
  assert.deepEqual(ZONE_IDS, ['wall', 'coma'], 'Round 1 has the Wall and Coma City');
  for (const z of zones) assert.deepEqual(checkZone(z), [], z.id);
  for (const z of zones) assert.equal(z.id, ZONE_IDS[zones.indexOf(z)]);
  await assert.rejects(loadZone('virgo'), /no zone/);
  for (const m of MISSIONS) assert.deepEqual(checkMission(m), [], m.id);
  for (const z of zones) for (const e of z.events) assert.deepEqual(checkEvent(e), [], e.id);
});

test('cut content stays cut: no SHINY THINGS, no Downtown Eight (decisions.md 4)', () => {
  assert.ok(!MISSIONS.some((m) => m.id === 'shiny-things'));
  for (const z of zones) {
    assert.ok(!z.missions.includes('shiny-things'), z.id);
    assert.ok(!z.events.some((e) => e.id === 'downtown-eight'), z.id);
  }
  for (const m of MISSIONS) assert.ok(!JSON.stringify(m.rewards).includes('shiny-things'), m.id);
  for (const id of ['ferro.pod', 'magpie.mine', 'magpie.ow', 'red.wrongway']) assert.ok(!LINES[id], id);
});

test('every reference resolves: lines, cards, missions, rings, roads, bodies, far objects, rumours, secrets', () => {
  const line = (id, where) => assert.ok(LINES[id], `${where}: no line '${id}'`);
  const card = (id, where) => assert.ok(FACTS[id], `${where}: no card '${id}'`);
  for (const z of zones) {
    const g = geo(z);
    const scans = new Set(z.scans.map((s) => s.id));
    const events = new Set(z.events.map((e) => e.id));
    const secrets = new Set((z.secrets || []).map((s) => s.id));
    // Scans.
    for (const s of z.scans) {
      card(s.card, `${z.id} scan ${s.id}`);
      line(s.line, `${z.id} scan ${s.id}`);
      const t = s.target;
      assert.ok(t && typeof t === 'object', `${z.id} scan ${s.id}: target`);
      if (t.body) assert.ok(g.bodies[t.body], `${z.id} scan ${s.id}: body ${t.body}`);
      if (t.roads) for (const r of t.roads) assert.ok(g.roads[r], `${z.id} scan ${s.id}: road ${r}`);
      if (t.traffic && t.traffic !== 'any') assert.ok(g.roads[t.traffic] || z.swarms.some((w) => w.id === t.traffic));
      if (t.set) assert.ok(z.sets[t.set], `${z.id} scan ${s.id}: set ${t.set}`);
      if (t.actor) assert.ok(g.actors[t.actor], `${z.id} scan ${s.id}: actor ${t.actor}`);
      if (t.far) {
        const f = z.far.find((x) => x.id === t.far);
        assert.ok(f && f.scan === s.id && s.far === true, `${z.id} scan ${s.id}: far ring ${t.far}`);
      }
    }
    for (const f of z.far) {
      assert.ok(OBJECTS[f.object], `${z.id} far ${f.id}: object ${f.object}`);
      if (f.kind === 'scan') assert.ok(scans.has(f.scan), `${z.id} far ${f.id}: scan ${f.scan}`);
    }
    // Zone cards, Look Home, missions.
    card(z.zoneCard, `${z.id} zoneCard`);
    assert.equal(FACTS[z.zoneCard].kind, 'zone');
    line(z.lookHome.line, `${z.id} lookHome`);
    assert.ok(ALL_MILESTONES.some((m) => m.id === z.lookHome.card), `${z.id}: Look Home card ${z.lookHome.card}`);
    for (const id of z.missions) {
      const m = MISSIONS.find((x) => x.id === id);
      assert.ok(m && m.zone === z.id, `${z.id}: mission ${id}`);
    }
    assert.deepEqual(MISSIONS.filter((m) => m.zone === z.id).map((m) => m.id).sort(), [...z.missions].sort(), z.id);
    // Rings, stunts, events.
    for (const r of z.rings) if (r.mission) assert.ok(z.missions.includes(r.mission), `${z.id} ring ${r.id}`);
    for (const e of z.events) {
      if (e.road) assert.ok(g.roads[e.road], `${z.id} ${e.id}: road`);
      if (e.body) assert.ok(g.bodies[e.body], `${z.id} ${e.id}: body`);
      if (e.opponent?.actor) assert.ok(g.actors[e.opponent.actor], `${z.id} ${e.id}: opponent`);
      if (e.rival?.actor) assert.ok(g.actors[e.rival.actor], `${z.id} ${e.id}: rival`);
    }
    // Rumours and secrets: every rumour comes from something that exists and opens a secret here.
    for (const r of z.rumours || []) {
      for (const from of [].concat(r.from)) {
        const [kind, id] = from.split(':');
        if (kind === 'scan') assert.ok(scans.has(id), `${z.id} rumour ${r.id}: ${from}`);
        else if (kind === 'mission') assert.ok(z.missions.includes(id), `${z.id} rumour ${r.id}: ${from}`);
        else if (kind === 'win') assert.ok(events.has(id), `${z.id} rumour ${r.id}: ${from}`);
        else assert.fail(`${z.id} rumour ${r.id}: ${from}`);
      }
      assert.ok(secrets.has(r.opens), `${z.id} rumour ${r.id} opens ${r.opens}`);
      assert.ok(words(r.text) <= 25, `${z.id} rumour ${r.id}`);
    }
    for (const s of z.secrets || []) {
      card(s.reward.card, `${z.id} secret ${s.id}`);
      if (s.reward.line) line(s.reward.line, `${z.id} secret ${s.id}`);
      if (s.when.ride) assert.ok(g.roads[s.when.ride], `${z.id} secret ${s.id}: ride`);
    }
    for (const [id, set] of Object.entries(z.sets || {})) card(set.reward.card, `${z.id} set ${id}`);
    for (const b of z.bodies) if (b.hiddenUntil) {
      const [kind, id] = b.hiddenUntil.split(':');
      assert.ok(kind === 'rumour' && z.rumours.some((r) => r.id === id), `${z.id} body ${b.id}: ${b.hiddenUntil}`);
    }
    for (const a of z.actors || []) if (a.line) line(a.line, `${z.id} actor ${a.id}`);
    // The exit: its opening rule names a real beat, it leads to the next stop, and its label gives the jump's length.
    if (z.exit) {
      const [kind, mid, beat] = z.exit.opensWhen.split(':');
      const m = MISSIONS.find((x) => x.id === mid);
      assert.ok(m && m.zone === z.id, `${z.id} exit: ${z.exit.opensWhen}`);
      if (kind === 'beatDone') assert.ok(Number(beat) < m.beats.length, `${z.id} exit: beat ${beat}`);
      const leg = legOf(z.id, z.exit.to);
      assert.ok(leg, `${z.id} exit leads to the next stop`);
      const mly = Number(/([\d.]+) MLY/.exec(z.exit.label)[1]);
      assert.ok(Math.abs(mly - leg.ly / 1e6) < 1, `${z.id} exit label ${z.exit.label} vs ${(leg.ly / 1e6).toFixed(1)} Mly`);
    }
  }
  // Missions.
  for (const m of MISSIONS) {
    const z = zoneOf[m.zone];
    const g = geo(z);
    const spawned = new Set([...(m.setup || []), ...m.beats.flatMap((b) => b.setup || [])]
      .filter((s) => s.spawn).map((s) => s.spawn.id));
    const lineIds = (o) => (o == null ? [] : typeof o === 'string' ? [o] : Array.isArray(o) ? o.flatMap(lineIds)
      : Object.values(o).flatMap(lineIds));
    for (const id of lineIds(m.lines)) line(id, m.id);
    if (m.start.call?.line) line(m.start.call.line, `${m.id} start`);
    if (m.start.call?.after?.startsWith('line:')) line(m.start.call.after.slice(5), `${m.id} start`);
    if (m.start.ring) assert.ok(g.rings[m.start.ring], `${m.id}: start ring`);
    for (const r of m.rewards) {
      if (r.card) card(r.card, `${m.id} reward`);
      if (r.shout) line(r.shout, `${m.id} reward`);
      if (r.fix) assert.ok(ROUTE.some((p) => p.id === r.fix), `${m.id}: fix ${r.fix}`);
      if (r.rumour) assert.ok(z.rumours.some((x) => x.id === r.rumour), `${m.id}: rumour ${r.rumour}`);
      if (r.opens) for (const id of r.opens) assert.ok(MISSIONS.some((x) => x.id === id), `${m.id}: opens ${id}`);
    }
    for (const [i, b] of m.beats.entries()) {
      const where = `${m.id} beat ${i}`;
      for (const id of lineIds(b.lines)) line(id, where);
      const setupRings = new Set((b.setup || []).filter((s) => s.ring).map((s) => s.ring.id));
      for (const s of b.setup || []) {
        if (s.spawn?.from) assert.ok(g.roads[s.spawn.from], `${where}: spawn from ${s.spawn.from}`);
        if (s.objectiveRing) for (const o of [].concat(s.objectiveRing)) {
          if (o.startsWith('actor:')) assert.ok(spawned.has(o.slice(6)) || g.actors[o.slice(6)], `${where}: ${o}`);
          else if (o === 'exit') assert.ok(z.exit, where);
          else assert.ok(z.far.some((f) => f.id === o) || g.rings[o] || setupRings.has(o), `${where}: ${o}`);
        }
      }
      const goal = b.goal;
      const ringOk = (id) => id === 'exit' || g.rings[id] || setupRings.has(id)
        || m.beats.slice(0, i).some((x) => (x.setup || []).some((s) => s.ring?.id === id));
      if (goal.reach) assert.ok(ringOk(goal.reach.ring), `${where}: reach ${goal.reach.ring}`);
      if (goal.drop) assert.ok(ringOk(goal.drop.ring), `${where}: drop ${goal.drop.ring}`);
      for (const id of [goal.near?.actor, goal.hook?.actor, goal.away?.actor, ...(goal.takedown?.actors || [])]) {
        if (id) assert.ok(spawned.has(id) || g.actors[id], `${where}: actor ${id}`);
      }
      if (goal.away) assert.ok(g.bodies[goal.away.from], `${where}: away from`);
      if (goal.scan) for (const id of goal.scan.ids) assert.ok(z.scans.some((s) => s.id === id), `${where}: scan ${id}`);
      if (goal.all) for (const sub of goal.all) if (sub.stunt) assert.ok(z.events.some((e) => e.id === sub.stunt.id));
    }
  }
  // The opening and the reactions.
  for (const o of OPENING.lines) line(o.line, 'opening');
  for (const id of OPENING.toLog) assert.ok(LINES[id]?.log, `opening log line ${id}`);
  for (const [k, r] of Object.entries(REACTIONS)) line(r.line, `reaction ${k}`);
});

test('every card has at most 25 words, a title and a source; info-box numbers fit', () => {
  assert.ok(FACT_LIST.length >= 30);
  for (const c of FACT_LIST) {
    assert.ok(words(c.text) <= 25, `${c.id}: ${words(c.text)} words`);
    assert.match(c.source, /^https:\/\/\S+$/, `${c.id} source`);
    assert.ok(typeof c.title === 'string' && c.title.length > 0 && c.title.length <= 18, `${c.id} title`);
    assert.ok(/^[A-Z0-9'"]/.test(c.text) && /[.!?]$/.test(c.text), `${c.id}: a sentence`);
    if (c.number != null) assert.ok(c.number.length <= 32, `${c.id} number`);
  }
  for (const m of ALL_MILESTONES) assert.match(m.source, /^https:\/\/\S+$/, m.id);
  // Every card a zone, mission, secret or set names is real; so are the zone cards.
  for (const id of ['wall', 'coma', 'virgo']) assert.equal(FACTS[id]?.kind, 'zone', id);
});

// ---------------------------------------------------------------- density (world doc 1.5)

test('density: 1,000 points each have a small thing within 280 u and a big thing within 700 u', () => {
  for (const z of driven) {
    const { small, big } = things(z);
    const rng = mulberry32(7);
    const worst = { small: 0, big: 0, at: null };
    for (let k = 0; k < 1000; k++) {
      const a = rng() * 2 * Math.PI, r = z.R * Math.sqrt(rng()), q = [r * Math.cos(a), r * Math.sin(a)];
      const s = Math.min(...small.map((t) => t.dist(q))), b = Math.min(...big.map((t) => t.dist(q)));
      if (s > worst.small) { worst.small = s; worst.at = q.map(Math.round); }
      worst.big = Math.max(worst.big, b);
    }
    assert.ok(worst.small <= 280, `${z.id}: a point ${worst.small.toFixed(0)} u from any small thing at ${worst.at}`);
    assert.ok(worst.big <= 700, `${z.id}: a point ${worst.big.toFixed(0)} u from any big thing`);
    console.log(`# ${z.id}: ${small.length} small and ${big.length} big things; worst gaps ${worst.small.toFixed(0)} u`
      + ` and ${worst.big.toFixed(0)} u`);
  }
});

// A wander bot at cruise: random goals inside the rim, pure pursuit at the cruise turn rate (180° in about 2.1 s).
// It sees a thing when it first comes within the thing's notice range (things() sets it from the game's own rules;
// small rings and spark lines SMALL). A story mission that starts by itself (WHICH WAY HOME's Magpie: near Node 0
// after 54 s, or anywhere at 80 s) is a new thing when it starts. The wait after the last thing counts only while
// something is still unseen.
function wander(z, seed, seconds = 120) {
  const { small, big } = things(z);
  const list = [...small, ...big];
  for (const m of MISSIONS.filter((x) => x.zone === z.id && x.start.auto?.orAfterPlay)) {
    const a = m.start.auto;
    list.push({ id: `starts:${m.id}`, dist: (q, t) => (t >= a.orAfterPlay
      || (t >= a.afterPlay && d2(q, a.near.pos) <= a.near.within) ? 0 : Infinity) });
  }
  const rng = mulberry32(seed);
  const S = TUNE.SHIP.S_CRUISE, TURN = Math.PI / 2.1, h = 0.1;
  const pick = () => {
    const a = rng() * 2 * Math.PI, r = 0.85 * z.R * Math.sqrt(rng());
    return [r * Math.cos(a), r * Math.sin(a)];
  };
  const p = [z.entry.pos[0], z.entry.pos[1]];
  let yaw = (z.entry.heading * Math.PI) / 180, goal = pick(), goalT = 0, last = 0;
  const seen = new Set(), gaps = [];
  for (let t = 0; t <= seconds; t += h) {
    if (d2(p, goal) < 30 || t - goalT > 25) { goal = pick(); goalT = t; }
    const want = Math.atan2(goal[0] - p[0], goal[1] - p[1]);
    let dy = ((want - yaw + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
    dy = Math.max(-TURN * h, Math.min(TURN * h, dy));
    yaw += dy;
    p[0] += Math.sin(yaw) * S * h;
    p[1] += Math.cos(yaw) * S * h;
    for (let i = 0; i < list.length; i++) {
      if (seen.has(i) || list[i].dist(p, t) > (list[i].notice ?? SMALL)) continue;
      seen.add(i);
      gaps.push(t - last);
      last = t;
    }
  }
  if (seen.size < list.length) gaps.push(seconds - last);
  return { gaps, seen: seen.size, of: list.length };
}

test('density: 20 wander bots of 120 s see a new thing every 40 s on average and never wait more than 75 s', () => {
  for (const z of driven) {
    let sum = 0, n = 0, worst = 0, seenMin = Infinity;
    for (let seed = 1; seed <= 20; seed++) {
      const r = wander(z, seed);
      sum += r.gaps.reduce((a, b) => a + b, 0);
      n += r.gaps.length;
      worst = Math.max(worst, ...r.gaps);
      seenMin = Math.min(seenMin, r.seen);
    }
    const mean = sum / n;
    console.log(`# ${z.id}: mean wait ${mean.toFixed(1)} s, longest ${worst.toFixed(1)} s, fewest things seen ${seenMin}`);
    assert.ok(mean <= 40, `${z.id}: mean wait ${mean.toFixed(1)} s`);
    assert.ok(worst <= 75, `${z.id}: longest wait ${worst.toFixed(1)} s`);
  }
});

// ---------------------------------------------------------------- arrivals

// Distance covered in t seconds coasting down from v0 to cruise (handling: K_COAST above the target speed).
function coast(v0, t) {
  const { S_CRUISE: c, K_COAST: k } = TUNE.SHIP;
  return v0 > c ? c * t + ((v0 - c) / k) * (1 - Math.exp(-k * t)) : v0 * t;
}

test('a skim surface within 15 s of every arrival (coasting, or at 40 u/s along a pad line from within 100 u)', () => {
  for (const z of driven) {
    const e = z.entry;
    const gap = Math.min(...z.bodies.filter((b) => b.skim).map((b) => d3(e.pos, b.pos) - b.r));
    const padLine = z.events.some((s) => s.type === 'line' && Array.isArray(s.pads) && d3(e.pos, s.pads[0]) <= 100);
    const reach = Math.max(coast(e.speed, 15), padLine ? 40 * 15 : 0);
    const how = padLine ? ' on the pads' : '';
    console.log(`# ${z.id}: nearest skim surface ${gap.toFixed(0)} u; ${reach.toFixed(0)} u in 15 s${how}`);
    assert.ok(gap <= reach, `${z.id}: ${gap.toFixed(0)} u to a skim surface, ${reach.toFixed(0)} u in 15 s`);
  }
});

test('the Wall opens as the design says: drop-out at 38 u/s, three seeded galaxies, the Bend Giant at about 6.6 s', () => {
  const w = zoneOf.wall;
  assert.deepEqual(w.entry, { pos: [0, -400, 0], heading: 0, speed: 38, bar: 0.5 });
  const sloan = w.roads.find((r) => r.id === 'sloan');
  assert.deepEqual(sloan.seeded.map((s) => s.ahead), [45, 70, 95]);
  for (const s of sloan.seeded) assert.ok(Math.abs(s.lateral) - s.r * TUNE.COLLIDE.CORE_X > 0, 'seeded galaxies miss');
  // The S-bend is 158 u up the road; coasting from 38 u/s that is about 6 s.
  let t = 0;
  while (coast(38, t) < 158) t += 0.01;
  assert.ok(t > 5 && t < 7.5, `S-bend at ${t.toFixed(1)} s`);
  // A game made on the Wall starts there, with Earth's clock at the route's start.
  const game = createGame({ zoneData: w, mode: 'drive' });
  assert.deepEqual(game.ship.pos, [0, -400, 0]);
  assert.equal(game.ship.speed, 38);
  assert.ok(Math.abs(game.earth.aheadLy - aheadLyAt('wall')) / aheadLyAt('wall') < 1e-3);
});

test("Coma's members sit at their real sky offsets (skyplane.js, 7,000 ly a unit)", () => {
  const c = zoneOf.coma;
  for (const id of ['ngc4889', 'ngc4874']) {
    const b = c.bodies.find((x) => x.id === id);
    const xy = skyPlaneXY(OBJECTS[id].pos, OBJECTS.coma.pos, c.scaleLy);
    assert.ok(d2(xy, b.pos) < 3, `${id}: map (${b.pos}) vs sky (${xy.map((v) => v.toFixed(1))})`);
  }
});

// ---------------------------------------------------------------- race gates

function gatesOf(e) {
  const line = Array.isArray(e.line) ? e.line : null;
  return e.gates.map((g, i) => ({
    pos: g.pos || line[g.at], r: g.r ?? TUNE.RACE.GATE_R.standard, name: g.name || '',
    finish: i === e.gates.length - 1 || g.name === 'FINISH', needle: g.kind === 'needle' || g.kind === 'thread',
  }));
}

test('no gate within 55 u of the rim (finish rings exempt)', () => {
  for (const z of zones) for (const e of z.events.filter((x) => TIMED_TYPES.includes(x.type))) {
    const start = { pos: e.start.pos, finish: false };
    for (const g of [start, ...gatesOf(e)]) {
      if (g.finish) continue;
      const edge = z.R - Math.hypot(g.pos[0], g.pos[1]);
      assert.ok(edge >= TUNE.RACE.RIM_CLEAR, `${e.id}: a gate ${edge.toFixed(0)} u from the rim`);
    }
  }
});

test('every gate within 40 u of a body, a road tube or traffic', () => {
  for (const z of zones) {
    const g = geo(z);
    const near = (p) => {
      const body = Math.min(...z.bodies.map((b) => d2(p, b.pos) - b.r));
      const road = Math.min(...z.roads.map((r) => {
        if (r.kind === 'orbit') {
          const [lo, hi] = Array.isArray(r.r) ? r.r : [r.r, r.r], d = d2(p, r.centre);
          return d < lo ? lo - d : d > hi ? d - hi : 0;
        }
        const tube = typeof r.tube === 'number' ? r.tube : Math.min(...r.tube.map((x) => x[2]));
        return polyDist(p, g.lineOf(r.id)) - tube;
      }));
      const path = Math.min(...(z.actors || []).filter((a) => a.path).map((a) => polyDist(p, a.path)));
      const traffic = Math.min(...g.traffic.map((q) => d2(p, q)));
      return Math.min(body, road, path, traffic);
    };
    for (const e of z.events.filter((x) => TIMED_TYPES.includes(x.type))) {
      for (const [i, gate] of gatesOf(e).entries()) {
        const d = near(gate.pos);
        assert.ok(d <= 40, `${z.id} ${e.id} gate ${i}: ${d.toFixed(0)} u from anything`);
      }
    }
  }
});

test('gates 0.6 s apart at Tern pace except threads; the skip test under 2.0 s', () => {
  for (const z of zones) for (const e of z.events.filter((x) => TIMED_TYPES.includes(x.type))) {
    const pace = e.length / e.tern;
    const pts = [{ pos: e.start.pos, needle: false }, ...gatesOf(e)];
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].needle || pts[i - 1].needle) continue;
      const s = d2(pts[i - 1].pos, pts[i].pos) / pace;
      assert.ok(s >= TUNE.RACE.GATE_GAP, `${e.id}: gates ${i - 1} and ${i} are ${s.toFixed(2)} s apart`);
    }
    for (let i = 1; i < pts.length - 1; i++) {
      const [a, b, c] = [pts[i - 1].pos, pts[i].pos, pts[i + 1].pos];
      const save = (d2(a, b) + d2(b, c) - d2(a, c)) / pace;
      assert.ok(save < 2.0, `${e.id}: skipping gate ${i} saves ${save.toFixed(2)} s`);
    }
    // The line's length agrees with the gates (straight lines between them are never longer than the course).
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += d2(pts[i - 1].pos, pts[i].pos);
    assert.ok(len <= e.length * 1.02, `${e.id}: ${len.toFixed(0)} u through the gates, length ${e.length}`);
  }
});

// ---------------------------------------------------------------- story legs (critic 18)

// A leg runs from where the player is when a beat starts to the beat's objective, when both are fixed places. It
// must be under 250 u, or have sparks or pads within COVER u of at least half its straight line, or carry its own
// driving problem (pursuers or a runner spawned for the beat).
const COVER = 60;
test('every story leg over 250 u has sparks or pads along at least half its straight line', () => {
  let checked = 0;
  for (const m of MISSIONS.filter((x) => x.story)) {
    const z = zoneOf[m.zone], g = geo(z);
    const spawns = Object.fromEntries([...(m.setup || []), ...m.beats.flatMap((b) => b.setup || [])]
      .filter((s) => s.spawn?.pos).map((s) => [s.spawn.id, s.spawn.pos]));
    const ringPos = (id, b) => (id === 'exit' ? z.exit.pos : g.rings[id]?.pos
      || (b.setup || []).find((s) => s.ring?.id === id)?.ring.pos || null);
    const pads = z.events.filter((e) => e.type === 'line' && Array.isArray(e.pads)).flatMap((e) => e.pads);
    const marks = [...g.sparks, ...pads];
    let from = m.start.auto?.near ? m.start.auto.near.pos : z.entry.pos;
    for (const [i, b] of m.beats.entries()) {
      const goal = b.goal;
      const to = goal.reach ? ringPos(goal.reach.ring, b) : goal.drop ? ringPos(goal.drop.ring, b)
        : goal.near ? spawns[goal.near.actor] : null;
      const problem = (b.setup || []).some((s) => s.spawn && ['pursuer', 'runner', 'racer'].includes(s.spawn.kind));
      if (from && to && !problem) {
        const L = d2(from, to);
        if (L > 250) {
          let covered = 0, n = 0;
          for (let s = 0; s <= L; s += 5, n++) {
            const q = [from[0] + ((to[0] - from[0]) * s) / L, from[1] + ((to[1] - from[1]) * s) / L];
            if (marks.some((p) => d2(p, q) <= COVER)) covered++;
          }
          const share = covered / n;
          console.log(`# ${m.id} beat ${i}: ${L.toFixed(0)} u, ${(share * 100).toFixed(0)}% along sparks or pads`);
          assert.ok(share >= 0.5, `${m.id} beat ${i}: a ${L.toFixed(0)} u leg with ${(share * 100).toFixed(0)}% covered`);
          checked++;
        }
      }
      from = to;
    }
  }
  assert.ok(checked >= 1, 'at least one long leg was checked');
});

// ---------------------------------------------------------------- Earth's clock and Look Home

test("the story clock: Earth's date at each arrival (11.4) and the route's length", () => {
  assert.ok(Math.abs(routeTotalLy - 1.067e9) / 1.067e9 < 1e-3, `route ${routeTotalLy.toExponential(4)}`);
  const game = createGame();
  assert.ok(Math.abs(game.earth.aheadLy - routeTotalLy) / routeTotalLy < 1e-3, 'game.earth.aheadLy starts at the route');
  const want = { wall: 1.07e9, coma: 3.30e8, virgo: 5.78e7, 'andromeda-edge': 2.5e6 };
  for (const [id, ly] of Object.entries(want)) {
    assert.ok(Math.abs(aheadLyAt(id) - ly) / ly < 0.01, `${id}: ${aheadLyAt(id).toExponential(3)} ly ahead`);
  }
  assert.equal(aheadLyAt('earth'), 0);
  // The enter slot's clock: a game started straight in Coma reads Coma's date; a pocket keeps its zone's.
  const g2 = createGame({ zoneData: zoneOf.coma, mode: 'drive' });
  setEarthClock(g2, zoneOf.coma);
  assert.equal(g2.earth.aheadLy, aheadLyAt('coma'));
  setEarthClock(g2, { id: 'virgo-jet', kind: 'pocket' });
  assert.equal(g2.earth.aheadLy, aheadLyAt('coma'));
  assert.equal(aheadLyAt('nowhere'), null);
  let sum = 0;
  for (const l of LEGS) { assert.ok(l.ly > 0, `${l.from} → ${l.to}`); sum += l.ly; }
  assert.ok(Math.abs(sum - routeTotalLy) < 1);
});

test('Look Home gives the expected card for the story clock', () => {
  const want = { wall: 'oxygen', coma: 'snowball', virgo: 'flowers' };
  for (const [id, cardId] of Object.entries(want)) assert.equal(lookHomeCard(id)?.id, cardId, id);
  for (const z of zones) assert.equal(lookHomeCard(z.id)?.id, z.lookHome.card, `${z.id} lookHome.card`);
  // The oxygen card is older than the trip, so no jump ever shows it as an On Earth card.
  assert.ok(!MILESTONES.some((m) => m.id === 'oxygen'));
});

// ---------------------------------------------------------------- jumps

test('jumps: J1 to J3 follow the route, keep their set pieces inside the run, and name real lines', () => {
  assert.deepEqual(JUMP_LIST.map((j) => [j.id, j.from, j.to]),
    [['J1', 'wall', 'coma'], ['J2', 'coma', 'virgo'], ['J3', 'virgo', 'andromeda-edge']]);
  assert.deepEqual(JUMP_LIST.map((j) => j.L), [18, 26, 25]);
  for (const j of JUMP_LIST) {
    assert.ok(Math.abs(j.ly - legOf(j.from, j.to).ly) < 1, j.id);
    assert.equal(j.earth.aheadFrom, aheadLyAt(j.from));
    assert.equal(j.earth.aheadTo, aheadLyAt(j.to));
    for (const p of j.pieces) {
      const end = p.at * j.L + (p.s || 0);
      assert.ok(end <= j.L - 5 + 1e-9, `${j.id} ${p.label} ends at ${end.toFixed(1)} s, run ends ${j.L - 5}`);
      assert.ok(p.label.length <= 26, `${j.id} ${p.label}`);
    }
    if (j.fork) assert.ok(j.fork.at * j.L <= j.L - 5, `${j.id} fork`);
    const lines = j.lines;
    for (const id of [lines.punch, lines.early, lines.vista, ...Object.values(lines.cards || {}),
      ...Object.values(lines.after || {})].filter(Boolean)) assert.ok(LINES[id], `${j.id}: line ${id}`);
    // Each card-keyed line names a card this jump really passes.
    const passed = milestonesBetween(j.earth.aheadFrom, j.earth.aheadTo).map((m) => m.id);
    for (const id of [...Object.keys(lines.cards || {}), ...Object.keys(lines.after || {})]) {
      assert.ok(passed.includes(id), `${j.id}: ${id} is not passed (${passed.join(', ')})`);
    }
  }
  const j1 = milestonesBetween(JUMP_LIST[0].earth.aheadFrom, JUMP_LIST[0].earth.aheadTo).map((m) => m.id);
  assert.deepEqual(j1, ['seaweed', 'snowball', 'cambrian', 'land-plants', 'tetrapods']);
});
