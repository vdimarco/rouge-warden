// In Full Swing: street life. People on the sidewalks round the player (they walk, wait for the walk light, cross on the
// zebras, stand at windows, look at phones, talk, and react to the hero), and the neon shop signs on the street floors.
// Pure: no three, no DOM. Plain numbers. Node imports it for the tests; streetview.js draws what it lays out.
import { WORLD } from "./config.js";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- numbers ---------------- */
export const STREET = {
  max: 160, maxXR: 110, // people out at once
  keep: 150, // a person further than this from the player goes back to the pool
  spawnMin: 35, spawnMax: 140, // new people show this far away, so nobody pops in at the camera
  firstMin: 6, // the first fill can put people close: they were there before you looked
  spawnPerFrame: 6,
  speed: [1.0, 1.7], // walking pace, m/s
  light: 14, // each direction's walk light, s
  land: { near: 14, hard: 12, hardNear: 6, dy: 5 }, // a landing: reach, hard down speed, reach of the jump back, height band
  pass: { near: 25, up: 30, speed: 12, cool: 6 }, // a swing over: reach across, height, speed, a person's wait before looking again
  aside: 0.8, // the hero walks into a person closer than this
  crowdNear: 25, crowdFull: 12, // the murmur: people within this reach, full at this many
};
// pose codes (streetview.js poses each one)
export const POSE = { walk: 0, stand: 1, phone: 2, talk: 3, cheer: 4, look: 5, flee: 6, wait: 7 };
const PROMENADE = 272; // south of this the streets stop (cityview.js: the waterfront walk)
const walkW = (w) => (w <= 20 ? 3 : w <= 30 ? 4 : 5); // the sidewalk width of a street (cityview.js)

/* ---------------- the walk lights ---------------- */
// The crossings of north-south roads (people walk east-west over them) and of east-west roads take turns.
// axis: the axis of the road being crossed ("x": a north-south road, "z": an east-west road).
export function walkOn(axis, t) {
  const phase = Math.floor(t / STREET.light) % 2;
  return axis === "x" ? phase === 0 : phase === 1;
}

/* ---------------- the sidewalk network ---------------- */
// Every street as { axis, at, w, walk, from, to }: axis "x" runs north-south with its centre at x = at, from z = from to to.
export function streetsOf(city) {
  const ST = city.streets, B = city.bounds;
  const full = ST.avenues.filter((a) => a.to - a.from > 900);
  const lineW = (at, axis) => { for (const a of full) if (a.axis === axis && a.at === at) return a.w; return ST.width; };
  const out = [];
  for (const at of ST.xs) { const w = lineW(at, "x"); out.push({ axis: "x", at, w, walk: walkW(w), from: B.minZ, to: PROMENADE }); }
  for (const at of ST.zs) { const w = lineW(at, "z"); out.push({ axis: "z", at, w, walk: walkW(w), from: B.minX, to: B.maxX }); }
  for (const a of ST.avenues) {
    if (a.to - a.from > 900) continue;
    out.push({ axis: a.axis, at: a.at, w: a.w, walk: walkW(a.w), from: a.from, to: a.axis === "x" ? Math.min(a.to, PROMENADE) : a.to });
  }
  return out;
}
// A strip: one sidewalk along one side of one street. line: its centre across the street axis; lo..hi along it;
// half: half its width; cross: the roads that cut it (along: their centre, road: half the road, edge: half the street).
export function stripsOf(streets) {
  const strips = [];
  for (const s of streets) {
    for (const side of [-1, 1]) {
      const line = s.at + side * (s.w / 2 - s.walk / 2);
      const cross = [];
      for (const c of streets) {
        if (c.axis === s.axis || line < c.from || line > c.to) continue;
        if (c.at < s.from - c.w / 2 || c.at > s.to + c.w / 2) continue;
        cross.push({ along: c.at, road: c.w / 2 - c.walk, edge: c.w / 2, street: c });
      }
      cross.sort((p, q) => p.along - q.along);
      strips.push({ id: strips.length, axis: s.axis, street: s, side, line, half: s.walk / 2, lo: s.from + 1, hi: s.to - 1, cross });
    }
  }
  // the strip of street c on side sc, for the turns at the corners
  for (const st of strips) for (const c of st.cross) {
    c.strips = strips.filter((o) => o.street === c.street);
  }
  return strips;
}
// the crossing whose road (z = the zebra) holds `along` on strip st, or null
function roadAt(st, along) {
  for (const c of st.cross) if (Math.abs(along - c.along) < c.road) return c;
  return null;
}
// the crossing whose street (road and sidewalks) holds `along`, or null
function cornerAt(st, along) {
  for (const c of st.cross) if (Math.abs(along - c.along) < c.edge) return c;
  return null;
}
const xOf = (st, along, off) => (st.axis === "x" ? st.line + off : along);
const zOf = (st, along, off) => (st.axis === "x" ? along : st.line + off);

