// Light Years Home v3: checks for the world data (final.md 7.1, 8.1, 9.2, 9.3, 12). Each check returns a list of
// plain error strings, empty when the data is good. Tests run them on every zone, event, mission and line, and
// ?debug shows them on screen. Unknown keys are errors, so a typo cannot hide.

export const ZONE_KINDS = Object.freeze(['pit', 'full', 'pocket', 'stub']);
export const ACTOR_KINDS = Object.freeze(['towable', 'pursuer', 'runner', 'racer', 'faller', 'blob']);
export const TIMED_TYPES = Object.freeze(['sprint', 'circuit', 'showcase', 'rival']);
export const STUNT_TYPES = Object.freeze(['drift', 'trap', 'oncoming', 'line', 'skim', 'sling', 'thread']);
export const GOALS = Object.freeze(['reach', 'near', 'hook', 'away', 'drop', 'scan', 'takedown', 'catch', 'stunt',
  'all']);
export const FAILS = Object.freeze(['timeLimit', 'contacts', 'actorLost', 'gapOver', 'reaches', 'leftZone']);
export const SETUPS = Object.freeze(['spawn', 'cargo', 'ring', 'wellsOff', 'objectiveRing', 'guide']);
export const SPEAKERS = Object.freeze(['DOT', 'KIT', 'FERRO', 'VELA', 'REDSHIFT', 'MAGPIE', 'KEEPER']);
export const LIMITS = Object.freeze({ title: 18, objective: 26, toast: 26, lineChars: 44, lineWords: [2, 8] });

const ZONE_KEYS = ['id', 'name', 'chapter', 'kind', 'parent', 'object', 'R', 'slab', 'band', 'scaleLy', 'scaleCard',
  'plane', 'key', 'entry', 'exit', 'exitRing', 'pocket', 'bodies', 'roads', 'swarms', 'actors', 'rings', 'sparks',
  'far', 'sets', 'rumours', 'secrets', 'lookHome', 'zoneCard', 'missions', 'backdrop', 'art', 'events', 'scans',
  'jet', 'knots', 'blobs', 'onArrive'];
const TIMED_KEYS = ['id', 'type', 'title', 'zone', 'start', 'runup', 'line', 'closed', 'laps', 'gates', 'opponent',
  'rival', 'ghostRival', 'wellsOff', 'length', 'tern', 'gold', 'silver', 'bronze', 'note', 'moment'];
const STUNT_KEYS = ['id', 'type', 'title', 'zone', 'area', 'ring', 'road', 'body', 'pads', 'window', 'exitSpeed',
  'minTurn', 'stars', 'note'];
const MISSION_KEYS = ['id', 'title', 'zone', 'story', 'kind', 'giver', 'start', 'setup', 'beats', 'fails', 'medals',
  'rewards', 'lines'];
const BEAT_KEYS = ['objective', 'counter', 'checkpoint', 'zone', 'setup', 'goal', 'fails', 'lines', 'onDone'];
const LINE_KEYS = ['id', 'speaker', 'text', 'pri', 'log'];

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const isStr = (x) => typeof x === 'string' && x.length > 0;
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const isId = (x) => typeof x === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(x);
const isV2 = (p) => Array.isArray(p) && p.length === 2 && p.every(isNum);
const isV3 = (p) => Array.isArray(p) && p.length === 3 && p.every(isNum);
const isPair = (p) => Array.isArray(p) && p.length === 2 && p.every(isNum) && p[0] <= p[1];
const numOrPair = (x) => isNum(x) || isPair(x);

function unknownKeys(obj, known, where, errs) {
  for (const key of Object.keys(obj)) if (!known.includes(key)) errs.push(`${where}: unknown key '${key}'`);
}

function uniqueIds(list, where, errs) {
  const seen = new Set();
  for (const item of list) {
    if (!isObj(item)) continue;
    if (seen.has(item.id)) errs.push(`${where}: id '${item.id}' used twice`);
    seen.add(item.id);
  }
}

function need(cond, msg, errs) { if (!cond) errs.push(msg); }

// ---------------------------------------------------------------- zones

function checkPlane(p, where, errs) {
  if (!isObj(p)) { errs.push(`${where}: needs an object`); return; }
  if (p.kind === 'aim') {
    need(Array.isArray(p.contains) && p.contains.length === 2 && p.contains.every(isStr),
      `${where}.contains: needs two object ids`, errs);
    need(isObj(p.align) && isStr(p.align.id) && isV2(p.align.toward), `${where}.align: needs { id, toward: [x, y] }`,
      errs);
  } else if (p.kind !== 'sky' && p.kind !== 'fixed') {
    errs.push(`${where}.kind: aim, sky or fixed`);
  }
}

function checkRoad(road, i, errs) {
  const where = `roads[${i}]`;
  if (!isObj(road)) { errs.push(`${where}: needs an object`); return; }
  need(isId(road.id), `${where}.id: needs an id`, errs);
  need(Number.isInteger(road.count) && road.count >= 0, `${where}.count: needs a whole number`, errs);
  if (road.kind === 'road') {
    need(Array.isArray(road.pts) && road.pts.length >= 2 && road.pts.every(isV3), `${where}.pts: needs 2+ [x, y, z]`,
      errs);
    need(road.flow === 1 || road.flow === -1, `${where}.flow: +1 or -1`, errs);
    need(isNum(road.speed), `${where}.speed: needs a number`, errs);
    const tubeOk = isNum(road.tube) || (Array.isArray(road.tube) && road.tube.length > 0
      && road.tube.every((t) => Array.isArray(t) && t.length === 3 && t.every(isNum) && t[0] < t[1]));
    need(tubeOk, `${where}.tube: a width, or [[from, to, r], ...]`, errs);
  } else if (road.kind === 'orbit') {
    need(isV2(road.centre), `${where}.centre: needs [x, y]`, errs);
    need(numOrPair(road.r), `${where}.r: a radius or [min, max]`, errs);
    need(road.dir === 1 || road.dir === -1, `${where}.dir: +1 or -1`, errs);
    need(numOrPair(road.speed), `${where}.speed: a number or [min, max]`, errs);
  } else {
    errs.push(`${where}.kind: road or orbit`);
  }
  if (road.size !== undefined) need(isPair(road.size), `${where}.size: needs [min, max]`, errs);
}

function checkBody(b, i, errs) {
  const where = `bodies[${i}]`;
  if (!isObj(b)) { errs.push(`${where}: needs an object`); return; }
  need(isId(b.id), `${where}.id: needs an id`, errs);
  need(isV3(b.pos), `${where}.pos: needs [x, y, z]`, errs);
  need(isNum(b.r) && b.r > 0, `${where}.r: needs a radius`, errs);
  need(isNum(b.rc) && b.rc >= 0, `${where}.rc: needs a collider radius (0 for none)`, errs);
  if (b.well !== undefined) need(isObj(b.well) && isNum(b.well.rs) && b.well.rs > 0, `${where}.well: needs { rs }`, errs);
  if (b.skim !== undefined) need(typeof b.skim === 'boolean', `${where}.skim: true or false`, errs);
}