/* ---------------- shop signs ---------------- */
const SIGN_DIST = new Set([2, 3, 5]); // Old Town, Market, Warehouse
// neon colours (linear, over 1 so the bloom picks them out): pink, cyan, yellow, green, violet, orange
export const NEON = [[2.6, 0.35, 1.4], [0.3, 2.2, 2.6], [2.6, 2.1, 0.35], [0.5, 2.6, 0.7], [1.5, 0.6, 2.8], [2.8, 1.0, 0.25]];
// A face looks on to a street when the street (road and sidewalk) starts within 1 m of it.
function facesStreet(streets, axis, at, lo, hi, out) {
  for (const s of streets) {
    if (s.axis !== axis) continue;
    const edge = out > 0 ? s.at - s.w / 2 : s.at + s.w / 2;
    if (Math.abs(edge - at) > 1) continue;
    const mid = (lo + hi) / 2;
    if (mid < s.from || mid > s.to) continue;
    return s;
  }
  return null;
}
// Boards over the shop windows and blade signs sticking out from the wall. Each sign:
// { x, y, z, yaw, w, h, d, kind (0 board, 1 blade), color index, flicker (0 or a rate), seed }
export function signsOf(city, streets, max = 4200) {
  const r = rng(4242), signs = [];
  const avenue = (s) => s && s.w >= 30;
  for (const b of city.buildings) {
    if (signs.length >= max) break;
    const t = b.tiers[0];
    if (!t || t.y1 < 5) continue;
    // the four faces: axis of the street it looks on to, where the face is, its span, which way out, the wall's yaw
    const faces = [
      { axis: "x", at: t.maxX, lo: t.minZ, hi: t.maxZ, out: 1 }, { axis: "x", at: t.minX, lo: t.minZ, hi: t.maxZ, out: -1 },
      { axis: "z", at: t.maxZ, lo: t.minX, hi: t.maxX, out: 1 }, { axis: "z", at: t.minZ, lo: t.minX, hi: t.maxX, out: -1 },
    ];
    for (const f of faces) {
      const s = facesStreet(streets, f.axis, f.at, f.lo, f.hi, f.out);
      if (!s || !(SIGN_DIST.has(b.district) || avenue(s))) continue;
      // the yaw that turns a sign's front (+z in its own frame) out of the wall
      const yaw = f.axis === "x" ? (f.out > 0 ? Math.PI / 2 : -Math.PI / 2) : (f.out > 0 ? 0 : Math.PI);
      const nx = f.axis === "x" ? f.out : 0, nz = f.axis === "z" ? f.out : 0;
      const len = f.hi - f.lo;
      // boards: one per shop front, 3-6 m wide, over the windows
      for (let u = f.lo + 1 + r() * 3; u < f.hi - 3; ) {
        const w = Math.min(3 + r() * 3, f.hi - 1 - u);
        if (w < 2.4) break;
        if (r() < 0.78) {
          const c = (u + w / 2), y = 3.5 + r() * 0.5, h = 0.75 + r() * 0.45;
          signs.push({ x: f.axis === "x" ? f.at + nx * 0.1 : c, y, z: f.axis === "z" ? f.at + nz * 0.1 : c, yaw, w, h, d: 0.18, kind: 0,
            color: Math.floor(r() * NEON.length), flicker: r() < 0.12 ? 4 + r() * 8 : 0, seed: r() });
        }
        u += w + 1.5 + r() * 4;
      }
      // blade signs: tall and thin, out over the sidewalk, every 18-30 m on a face of at least 10 m
      if (len >= 10 && t.y1 >= 8) {
        for (let u = f.lo + 3 + r() * 6; u < f.hi - 3; u += 18 + r() * 12) {
          const h = 1.8 + r() * 1.0, y = 3.6 + r() * 0.6 + h / 2; // from 3.6-4.2 m up to at most 7 m
          if (y + h / 2 > t.y1 - 0.5) continue;
          const out = 0.95;
          const x = f.axis === "x" ? f.at + nx * out : u, z = f.axis === "z" ? f.at + nz * out : u;
          // never into another building (a lot that sticks out past this face at a corner)
          if (city.collideSphere(x + nx * 0.4, y, z + nz * 0.4, 0.45)) continue;
          signs.push({ x, y, z, yaw: yaw + Math.PI / 2, w: 1.5, h, d: 0.3, kind: 1,
            color: Math.floor(r() * NEON.length), flicker: r() < 0.12 ? 4 + r() * 8 : 0, seed: r() });
        }
      }
      if (signs.length >= max) break;
    }
  }
  return signs;
}