/** checkZone(z) → errors[]. The zone's events are checked with checkEvent. */
export function checkZone(z) {
  const errs = [];
  if (!isObj(z)) return ['zone: needs an object'];
  unknownKeys(z, ZONE_KEYS, 'zone', errs);
  need(isId(z.id), 'id: needs an id', errs);
  need(isStr(z.name), 'name: needs text', errs);
  need(Number.isInteger(z.chapter) && z.chapter >= 1, 'chapter: needs a whole number', errs);
  need(ZONE_KINDS.includes(z.kind), `kind: one of ${ZONE_KINDS.join(', ')}`, errs);
  if (z.kind === 'pocket') need(isId(z.parent), 'parent: a pocket needs its zone id', errs);
  need(isStr(z.object), 'object: needs an objects.js id', errs);
  for (const key of ['R', 'slab', 'band', 'scaleLy']) need(isNum(z[key]) && z[key] > 0, `${key}: needs a number`, errs);
  need(isStr(z.scaleCard), 'scaleCard: needs text', errs);
  checkPlane(z.plane, 'plane', errs);

  if (!isObj(z.entry)) errs.push('entry: needs { pos, heading, speed }');
  else {
    need(isV3(z.entry.pos), 'entry.pos: needs [x, y, z]', errs);
    need(isNum(z.entry.heading), 'entry.heading: needs degrees', errs);
    need(isNum(z.entry.speed) || z.entry.speed === 'keep', "entry.speed: a number or 'keep'", errs);
    const bar = z.entry.bar;
    if (bar !== undefined) need(isNum(bar) && bar >= 0 && bar <= 1, 'entry.bar: 0 to 1', errs);
    const p = z.entry.pos;
    if (isV3(p) && isNum(z.R)) need(Math.hypot(p[0], p[1]) <= z.R, 'entry.pos: outside R', errs);
  }

  if (z.kind === 'pit' || z.kind === 'full') {
    if (!isObj(z.exit)) errs.push('exit: a pit stop or full zone needs an exit gate');
  }
  if (z.exit != null) {
    if (!isObj(z.exit)) errs.push('exit: needs an object or null');
    else {
      need(isV3(z.exit.pos), 'exit.pos: needs [x, y, z]', errs);
      need(isNum(z.exit.r) && z.exit.r > 0, 'exit.r: needs a radius', errs);
      need(isId(z.exit.to), 'exit.to: needs a zone id', errs);
      need(isStr(z.exit.label), 'exit.label: needs text', errs);
      need(typeof z.exit.opensWhen === 'string' && /^(beatDone:[a-z0-9-]+:\d+|mission:[a-z0-9-]+)$/.test(z.exit.opensWhen),
        "exit.opensWhen: 'beatDone:<mission>:<index>' or 'mission:<id>'", errs);
    }
  }

  if (z.pocket !== undefined) {
    const p = z.pocket;
    if (!isObj(p)) errs.push('pocket: needs an object');
    else {
      need(isId(p.id), 'pocket.id: needs an id', errs);
      need(isObj(p.ring) && isV3(p.ring.pos) && isV3(p.ring.normal) && isNum(p.ring.r), 'pocket.ring: { pos, normal, r }',
        errs);
      need(isObj(p.back) && isV3(p.back.pos) && isV3(p.back.dir), 'pocket.back: { pos, dir }', errs);
      need(isNum(p.loadWithin), 'pocket.loadWithin: needs u', errs);
    }
  }

  const list = (key) => {
    if (z[key] === undefined) return [];
    if (Array.isArray(z[key])) return z[key];
    errs.push(`${key}: needs a list`);
    return [];
  };
  const bodies = list('bodies'), roads = list('roads'), swarms = list('swarms'), actors = list('actors');
  const rings = list('rings'), sparks = list('sparks'), far = list('far'), rumours = list('rumours');
  const secrets = list('secrets'), events = list('events'), scans = list('scans'), missions = list('missions');
  bodies.forEach((b, i) => checkBody(b, i, errs));
  uniqueIds(bodies, 'bodies', errs);
  roads.forEach((r, i) => checkRoad(r, i, errs));
  uniqueIds(roads, 'roads', errs);
  swarms.forEach((s, i) => {
    const where = `swarms[${i}]`;
    if (!isObj(s)) { errs.push(`${where}: needs an object`); return; }
    need(isId(s.id), `${where}.id: needs an id`, errs);
    need(Number.isInteger(s.count) && s.count >= 0, `${where}.count: needs a whole number`, errs);
    need(s.area === undefined || (isObj(s.area) && isNum(s.area.r)), `${where}.area: needs { r }`, errs);
    if (s.size !== undefined) need(isPair(s.size), `${where}.size: needs [min, max]`, errs);
  });
  uniqueIds(swarms, 'swarms', errs);
  actors.forEach((a, i) => {
    need(isObj(a) && isId(a.id) && ACTOR_KINDS.includes(a.kind), `actors[${i}]: needs { id, kind } with a known kind`,
      errs);
  });
  uniqueIds(actors, 'actors', errs);
  rings.forEach((r, i) => {
    need(isObj(r) && isId(r.id) && isV3(r.pos) && isNum(r.r) && isStr(r.kind), `rings[${i}]: needs { id, pos, r, kind }`,
      errs);
  });
  uniqueIds(rings, 'rings', errs);
  const roadIds = new Set(roads.filter(isObj).map((r) => r.id));
  sparks.forEach((s, i) => {
    const where = `sparks[${i}]`;
    if (!isObj(s)) { errs.push(`${where}: needs an object`); return; }
    if (s.road !== undefined) {
      need(roadIds.has(s.road), `${where}.road: no road '${s.road}'`, errs);
      need(isNum(s.from) && isNum(s.to) && s.from >= 0 && s.to <= 1 && s.from < s.to, `${where}: from < to, 0 to 1`, errs);
      need(Number.isInteger(s.n) && s.n > 0, `${where}.n: needs a count`, errs);
    } else if (s.pts !== undefined) {
      need(Array.isArray(s.pts) && s.pts.length > 0 && s.pts.every(isV3), `${where}.pts: needs [x, y, z] points`, errs);
    } else if (s.along !== undefined) {
      need(Number.isInteger(s.n) && s.n > 0, `${where}.n: needs a count`, errs);
    } else {
      errs.push(`${where}: needs road, pts or along`);
    }
  });
  far.forEach((f, i) => {
    need(isObj(f) && isId(f.id) && ['scan', 'beacon', 'next'].includes(f.kind), `far[${i}]: needs { id, kind }`, errs);
  });
  uniqueIds(far, 'far', errs);
  rumours.forEach((r, i) => {
    need(isObj(r) && isId(r.id) && isStr(r.text) && isId(r.opens), `rumours[${i}]: needs { id, from, text, opens }`, errs);
  });
  const rumourIds = new Set(rumours.filter(isObj).map((r) => r.id));
  secrets.forEach((s, i) => {
    need(isObj(s) && isId(s.id) && isObj(s.when) && isObj(s.reward), `secrets[${i}]: needs { id, rumour, when, reward }`,
      errs);
    if (isObj(s) && s.rumour !== undefined && z.kind !== 'pocket') {
      need(rumourIds.has(s.rumour), `secrets[${i}].rumour: no rumour '${s.rumour}' here`, errs);
    }
  });
  if (z.lookHome != null) need(isObj(z.lookHome) && isStr(z.lookHome.card) && isStr(z.lookHome.line),
    'lookHome: needs { card, line } or null', errs);
  missions.forEach((m, i) => need(isId(m), `missions[${i}]: needs a mission id`, errs));
  events.forEach((e, i) => { for (const err of checkEvent(e)) errs.push(`events[${i}] ${err}`); });
  uniqueIds(events, 'events', errs);
  scans.forEach((s, i) => need(isObj(s) && isId(s.id), `scans[${i}]: needs { id }`, errs));
  uniqueIds(scans, 'scans', errs);
  if (z.sets !== undefined && !isObj(z.sets)) errs.push('sets: needs an object');
  return errs;
}

// ---------------------------------------------------------------- events

const isStars = (s) => Array.isArray(s) && s.length === 3;

/** checkEvent(e) → errors[]: a timed event (9.2) or a stunt (9.3). */
export function checkEvent(e) {
  const errs = [];
  if (!isObj(e)) return ['event: needs an object'];
  need(isId(e.id), 'id: needs an id', errs);
  need(isStr(e.title) && e.title.length <= LIMITS.title, `title: text of ${LIMITS.title} characters at most`, errs);
  if (TIMED_TYPES.includes(e.type)) {
    unknownKeys(e, TIMED_KEYS, e.id || 'event', errs);
    need(isObj(e.start) && isV3(e.start.pos) && isV3(e.start.dir) && isNum(e.start.r), 'start: needs { pos, dir, r }', errs);
    need(isObj(e.runup) && isV3(e.runup.pos) && isNum(e.runup.heading), 'runup: needs { pos, heading }', errs);
    need(typeof e.line === 'string' || (Array.isArray(e.line) && e.line.length >= 2 && e.line.every(isV2)),
      'line: needs [x, y] points or a description', errs);
    if (!Array.isArray(e.gates) || e.gates.length === 0) errs.push('gates: needs a list');
    else e.gates.forEach((g, i) => {
      const ok = isObj(g) && (Number.isInteger(g.at) || isV2(g.pos)) && (g.r === undefined || (isNum(g.r) && g.r > 0));
      need(ok, `gates[${i}]: needs { at } or { pos }, and r > 0 if given`, errs);
      if (ok && Number.isInteger(g.at) && Array.isArray(e.line)) {
        need(g.at > 0 && g.at < e.line.length, `gates[${i}].at: outside the line`, errs);
      }
    });
    if (e.type === 'circuit') need(Number.isInteger(e.laps) && e.laps >= 1, 'laps: a circuit needs laps', errs);
    if (e.type === 'rival') {
      need(isObj(e.rival) && isStr(e.rival.actor) && isNum(e.rival.paceX), 'rival: needs { actor, paceX }', errs);
    }
    need(isNum(e.length) && e.length > 0, 'length: needs u', errs);
    const times = ['tern', 'gold', 'silver', 'bronze'];
    need(times.every((key) => isNum(e[key]) && e[key] > 0), 'tern, gold, silver, bronze: need times', errs);
    if (times.every((key) => isNum(e[key]))) {
      need(e.tern <= e.gold && e.gold <= e.silver && e.silver <= e.bronze, 'medal times must not fall', errs);
    }
  } else if (STUNT_TYPES.includes(e.type)) {
    unknownKeys(e, STUNT_KEYS, e.id || 'stunt', errs);
    need(isStars(e.stars), 'stars: needs three steps', errs);
    const t = e.type;
    if (t === 'drift') need(isObj(e.area) && isV2(e.area.centre) && isNum(e.area.r), 'area: needs { centre, r }', errs);
    if (t === 'trap' || t === 'thread') {
      need(isObj(e.ring) && isV3(e.ring.pos) && isNum(e.ring.r), 'ring: needs { pos, r }', errs);
    }
    if (t === 'thread') need(isV3(e.ring?.normal), 'ring.normal: a thread needs a normal', errs);
    if (t === 'trap') need(isStars(e.stars) && e.stars.every(isNum) && e.stars[0] < e.stars[1] && e.stars[1] < e.stars[2],
      'stars: a trap needs three rising speeds', errs);
    // e['window'], not e.window: v1's pure.test bans the bare word until the cutover deletes it.
    if (t === 'oncoming') need(isId(e.road) && isNum(e['window']), 'road and window: needed', errs);
    if (t === 'line') {
      need(typeof e.pads === 'string' || (Array.isArray(e.pads) && e.pads.length >= 2 && e.pads.every(isV3)),
        'pads: needs [x, y, z] points or a description', errs);
      need(isNum(e['window']) && isNum(e.exitSpeed), 'window and exitSpeed: needed', errs);
    }
    if (t === 'skim' || t === 'sling') need(isId(e.body), 'body: needs a body id', errs);
    if (t === 'sling') need(isNum(e.minTurn), 'minTurn: needs degrees', errs);
  } else {
    errs.push(`type: one of ${[...TIMED_TYPES, ...STUNT_TYPES].join(', ')}`);
  }
  return errs;
}