/* ---------------- people ---------------- */
// clothes: shirt colours, trouser colours and skin tones
const SHIRTS = [[0.85, 0.25, 0.22], [0.2, 0.42, 0.75], [0.95, 0.78, 0.25], [0.25, 0.6, 0.45], [0.9, 0.9, 0.86], [0.18, 0.18, 0.22], [0.62, 0.3, 0.7], [0.95, 0.5, 0.25], [0.3, 0.75, 0.85]];
const PANTS = [[0.15, 0.2, 0.32], [0.12, 0.12, 0.14], [0.4, 0.33, 0.25], [0.5, 0.5, 0.55], [0.25, 0.3, 0.22]];
const SKIN = [[0.96, 0.78, 0.62], [0.85, 0.62, 0.45], [0.66, 0.45, 0.3], [0.45, 0.3, 0.2], [0.98, 0.84, 0.7]];

export function createStreet(city, opts = {}) {
  const max = opts.max || STREET.max;
  const r = rng(opts.seed || 9001);
  const streets = streetsOf(city), strips = stripsOf(streets);
  const signs = signsOf(city, streets);
  const P = []; // the pool
  for (let i = 0; i < max; i++) {
    P.push({
      id: i, on: false, strip: null, along: 0, off: 0, dir: 1, speed: 1.3, x: 0, y: 0, z: 0, yaw: 0, phase: 0, stride: 0,
      state: "walk", t: 0, poseT: 0, pose: POSE.walk, cool: 0, crossing: null, faceX: 0, faceZ: 0, mate: -1, delay: 0,
      height: 1, shirt: SHIRTS[0], pants: PANTS[0], skin: SKIN[0], fleeDir: 0,
    });
  }
  const S = {
    streets, strips, signs, people: P, count: 0, time: 0, first: true, crowd: 0, reactions: [], max, limit: max,
    stats: { spawned: 0, dropped: 0, cheers: 0, flees: 0, looks: 0, asides: 0, crossed: 0, waited: 0, idles: 0, talks: 0 },
  };

  // place a person at (strip, along, off)
  const seat = (p) => {
    p.x = xOf(p.strip, p.along, p.off); p.z = zOf(p.strip, p.along, p.off); p.y = 0;
  };
  const faceAlong = (p) => {
    const st = p.strip;
    const dx = st.axis === "x" ? 0 : p.dir, dz = st.axis === "x" ? p.dir : 0;
    p.yaw = Math.atan2(-dx, -dz);
  };
  const faceTo = (p, x, z) => { p.yaw = Math.atan2(-(x - p.x), -(z - p.z)); };

  // a free sidewalk spot near (fx, fz), between lo and hi metres away; null if none in a few tries
  function spot(fx, fz, lo, hi) {
    for (let k = 0; k < 24; k++) {
      const st = strips[Math.floor(r() * strips.length)];
      // the strip's nearest point to the focus, then a random spot within reach along it
      const across = Math.abs(st.line - (st.axis === "x" ? fx : fz));
      if (across > hi) continue;
      const fa = st.axis === "x" ? fz : fx, reach = Math.sqrt(hi * hi - across * across);
      const a0 = Math.max(st.lo, fa - reach), a1 = Math.min(st.hi, fa + reach);
      if (a1 <= a0) continue;
      const along = a0 + r() * (a1 - a0), off = (r() * 2 - 1) * Math.max(0, st.half - 0.6);
      if (roadAt(st, along)) continue; // never spawn on a zebra
      const x = xOf(st, along, off), z = zOf(st, along, off), d = Math.hypot(x - fx, z - fz);
      if (d < lo || d > hi) continue;
      if (city.isWater(x, z) || city.collideSphere(x, 0.9, z, 0.35)) continue;
      return { st, along, off, x, z };
    }
    return null;
  }
  function spawn(p, sp) {
    p.on = true; p.strip = sp.st; p.along = sp.along; p.off = sp.off; p.dir = r() < 0.5 ? -1 : 1;
    p.speed = STREET.speed[0] + r() * (STREET.speed[1] - STREET.speed[0]);
    p.height = 0.9 + r() * 0.2;
    p.shirt = SHIRTS[Math.floor(r() * SHIRTS.length)]; p.pants = PANTS[Math.floor(r() * PANTS.length)]; p.skin = SKIN[Math.floor(r() * SKIN.length)];
    p.phase = r() * Math.PI * 2; p.state = "walk"; p.t = 4 + r() * 20; p.poseT = 0; p.cool = 0; p.crossing = null; p.decided = false; p.mate = -1; p.delay = 0;
    seat(p); faceAlong(p);
    // some people are already standing when you arrive
    if (r() < 0.18) idle(p, Math.floor(r() * 2));
    S.count++; S.stats.spawned++;
  }
  function drop(p) { p.on = false; p.mate = -1; S.count--; S.stats.dropped++; }

  // stand still for a while: 0 at a shop window, 1 on the phone, 2 talking (with mate)
  function idle(p, kind, mate) {
    p.state = "idle"; p.t = kind === 2 ? 5 + r() * 7 : 3 + r() * 9; p.poseT = 0;
    p.pose = kind === 1 ? POSE.phone : kind === 2 ? POSE.talk : POSE.stand;
    if (kind === 0) {
      // face the building side of the sidewalk (away from the road)
      const st = p.strip, out = st.side; // +side is away from the street centre
      const dx = st.axis === "x" ? out : 0, dz = st.axis === "x" ? 0 : out;
      p.yaw = Math.atan2(-dx, -dz);
    }
    if (kind === 2 && mate) { p.mate = mate.id; faceTo(p, mate.x, mate.z); }
    S.stats.idles++;
    if (kind === 2) S.stats.talks++;
  }
  function walkOnFrom(p) { p.state = "walk"; p.pose = POSE.walk; p.t = 6 + r() * 20; p.mate = -1; faceAlong(p); }

  // a reaction: state, how long, which pose, after a short delay (people do not move as one)
  function react(p, state, dur, pose, delay = 0) {
    p.state = state; p.t = dur; p.pose = pose; p.poseT = 0; p.delay = delay; p.mate = -1;
  }

  // At the end of a block: cross the road ahead (if its light is on), turn on to the crossing street, or turn back.
  function atCorner(p, c, t) {
    const st = p.strip;
    const roll = r();
    if (roll < 0.5) return "cross";
    // turn: on to the crossing street's strip on this corner
    const sc = Math.sign(p.along - c.along) || 1;
    const ns = c.strips.find((o) => o.side === sc);
    if (ns && roll < 0.85) {
      const along = st.line + p.off, nd = st.side; // away from this street's road, or over it
      const goOver = r() < 0.4;
      p.strip = ns; p.along = clamp(along, ns.lo, ns.hi); p.off = clamp((st.axis === "x" ? p.z : p.x) - ns.line, -ns.half + 0.4, ns.half - 0.4);
      p.dir = goOver ? -nd : nd;
      faceAlong(p);
      return "turn";
    }
    p.dir = -p.dir; faceAlong(p);
    return "back";
  }

  function stepWalk(p, dt, t) {
    const st = p.strip, ahead = p.along + p.dir * 1.0;
    const road = roadAt(st, ahead);
    if (road && !p.crossing) {
      // at the kerb: decide what to do at this corner (once), then wait for the light to cross
      if (!p.decided) {
        p.decided = true;
        const d = atCorner(p, road, t);
        if (d !== "cross") { p.decided = false; return; }
      }
      const axis = road.street.axis;
      if (!walkOn(axis, t)) {
        p.stride = 0;
        if (p.state !== "wait") { p.state = "wait"; p.pose = POSE.wait; p.poseT = 0; S.stats.waited++; }
        return;
      }
      p.crossing = road; p.decided = false; p.state = "walk"; p.pose = POSE.walk;
    }
    // over the road once past its far kerb
    if (p.crossing && (p.along - p.crossing.along) * p.dir >= p.crossing.road) { p.crossing = null; S.stats.crossed++; }
    p.along += p.dir * p.speed * dt;
    p.stride = p.speed;
    if (p.along < st.lo || p.along > st.hi) { p.along = clamp(p.along, st.lo, st.hi); p.dir = -p.dir; faceAlong(p); }
    seat(p);
    // a building, the lake or a pillar in the way (the walk along a long strip can meet one): turn back
    if (city.isWater(p.x, p.z) || city.collideSphere(p.x, 0.9, p.z, 0.3)) { p.along -= p.dir * p.speed * dt * 2; p.dir = -p.dir; faceAlong(p); seat(p); }
    // now and then, a stop
    p.t -= dt;
    if (p.t <= 0 && !p.crossing && !cornerAt(st, p.along)) {
      const k = r();
      if (k < 0.45) idle(p, 0); else if (k < 0.75) idle(p, 1); else p.t = 6 + r() * 20;
    }
  }

  // move along the strip by d (keeping off the road unless crossing), and across within the sidewalk
  function nudge(p, dAlong, dOff) {
    const st = p.strip;
    let na = clamp(p.along + dAlong, st.lo, st.hi);
    if (!p.crossing && roadAt(st, na)) na = p.along;
    p.along = na;
    p.off = clamp(p.off + dOff, -st.half + 0.3, st.half - 0.3);
    seat(p);
    if (city.collideSphere(p.x, 0.9, p.z, 0.3)) { p.along -= dAlong; p.off -= dOff; seat(p); }
  }

  /* ---- the frame ---- */
  // focus: where the player is { x, y, z }; hero: { x, y, z, vx, vy, vz, onGround } (or null in the headset's first person)
  S.update = function update(dt, t, focus, hero) {
    dt = clamp(dt || 0, 0, 0.1);
    S.time = t;
    const fx = focus.x, fz = focus.z, K2 = STREET.keep * STREET.keep;
    // drop the far ones, fill free slots
    let free = 0;
    for (const p of P) {
      if (!p.on) { free++; continue; }
      const dx = p.x - fx, dz = p.z - fz;
      if (dx * dx + dz * dz > K2 || S.count > S.limit) { drop(p); free++; }
    }
    free = Math.min(free, Math.max(0, S.limit - S.count));
    let n = S.first ? max : STREET.spawnPerFrame;
    for (const p of P) {
      if (!free || n <= 0) break;
      if (p.on) continue;
      const sp = spot(fx, fz, S.first ? STREET.firstMin : STREET.spawnMin, STREET.spawnMax);
      n--;
      if (!sp) continue;
      spawn(p, sp); free--;
    }
    S.first = false;

    const hs = hero ? Math.hypot(hero.vx, hero.vz) : 0, hsp = hero ? Math.hypot(hs, hero.vy) : 0;
    let near = 0;
    for (const p of P) {
      if (!p.on) continue;
      p.poseT += dt;
      if (p.cool > 0) p.cool -= dt;
      if (p.delay > 0) { p.delay -= dt; if (p.state !== "flee") { p.stride = 0; } continue; }
      // the hero walks into this person: step aside
      if (hero && hero.onGround && Math.abs(hero.y - p.y) < 1.5) {
        const dx = p.x - hero.x, dz = p.z - hero.z, d = Math.hypot(dx, dz);
        if (d < STREET.aside && p.state !== "aside" && p.state !== "flee") {
          react(p, "aside", 0.6, POSE.stand); p.faceX = dx / (d || 1); p.faceZ = dz / (d || 1); S.stats.asides++;
        }
      }
      // the hero swings over, low and fast: look up and point
      if (hero && !hero.onGround && hsp > STREET.pass.speed && p.cool <= 0 && (p.state === "walk" || p.state === "idle" || p.state === "wait")) {
        const up = hero.y - p.y, dx = hero.x - p.x, dz = hero.z - p.z;
        if (up > 2 && up < STREET.pass.up && dx * dx + dz * dz < STREET.pass.near * STREET.pass.near) {
          react(p, "look", 2 + r(), POSE.look, r() * 0.25); p.cool = STREET.pass.cool; S.stats.looks++;
        }
      }
      switch (p.state) {
        case "walk": case "wait": stepWalk(p, dt, t); break;
        case "idle": {
          p.stride = 0; p.t -= dt;
          if (p.pose === POSE.talk && p.mate >= 0) { const m = P[p.mate]; if (!m.on || m.mate !== p.id) p.t = Math.min(p.t, 0.5); }
          if (p.t <= 0) walkOnFrom(p);
          break;
        }
        case "cheer": case "look": {
          p.stride = 0; p.t -= dt;
          if (hero) faceTo(p, hero.x, hero.z);
          if (p.t <= 0) walkOnFrom(p);
          break;
        }
        case "flee": {
          p.t -= dt; p.stride = 3.6;
          nudge(p, p.fleeDir * 3.6 * dt, 0);
          const st = p.strip, dx = st.axis === "x" ? 0 : p.fleeDir, dz = st.axis === "x" ? p.fleeDir : 0;
          p.yaw = Math.atan2(-dx, -dz);
          if (p.t <= 0) { react(p, "cheer", 2 + r() * 2, POSE.cheer); S.stats.cheers++; }
          break;
        }
        case "aside": {
          p.t -= dt; p.stride = 1.2;
          const st = p.strip;
          const dAlong = st.axis === "x" ? p.faceZ : p.faceX, dOff = st.axis === "x" ? p.faceX : p.faceZ;
          nudge(p, dAlong * 1.6 * dt, dOff * 1.6 * dt);
          if (p.t <= 0) walkOnFrom(p);
          break;
        }
      }
      if (p.stride > 0) p.phase = (p.phase + dt * p.stride * 2.2) % (Math.PI * 200);
      if (Math.hypot(p.x - fx, p.z - fz) < STREET.crowdNear && (focus.y - p.y) < 12) near++;
    }
    // two people who meet stop to talk now and then
    if (r() < dt * 2) {
      search: for (let k = 0; k < 12; k++) {
        const a = P[Math.floor(r() * max)];
        if (!a.on || a.state !== "walk" || a.crossing) continue;
        for (const b of P) {
          if (b === a || !b.on || b.state !== "walk" || b.strip !== a.strip || b.crossing) continue;
          if (Math.abs(b.along - a.along) < 3) { idle(a, 2, b); idle(b, 2, a); b.t = a.t; break search; }
        }
      }
    }
    S.crowd = clamp(near / STREET.crowdFull, 0, 1);
  };

  // The hero lands at (x, y, z) at vy (m/s, negative is down). People near react; returns { cheer, gasp, x, y, z } for the sound.
  S.land = function land(x, y, z, vy) {
    const L = STREET.land, hard = -vy > L.hard;
    let n = 0, cx = 0, cz = 0, fled = 0;
    for (const p of P) {
      if (!p.on || Math.abs(y - p.y) > L.dy) continue;
      const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz);
      if (d > L.near) continue;
      if (hard && d < L.hardNear) {
        // jump back: along the sidewalk, away from the hero
        const st = p.strip, away = st.axis === "x" ? dz : dx;
        p.fleeDir = Math.sign(away) || (r() < 0.5 ? -1 : 1);
        react(p, "flee", (2 + r() * 2) / 3.6, POSE.flee, r() * 0.1); S.stats.flees++; fled++;
      } else {
        react(p, "cheer", 2 + r() * 2, POSE.cheer, r() * 0.3); S.stats.cheers++;
        faceTo(p, x, z);
      }
      p.cool = STREET.pass.cool;
      n++; cx += p.x; cz += p.z;
    }
    const out = { n, fled, gasp: fled > 0, cheer: n > 0, x: n ? cx / n : x, y: 1.6, z: n ? cz / n : z };
    if (n) S.reactions.push(out);
    if (S.reactions.length > 16) S.reactions.shift();
    return out;
  };

  // every person on a sidewalk or a zebra (for the tests)
  S.onWalk = function onWalk(p) {
    const st = p.strip;
    const across = (st.axis === "x" ? p.x : p.z) - st.line;
    if (Math.abs(across) > st.half + 0.05) return false;
    const along = st.axis === "x" ? p.z : p.x;
    return along >= st.lo - 0.05 && along <= st.hi + 0.05;
  };
  S.info = () => ({
    count: S.count, crowd: S.crowd, signs: signs.length, strips: strips.length, stats: { ...S.stats }, time: S.time,
    states: P.filter((p) => p.on).reduce((m, p) => { m[p.state] = (m[p.state] || 0) + 1; return m; }, {}),
  });
  return S;
}