// ---------------------------------------------------------------- missions

function checkGoal(goal, where, errs) {
  if (!isObj(goal)) { errs.push(`${where}: needs a goal`); return; }
  const keys = Object.keys(goal);
  if (keys.length !== 1 || !GOALS.includes(keys[0])) { errs.push(`${where}: one of ${GOALS.join(', ')}`); return; }
  const g = goal[keys[0]];
  if (keys[0] === 'all') {
    if (!Array.isArray(g) || g.length === 0) errs.push(`${where}.all: needs a list of goals`);
    else g.forEach((sub, i) => checkGoal(sub, `${where}.all[${i}]`, errs));
  } else {
    need(isObj(g), `${where}.${keys[0]}: needs an object`, errs);
  }
}

function checkFails(fails, where, errs) {
  if (fails === undefined) return;
  if (!Array.isArray(fails)) { errs.push(`${where}: needs a list`); return; }
  fails.forEach((f, i) => {
    const keys = isObj(f) ? Object.keys(f).filter((key) => key !== 'toast') : [];
    need(keys.length === 1 && FAILS.includes(keys[0]), `${where}[${i}]: one of ${FAILS.join(', ')}`, errs);
    if (isObj(f) && f.toast !== undefined) {
      need(isStr(f.toast) && f.toast.length <= LIMITS.toast, `${where}[${i}].toast: ${LIMITS.toast} characters at most`,
        errs);
    }
  });
}

function checkSetup(setup, where, errs) {
  if (setup === undefined) return;
  if (!Array.isArray(setup)) { errs.push(`${where}: needs a list`); return; }
  setup.forEach((s, i) => {
    const keys = isObj(s) ? Object.keys(s) : [];
    need(keys.length === 1 && SETUPS.includes(keys[0]), `${where}[${i}]: one of ${SETUPS.join(', ')}`, errs);
    if (keys[0] === 'spawn') {
      const sp = s.spawn;
      need(isObj(sp) && isId(sp.id) && ACTOR_KINDS.includes(sp.kind), `${where}[${i}].spawn: needs { id, kind }`, errs);
    }
  });
}

/** checkMission(m) → errors[] (8.1, 8.2). */
export function checkMission(m) {
  const errs = [];
  if (!isObj(m)) return ['mission: needs an object'];
  unknownKeys(m, MISSION_KEYS, m.id || 'mission', errs);
  need(isId(m.id), 'id: needs an id', errs);
  need(isStr(m.title) && m.title.length <= LIMITS.title, `title: ${LIMITS.title} characters at most`, errs);
  need(isId(m.zone), 'zone: needs a zone id', errs);
  need(typeof m.story === 'boolean', 'story: true or false', errs);
  need(isStr(m.giver), 'giver: needs a name', errs);
  need(isObj(m.start) && ['ring', 'call', 'auto'].some((key) => m.start[key] !== undefined),
    'start: needs ring, call or auto', errs);
  checkSetup(m.setup, 'setup', errs);
  checkFails(m.fails, 'fails', errs);
  if (!Array.isArray(m.beats) || m.beats.length === 0) errs.push('beats: needs a list');
  else m.beats.forEach((b, i) => {
    const where = `beats[${i}]`;
    if (!isObj(b)) { errs.push(`${where}: needs an object`); return; }
    unknownKeys(b, BEAT_KEYS, where, errs);
    need(isStr(b.objective) && b.objective.length <= LIMITS.objective && b.objective === b.objective.toUpperCase(),
      `${where}.objective: uppercase, ${LIMITS.objective} characters at most`, errs);
    checkGoal(b.goal, `${where}.goal`, errs);
    checkFails(b.fails, `${where}.fails`, errs);
    checkSetup(b.setup, `${where}.setup`, errs);
    if (b.onDone !== undefined) need(Array.isArray(b.onDone), `${where}.onDone: needs a list`, errs);
  });
  if (m.medals !== null && m.medals !== undefined) {
    const md = m.medals;
    const ok = isObj(md) && ['author', 'gold', 'silver', 'bronze'].every((key) => isNum(md[key]));
    need(ok, 'medals: needs { author, gold, silver, bronze } or null', errs);
    const rising = ok && md.author <= md.gold && md.gold <= md.silver && md.silver <= md.bronze;
    if (ok) need(rising, 'medals: times must not fall', errs);
  }
  need(Array.isArray(m.rewards), 'rewards: needs a list', errs);
  return errs;
}

// ---------------------------------------------------------------- lines

/** checkLine(l) → errors[] (12): { id, speaker, text, pri }, 2 to 8 words, 44 characters at most, no em dash. */
export function checkLine(l) {
  const errs = [];
  if (!isObj(l)) return ['line: needs an object'];
  unknownKeys(l, LINE_KEYS, l.id || 'line', errs);
  need(typeof l.id === 'string' && /^[a-z]+(\.[a-z0-9-]+)+$/.test(l.id), "id: like 'dot.awake'", errs);
  need(SPEAKERS.includes(l.speaker), `speaker: one of ${SPEAKERS.join(', ')}`, errs);
  need([1, 2, 3].includes(l.pri), 'pri: 1 (mission), 2 (Dot) or 3 (Redshift)', errs);
  if (!isStr(l.text)) errs.push('text: needs text');
  else {
    const words = l.text.trim().split(/\s+/).length;
    const [lo, hi] = LIMITS.lineWords;
    need(words >= lo && words <= hi, `text: ${lo} to ${hi} words (has ${words})`, errs);
    need(l.text.length <= LIMITS.lineChars, `text: ${LIMITS.lineChars} characters at most (has ${l.text.length})`, errs);
    need(!/[—–]/.test(l.text), 'text: no em or en dashes', errs);
  }
  return errs;
}
